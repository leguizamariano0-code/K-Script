// Módulo `ast`: Árbol de Sintaxis Abstracta de K-Script y `.koko` v2.0.
//
// Contrato formal entre el parser v2.0 y el evaluador v2.0 en TypeScript.
// Espejo fiel de `korivm/src/kscript/ast.rs`.
//
// Diseño:
// - Independiente de `dictionary.ts` (no lo importa).
// - Los `canonicalId` se rellenan en el parser usando `dictionary.ts`.
// - Soporta gramática K-Script v1.1 (commands, pipelines, layouts) y
//   `.koko` v2.0 (5 capas ontológicas: cabecera, topológicos, causal,
//   resonancia, residuo).
// - Cada nodo puede llevar `Span` para mensajes de error precisos.

export type Vector8 = [number, number, number, number, number, number, number, number];

/// Posición en el archivo fuente para mensajes de error.
export interface Span {
  line: number;
  col: number;
  offset: number;
  len: number;
}

export function createSpan(line: number, col: number, offset: number, len: number): Span {
  return { line, col, offset, len };
}

export function spanZero(): Span {
  return { line: 0, col: 0, offset: 0, len: 0 };
}

/// Nodo con su posición en fuente.
export interface Spanned<T> {
  node: T;
  span: Span;
}

export function spanned<T>(node: T, span: Span): Spanned<T> {
  return { node, span };
}

export function synthetic<T>(node: T): Spanned<T> {
  return { node, span: spanZero() };
}

// ============================================================================
// REFERENCIAS A VERBO Y SUJETO (resueltas contra el diccionario)
// ============================================================================

/// Referencia a un verbo del diccionario.
export interface VerbRef {
  rawName: string;
  canonicalId: number | null;
}

export function createVerbRef(rawName: string, canonicalId: number | null): VerbRef {
  return { rawName, canonicalId };
}

export function isVerbKnown(verb: VerbRef): boolean {
  return verb.canonicalId !== null;
}

/// Referencia a un sujeto del diccionario.
export interface SubjectRef {
  rawName: string;
  canonicalId: number | null;
}

export function createSubjectRef(rawName: string, canonicalId: number | null): SubjectRef {
  return { rawName, canonicalId };
}

export function isSubjectKnown(subject: SubjectRef): boolean {
  return subject.canonicalId !== null;
}

// ============================================================================
// VALORES Y PARÁMETROS
// ============================================================================

export type BinaryOperator = 'Add' | 'Subtract' | 'Concat';

/// Parámetro con nombre: `key: value`.
export interface NamedParam {
  key: string;
  value: Parametro;
}

/// Un valor literal o calculado dentro de un parámetro.
export type Parametro =
  | { kind: 'Number'; value: number }
  | { kind: 'Integer'; value: number }
  | { kind: 'String'; value: string }
  | { kind: 'Identifier'; value: string }
  | { kind: 'Hertz'; value: number }
  | { kind: 'Reference'; value: string }
  | { kind: 'Array'; value: Parametro[] }
  | { kind: 'KeyValue'; value: NamedParam }
  | { kind: 'BinaryOp'; op: BinaryOperator; left: Parametro; right: Parametro };

// ============================================================================
// MODIFICADORES
// ============================================================================

/// Modificador que se aplica a un comando.
export type Modificador =
  | { kind: 'Pulse' }
  | { kind: 'Tooltip'; value: string }
  | { kind: 'Hover'; value: string }
  | { kind: 'Air'; value: number }
  | { kind: 'Curve'; value: string }
  | { kind: 'Esence'; value: string }
  | { kind: 'Custom'; key: string; value?: string };

// ============================================================================
// TIEMPO Y CONDICIÓN (@time, ?condition)
// ============================================================================

/// Calificador temporal.
export type Tiempo =
  | { kind: 'Now' }
  | { kind: 'Delayed'; seconds: number }
  | { kind: 'Scheduled'; when: string }
  | { kind: 'Custom'; value: string };

/// Condición de ejecución.
export type Condicion =
  | { kind: 'BatteryLow' }
  | { kind: 'SensorAbove'; sensor: string; threshold: number }
  | { kind: 'Custom'; value: string };

// ============================================================================
// COMANDOS Y LAYOUTS
// ============================================================================

/// Comando básico: `Verbo: Sujeto[params] modifiers @time ?cond`
export interface Command {
  verb: VerbRef;
  subject: SubjectRef;
  params: Parametro[];
  modifiers: Modificador[];
  time?: Tiempo;
  condition?: Condicion;
}

/// Celda dentro de un layout.
export interface LayoutCell {
  content: Statement;
  weight?: number;
}

/// Tipo de layout.
export type LayoutExpr =
  | { kind: 'Vertical'; cells: LayoutCell[] }
  | { kind: 'Horizontal'; cells: LayoutCell[] }
  | { kind: 'WithColumns'; n: number; cells: LayoutCell[] };

/// Sección dentro de un mapa de layout (`🗺️[...]`).
export interface LayoutSection {
  name: string;
  children: LayoutSection[];
  isLeaf: boolean;
}

/// Mapa de layout completo (`🗺️[Header / Body / Footer]`).
export interface LayoutMap {
  sections: LayoutSection[];
}

// ============================================================================
// KOKO v2.0 — CAPAS ONTOLÓGICAS
// ============================================================================

/// Operador relacional en invariantes.
export type RelationalOp = 'Gte' | 'Lte' | 'Gt' | 'Lt' | 'Eq' | 'Neq';

export function formatRelationalOp(op: RelationalOp): string {
  switch (op) {
    case 'Gte':
      return '>=';
    case 'Lte':
      return '<=';
    case 'Gt':
      return '>';
    case 'Lt':
      return '<';
    case 'Eq':
      return '==';
    case 'Neq':
      return '!=';
  }
}

/// Invariante constitucional: `INVARIANT: Etica >= 0.85`
export interface InvariantExpr {
  subject: string;
  op: RelationalOp;
  value: number;
}

/// Item topológico de la Capa 1: `Nombre[Hello World]`
export interface TopologyItem {
  key: string;
  value: Parametro;
}

/// Nodo del grafo causal (Capa 2).
export interface CausalNode {
  id: string;
  dependsOn: string[];
  operator?: string;
  params: NamedParam[];
}

/// Punto de trayectoria emocional (Capa 3): `t0.5[vec8]`
export interface TrajectoryPoint {
  t: number;
  vector: Vector8;
}

/// Entrada armónica (Capa 3): `528[Reparacion]`
export interface HarmonicEntry {
  freqHz: number;
  label: string;
}

/// Bloque de pesos de reconstrucción.
export interface WeightsBlock {
  topologicos: number;
  causales: number;
  resonancia: number;
  interferencia: number;
}

/// Valida que los 4 pesos sumen ~1.0 (± 1e-6).
export function validateWeightsSum(
  weights: WeightsBlock
): { ok: true } | { ok: false; error: string } {
  const sum =
    weights.topologicos +
    weights.causales +
    weights.resonancia +
    weights.interferencia;
  if (Math.abs(sum - 1.0) > 1e-6) {
    return {
      ok: false,
      error: `PESOS_RECONSTRUCCION deben sumar 1.0 (suma actual: ${sum.toFixed(6)})`,
    };
  }
  return { ok: true };
}

// ============================================================================
// STATEMENT (nodo unificado del AST)
// ============================================================================

/// Un statement de K-Script o de `.koko` v2.0.
export type StatementKind =
  // ---- K-Script v1.1 ----
  | { kind: 'Command'; command: Command }
  | { kind: 'Pipeline'; statements: Statement[] }
  | { kind: 'Layout'; layout: LayoutExpr }
  | { kind: 'LayoutMap'; map: LayoutMap }
  | { kind: 'Comment'; text: string }

  // ---- Koko v2.0 — Capa 0 ----
  | { kind: 'HeaderField'; key: string; value: Parametro }
  | { kind: 'Invariant'; invariant: InvariantExpr }
  | { kind: 'Frequencies'; frequencies: number[] }

  // ---- Koko v2.0 — Capa 1 ----
  | { kind: 'Topology'; items: TopologyItem[] }

  // ---- Koko v2.0 — Capa 2 ----
  | { kind: 'CausalNode'; node: CausalNode }
  | { kind: 'CausalOrder'; order: string[] }

  // ---- Koko v2.0 — Capa 3 ----
  | { kind: 'Resonance'; vector: Vector8 }
  | { kind: 'Trajectory'; points: TrajectoryPoint[] }
  | { kind: 'Harmonics'; entries: HarmonicEntry[] }

  // ---- Koko v2.0 — Capa 4 ----
  | { kind: 'Residue'; params: NamedParam[] }

  // ---- Koko v2.0 — Pesos ----
  | { kind: 'Weights'; weights: WeightsBlock };

/// Un statement con su span.
export type Statement = Spanned<StatementKind>;

// ============================================================================
// RIMA — RAÍZ DEL AST
// ============================================================================

/// Versión del archivo fuente.
export type FileVersion = 'KScriptV11' | 'KokoV20' | 'Mixed' | 'Unknown';

/// Archivo `.koko` o script K-Script completo.
export interface Rima {
  name: string;
  statements: Statement[];
  version: FileVersion;
}

/// Estadísticas de un archivo.
export interface RimaStats {
  knownVerbs: number;
  unknownVerbs: string[];
  unknownSubjects: string[];
}

export function createRima(name: string, version: FileVersion = 'Unknown'): Rima {
  return {
    name,
    statements: [],
    version,
  };
}

function collectCommandsIn(stmt: Statement, acc: Command[]): void {
  const node = stmt.node;
  switch (node.kind) {
    case 'Command':
      acc.push(node.command);
      break;
    case 'Pipeline':
      for (const inner of node.statements) {
        collectCommandsIn(inner, acc);
      }
      break;
    case 'Layout':
      for (const cell of node.layout.cells) {
        collectCommandsIn(cell.content, acc);
      }
      break;
    default:
      break;
  }
}

/// Devuelve todos los commands del archivo (incluyendo nested en pipelines y layouts).
export function iterCommands(rima: Rima): Command[] {
  const commands: Command[] = [];
  for (const stmt of rima.statements) {
    collectCommandsIn(stmt, commands);
  }
  return commands;
}

/// Cuenta cuántos verbos conocidos y desconocidos hay en una Rima.
export function rimaStats(rima: Rima): RimaStats {
  const stats: RimaStats = {
    knownVerbs: 0,
    unknownVerbs: [],
    unknownSubjects: [],
  };

  for (const cmd of iterCommands(rima)) {
    if (isVerbKnown(cmd.verb)) {
      stats.knownVerbs += 1;
    } else {
      stats.unknownVerbs.push(cmd.verb.rawName);
    }
    if (!isSubjectKnown(cmd.subject)) {
      stats.unknownSubjects.push(cmd.subject.rawName);
    }
  }

  return stats;
}
