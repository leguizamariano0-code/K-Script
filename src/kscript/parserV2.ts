// Módulo `parserV2`: convierte tokens de K-Script / .koko v2.0 en un AST `Rima`.
// Port directo de `korivm/src/kscript/parser.rs` a TypeScript estricto.
//
// Recursión descendente, sin llaves, alineado con `src/kscript/ast.ts` y `lexerV2.ts`.
// Rellena `VerbRef.canonicalId` y `SubjectRef.canonicalId` consultando `dictionary.ts`.

import { Lexer, LexError, SpannedToken, Token, tokenKindName } from './lexerV2';
import {
  spanned,
  createVerbRef,
  createSubjectRef,
  type Span,
  type Statement,
  type StatementKind,
  type Command,
  type Parametro,
  type Modificador,
  type Tiempo,
  type Condicion,
  type LayoutExpr,
  type LayoutCell,
  type LayoutMap,
  type LayoutSection,
  type InvariantExpr,
  type RelationalOp,
  type TopologyItem,
  type CausalNode,
  type TrajectoryPoint,
  type HarmonicEntry,
  type WeightsBlock,
  type Vector8,
  type Rima,
  type FileVersion,
  type NamedParam,
} from './ast';
import { resolveCanonicalId, resolveSubjectId } from './dictionary';

// ============================================================================
// ERRORES
// ============================================================================

export class ParseError extends Error {
  public readonly rawMessage: string;
  public readonly span: Span;

  constructor(message: string, span: Span) {
    super(`Error de parseo en línea ${span.line}, col ${span.col}: ${message}`);
    this.name = 'ParseError';
    this.rawMessage = message;
    this.span = span;
  }
}

// ============================================================================
// PARSER
// ============================================================================

export class ParserV2 {
  private tokens: SpannedToken[];
  private pos: number = 0;

  constructor(tokens: SpannedToken[]) {
    this.tokens = tokens;
  }

  /// Punto de entrada: string -> Rima.
  public static parse(input: string): Rima {
    let tokens: SpannedToken[];
    try {
      tokens = new Lexer(input).tokenize();
    } catch (e) {
      if (e instanceof LexError) {
        throw new ParseError(e.rawMessage, e.span);
      }
      throw e;
    }
    return new ParserV2(tokens).parseProgram();
  }

  // ---- Programa completo ----

  private parseProgram(): Rima {
    this.skipNewlines();

    let name = 'unnamed';
    let version: FileVersion = 'Unknown';

    if (this.checkKeyword('RIMA')) {
      this.advance();
      this.expect('colon');
      name = this.expectIdentifier();
      version = 'KokoV20';
      this.skipNewlines();
    }

    const statements: Statement[] = [];
    while (true) {
      this.skipNewlines();
      if (this.checkEof()) break;
      statements.push(this.parseStatement());
    }

    if (version === 'Unknown') {
      const hasV2 = statements.some((s) => isV2Kind(s.node));
      version = hasV2 ? 'KokoV20' : 'KScriptV11';
    }

    return { name, statements, version };
  }

  // ---- Dispatcher ----

  private parseStatement(): Statement {
    const start = this.currentSpan();
    const ident = this.peekIdentifier();
    if (ident !== null) {
      switch (ident.toUpperCase()) {
        case 'VERSION':
        case 'AUTOR':
        case 'HASH':
        case 'FIRMA':
          return this.parseHeaderField(start);
        case 'INVARIANT':
          return this.parseInvariant(start);
        case 'FRECUENCIAS':
          return this.parseFrequencies(start);
        case 'TOPOLOGICOS':
          return this.parseTopology(start);
        case 'CAUSAL':
          return this.parseCausalNode(start);
        case 'ORDEN':
          return this.parseCausalOrder(start);
        case 'RESONANCIA':
          return this.parseResonance(start);
        case 'TRAYECTORIA':
          return this.parseTrajectory(start);
        case 'ARMONICOS':
          return this.parseHarmonics(start);
        case 'RESIDUO':
          return this.parseResidue(start);
        case 'PESOS':
          return this.parseWeights(start);
        default:
          break;
      }
    }
    return this.parseKScript(start);
  }

  // ---- Capa 0 ----

  private parseHeaderField(start: Span): Statement {
    const key = this.expectIdentifier();
    this.expect('colon');
    const value = this.parseParam();
    this.consumeOptional('semicolon');
    return spanned<StatementKind>({ kind: 'HeaderField', key, value }, start);
  }

  private parseInvariant(start: Span): Statement {
    this.expectKeyword('INVARIANT');
    this.expect('colon');
    const subject = this.expectIdentifier();
    const op = this.expectRelationalOp();
    const value = this.expectNumber();
    this.consumeOptional('semicolon');
    const invariant: InvariantExpr = { subject, op, value };
    return spanned<StatementKind>({ kind: 'Invariant', invariant }, start);
  }

  private parseFrequencies(start: Span): Statement {
    this.expectKeyword('FRECUENCIAS');
    this.expect('colon');
    const frequencies: number[] = [this.expectNumber()];
    while (this.consumeOptional('bar')) {
      frequencies.push(this.expectNumber());
    }
    this.consumeOptional('semicolon');
    return spanned<StatementKind>({ kind: 'Frequencies', frequencies }, start);
  }

  // ---- Capa 1 ----

  private parseTopology(start: Span): Statement {
    this.expectKeyword('TOPOLOGICOS');
    this.expect('colon');
    const items: TopologyItem[] = [this.parseTopologyItem()];
    while (this.consumeOptional('bar')) {
      items.push(this.parseTopologyItem());
    }
    this.consumeOptional('semicolon');
    return spanned<StatementKind>({ kind: 'Topology', items }, start);
  }

  private parseTopologyItem(): TopologyItem {
    const key = this.expectIdentifier();
    this.expect('openBracket');
    const value = this.parseParam();
    this.expect('closeBracket');
    return { key, value };
  }

  // ---- Capa 2 ----

  private parseCausalNode(start: Span): Statement {
    this.expectKeyword('CAUSAL');
    this.expect('colon');
    const id = this.expectIdentifier();
    this.expect('openBracket');

    const dependsOn: string[] = [];
    let operator: string | undefined;
    const params: NamedParam[] = [];

    if (!this.check('closeBracket')) {
      while (true) {
        const key = this.expectIdentifier();
        this.expect('colon');

        const lk = key.toLowerCase();
        if (lk === 'depende' || lk === 'depende_de') {
          const deps = [this.expectIdentifier()];
          while (this.consumeOptional('bar')) {
            deps.push(this.expectIdentifier());
          }
          dependsOn.push(...deps);
        } else {
          const value = this.parseParam();
          if (lk === 'operador') {
            if (value.kind === 'Identifier' || value.kind === 'String') {
              operator = value.value;
            }
          } else {
            params.push({ key, value });
          }
        }

        if (!this.consumeOptional('comma')) break;
      }
    }
    this.expect('closeBracket');
    this.consumeOptional('semicolon');

    const node: CausalNode = { id, dependsOn, operator, params };
    return spanned<StatementKind>({ kind: 'CausalNode', node }, start);
  }

  private parseCausalOrder(start: Span): Statement {
    this.expectKeyword('ORDEN');
    this.expect('colon');
    const order: string[] = [this.expectIdentifier()];
    while (this.consumeOptional('bar')) {
      order.push(this.expectIdentifier());
    }
    this.consumeOptional('semicolon');
    return spanned<StatementKind>({ kind: 'CausalOrder', order }, start);
  }

  // ---- Capa 3 ----

  private parseResonance(start: Span): Statement {
    this.expectKeyword('RESONANCIA');
    this.expect('colon');
    if (this.checkKeyword('Vector')) this.advance();
    this.expect('openBracket');
    const vals: number[] = [];
    for (let i = 0; i < 8; i++) {
      vals.push(this.expectNumber());
      this.consumeOptional('comma');
    }
    this.expect('closeBracket');
    this.consumeOptional('semicolon');
    const vector: Vector8 = [
      vals[0],
      vals[1],
      vals[2],
      vals[3],
      vals[4],
      vals[5],
      vals[6],
      vals[7],
    ];
    return spanned<StatementKind>({ kind: 'Resonance', vector }, start);
  }

  private parseTrajectory(start: Span): Statement {
    this.expectKeyword('TRAYECTORIA');
    this.expect('colon');
    const points: TrajectoryPoint[] = [this.parseTrajectoryPoint()];
    while (this.consumeOptional('bar')) {
      points.push(this.parseTrajectoryPoint());
    }
    this.consumeOptional('semicolon');
    return spanned<StatementKind>({ kind: 'Trajectory', points }, start);
  }

  private parseTrajectoryPoint(): TrajectoryPoint {
    const t = this.expectNumber();
    this.expect('openBracket');
    const vals: number[] = [];
    for (let i = 0; i < 8; i++) {
      vals.push(this.expectNumber());
      this.consumeOptional('comma');
    }
    this.expect('closeBracket');
    const vector: Vector8 = [
      vals[0],
      vals[1],
      vals[2],
      vals[3],
      vals[4],
      vals[5],
      vals[6],
      vals[7],
    ];
    return { t, vector };
  }

  private parseHarmonics(start: Span): Statement {
    this.expectKeyword('ARMONICOS');
    this.expect('colon');
    const entries: HarmonicEntry[] = [this.parseHarmonicEntry()];
    while (this.consumeOptional('bar')) {
      entries.push(this.parseHarmonicEntry());
    }
    this.consumeOptional('semicolon');
    return spanned<StatementKind>({ kind: 'Harmonics', entries }, start);
  }

  private parseHarmonicEntry(): HarmonicEntry {
    const freqHz = this.expectNumber();
    this.expect('openBracket');
    const label = this.expectIdentifier();
    this.expect('closeBracket');
    return { freqHz, label };
  }

  // ---- Capa 4 ----

  private parseResidue(start: Span): Statement {
    this.expectKeyword('RESIDUO');
    this.expect('colon');
    const params: NamedParam[] = [this.parseNamedParamBracket()];
    while (this.consumeOptional('bar')) {
      params.push(this.parseNamedParamBracket());
    }
    this.consumeOptional('semicolon');
    return spanned<StatementKind>({ kind: 'Residue', params }, start);
  }

  private parseNamedParamBracket(): NamedParam {
    const key = this.expectIdentifier();
    this.expect('openBracket');
    const value = this.parseParam();
    this.expect('closeBracket');
    return { key, value };
  }

  // ---- Pesos ----
  // Nota de paridad con korivm/src/kscript/parser.rs: el parser construye WeightsBlock
  // sin validar que sumen 1.0; esa verificación ocurre en el evaluador (validateWeightsSum).

  private parseWeights(start: Span): Statement {
    this.expectKeyword('PESOS');
    this.expect('colon');
    let topologicos = 0;
    let causales = 0;
    let resonancia = 0;
    let interferencia = 0;

    while (true) {
      const key = this.expectIdentifier();
      this.expect('openBracket');
      const val = this.expectNumber();
      this.expect('closeBracket');
      switch (key.toLowerCase()) {
        case 'topologicos':
          topologicos = val;
          break;
        case 'causales':
          causales = val;
          break;
        case 'resonancia':
          resonancia = val;
          break;
        case 'interferencia':
          interferencia = val;
          break;
        default:
          throw this.errAtCurrent(`clave de pesos desconocida: '${key}'`);
      }
      if (!this.consumeOptional('bar')) break;
    }
    this.consumeOptional('semicolon');

    const weights: WeightsBlock = { topologicos, causales, resonancia, interferencia };
    return spanned<StatementKind>({ kind: 'Weights', weights }, start);
  }

  // ---- K-Script (commands, pipelines, layouts) ----

  private parseKScript(start: Span): Statement {
    if (this.check('glyphVertical') || this.check('glyphHorizontal')) {
      return this.parseLayout(start);
    }
    if (this.check('glyphMap')) {
      return this.parseLayoutMap(start);
    }
    return this.parseCommandOrPipeline(start);
  }

  private parseCommandOrPipeline(start: Span): Statement {
    const first = this.parseCommand();
    if (!this.check('pipe')) {
      return first;
    }
    const statements: Statement[] = [first];
    while (this.check('pipe')) {
      this.advance();
      this.skipNewlines();
      statements.push(this.parseCommand());
    }
    return spanned<StatementKind>({ kind: 'Pipeline', statements }, start);
  }

  private parseCommand(): Statement {
    const start = this.currentSpan();
    const verbName = this.expectIdentifier();
    const verbId = resolveCanonicalId(verbName) ?? null;

    this.expect('colon');
    const subjectName = this.expectIdentifier();
    const subjectId = resolveSubjectId(subjectName);

    const params = this.check('openBracket') ? this.parseParams() : [];

    const modifiers: Modificador[] = [];
    let time: Tiempo | undefined;
    let condition: Condicion | undefined;

    while (true) {
      const t = this.peekToken();
      if (t.type === 'modifier') {
        modifiers.push(this.parseModifier());
      } else if (t.type === 'reference' && time === undefined) {
        time = this.parseTime();
      } else if (t.type === 'conditional' && condition === undefined) {
        condition = this.parseCondition();
      } else {
        break;
      }
    }
    this.consumeOptional('semicolon');

    const command: Command = {
      verb: createVerbRef(verbName, verbId),
      subject: createSubjectRef(subjectName, subjectId),
      params,
      modifiers,
      time,
      condition,
    };

    return spanned<StatementKind>({ kind: 'Command', command }, start);
  }

  private parseParams(): Parametro[] {
    this.expect('openBracket');
    const params: Parametro[] = [];
    if (!this.check('closeBracket')) {
      while (true) {
        params.push(this.parseParam());
        if (!this.consumeOptional('comma')) break;
      }
    }
    this.expect('closeBracket');
    return params;
  }

  private parseParam(): Parametro {
    const t = this.peekToken();
    switch (t.type) {
      case 'integer':
        this.advance();
        return { kind: 'Integer', value: t.value };
      case 'number':
        this.advance();
        return { kind: 'Number', value: t.value };
      case 'string':
        this.advance();
        return { kind: 'String', value: t.value };
      case 'hertz':
        this.advance();
        return { kind: 'Hertz', value: t.value };
      case 'reference':
        this.advance();
        return { kind: 'Reference', value: t.value };
      case 'identifier': {
        const name = t.value;
        this.advance();
        if (this.check('colon')) {
          this.advance();
          const value = this.parseParam();
          return {
            kind: 'KeyValue',
            value: { key: name, value },
          };
        }
        return { kind: 'Identifier', value: name };
      }
      case 'openBracket': {
        this.advance();
        const items: Parametro[] = [];
        if (!this.check('closeBracket')) {
          while (true) {
            items.push(this.parseParam());
            if (!this.consumeOptional('comma')) break;
          }
        }
        this.expect('closeBracket');
        return { kind: 'Array', value: items };
      }
      default:
        throw this.errAtCurrent(`se esperaba parámetro, se encontró ${tokenKindName(t)}`);
    }
  }

  private parseModifier(): Modificador {
    const t = this.peekToken();
    if (t.type !== 'modifier') {
      throw this.errAtCurrent('se esperaba modificador');
    }
    this.advance();
    const name = t.value;
    switch (name) {
      case 'pulso':
        return { kind: 'Pulse' };
      case 'aire': {
        this.expect('colon');
        const value = this.expectInteger();
        return { kind: 'Air', value };
      }
      case 'curva': {
        this.expect('colon');
        return { kind: 'Curve', value: this.expectIdentifier() };
      }
      case 'hover': {
        this.expect('colon');
        return { kind: 'Hover', value: this.expectIdentifier() };
      }
      case 'esencia':
        return { kind: 'Esence', value: '' };
      default:
        return { kind: 'Custom', key: name };
    }
  }

  private parseTime(): Tiempo {
    const t = this.peekToken();
    if (t.type !== 'reference') {
      throw this.errAtCurrent('se esperaba tiempo (@)');
    }
    this.advance();
    const name = t.value;
    switch (name) {
      case 'now':
        return { kind: 'Now' };
      case 'after': {
        this.expect('colon');
        return { kind: 'Delayed', seconds: this.expectNumber() };
      }
      case 'at': {
        this.expect('colon');
        return { kind: 'Scheduled', when: this.expectString() };
      }
      default:
        return { kind: 'Custom', value: name };
    }
  }

  private parseCondition(): Condicion {
    const t = this.peekToken();
    if (t.type !== 'conditional') {
      throw this.errAtCurrent('se esperaba condición (?)');
    }
    this.advance();
    const name = t.value;
    if (name === 'bateria_baja') {
      return { kind: 'BatteryLow' };
    }
    return { kind: 'Custom', value: name };
  }

  // ---- Layouts ----

  private parseLayout(start: Span): Statement {
    const glyph = this.peekToken().type;
    this.advance();
    let nCols: number | undefined;
    if (this.consumeOptional('colon')) {
      nCols = this.expectInteger();
      this.consumeOptional('colon');
    }
    const cells: LayoutCell[] = [this.parseLayoutCell()];
    while (this.consumeOptional('bar')) {
      cells.push(this.parseLayoutCell());
    }
    let layout: LayoutExpr;
    if (glyph === 'glyphVertical' && nCols !== undefined) {
      layout = { kind: 'WithColumns', n: nCols, cells };
    } else if (glyph === 'glyphVertical') {
      layout = { kind: 'Vertical', cells };
    } else if (glyph === 'glyphHorizontal') {
      layout = { kind: 'Horizontal', cells };
    } else {
      throw this.errAtCurrent('glifo de layout inválido');
    }
    return spanned<StatementKind>({ kind: 'Layout', layout }, start);
  }

  private parseLayoutCell(): LayoutCell {
    const content = this.parseCommand();
    return { content };
  }

  private parseLayoutMap(start: Span): Statement {
    this.expect('glyphMap');
    this.expect('openBracket');
    const sections: LayoutSection[] = [this.parseLayoutSection()];
    while (this.consumeOptional('slash')) {
      sections.push(this.parseLayoutSection());
    }
    this.expect('closeBracket');
    const map: LayoutMap = { sections };
    return spanned<StatementKind>({ kind: 'LayoutMap', map }, start);
  }

  private parseLayoutSection(): LayoutSection {
    if (this.check('openBracket')) {
      this.advance();
      const children: LayoutSection[] = [this.parseLayoutSection()];
      while (this.consumeOptional('slash')) {
        children.push(this.parseLayoutSection());
      }
      this.expect('closeBracket');
      return { name: '(grupo)', children, isLeaf: false };
    }
    const name = this.expectIdentifier();
    return { name, children: [], isLeaf: true };
  }

  // ---- Helpers de navegación ----

  private peekToken(): Token {
    return this.tokens[this.pos].token;
  }

  private currentSpan(): Span {
    return this.tokens[this.pos].span;
  }

  private advance(): void {
    if (this.pos < this.tokens.length - 1) this.pos++;
  }

  private check(expected: Token['type']): boolean {
    return this.peekToken().type === expected;
  }

  private checkKeyword(kw: string): boolean {
    const t = this.peekToken();
    return t.type === 'identifier' && t.value.toLowerCase() === kw.toLowerCase();
  }

  private checkEof(): boolean {
    return this.peekToken().type === 'eof';
  }

  private peekIdentifier(): string | null {
    const t = this.peekToken();
    return t.type === 'identifier' ? t.value : null;
  }

  private expect(expected: Token['type']): void {
    if (this.check(expected)) {
      this.advance();
    } else {
      throw this.errAtCurrent(
        `se esperaba ${expected}, se encontró ${tokenKindName(this.peekToken())}`
      );
    }
  }

  private expectKeyword(kw: string): void {
    if (this.checkKeyword(kw)) {
      this.advance();
    } else {
      throw this.errAtCurrent(`se esperaba '${kw}'`);
    }
  }

  private expectIdentifier(): string {
    const t = this.peekToken();
    if (t.type === 'identifier') {
      this.advance();
      return t.value;
    }
    throw this.errAtCurrent(`se esperaba identificador, se encontró ${tokenKindName(t)}`);
  }

  private expectNumber(): number {
    const t = this.peekToken();
    if (t.type === 'number' || t.type === 'integer') {
      this.advance();
      return t.value;
    }
    throw this.errAtCurrent(`se esperaba número, se encontró ${tokenKindName(t)}`);
  }

  private expectInteger(): number {
    const t = this.peekToken();
    if (t.type === 'integer') {
      this.advance();
      return t.value;
    }
    if (t.type === 'number') {
      this.advance();
      return Math.trunc(t.value);
    }
    throw this.errAtCurrent(`se esperaba entero, se encontró ${tokenKindName(t)}`);
  }

  private expectString(): string {
    const t = this.peekToken();
    if (t.type === 'string') {
      this.advance();
      return t.value;
    }
    throw this.errAtCurrent(`se esperaba string, se encontró ${tokenKindName(t)}`);
  }

  private expectRelationalOp(): RelationalOp {
    const t = this.peekToken();
    let op: RelationalOp;
    switch (t.type) {
      case 'gte':
        op = 'Gte';
        break;
      case 'lte':
        op = 'Lte';
        break;
      case 'gt':
        op = 'Gt';
        break;
      case 'lt':
        op = 'Lt';
        break;
      case 'eq':
        op = 'Eq';
        break;
      case 'neq':
        op = 'Neq';
        break;
      default:
        throw this.errAtCurrent(
          `se esperaba operador relacional, se encontró ${tokenKindName(t)}`
        );
    }
    this.advance();
    return op;
  }

  private consumeOptional(expected: Token['type']): boolean {
    if (this.check(expected)) {
      this.advance();
      return true;
    }
    return false;
  }

  private skipNewlines(): void {
    while (this.check('newline') || this.check('comment')) {
      this.advance();
    }
  }

  private errAtCurrent(msg: string): ParseError {
    return new ParseError(msg, this.currentSpan());
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function isV2Kind(kind: StatementKind): boolean {
  switch (kind.kind) {
    case 'HeaderField':
    case 'Invariant':
    case 'Frequencies':
    case 'Topology':
    case 'CausalNode':
    case 'CausalOrder':
    case 'Resonance':
    case 'Trajectory':
    case 'Harmonics':
    case 'Residue':
    case 'Weights':
      return true;
    default:
      return false;
  }
}

// Facade
export function parse(input: string): Rima {
  return ParserV2.parse(input);
}
