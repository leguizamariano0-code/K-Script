// Módulo `indexV2`: Barrel del pipeline K-Script / .koko v2.0.
// Se expone desde `src/kscript/index.ts` bajo el namespace `kScriptV2` para no
// colisionar con los exports v1.1 (`Statement`, `KScriptProgram`, `CommandNode`, etc.).
//
// Uso:
//   import { kScriptV2 } from './kscript';
//   const rima = kScriptV2.parse(src);
//   const result = kScriptV2.evaluate(rima);

// ---- AST v2.0 (contrato de datos) ----
export type {
  Span,
  Spanned,
  VerbRef,
  SubjectRef,
  NamedParam,
  Parametro,
  BinaryOperator,
  Modificador,
  Tiempo,
  Condicion,
  Command,
  LayoutCell,
  LayoutExpr,
  LayoutSection,
  LayoutMap,
  RelationalOp,
  InvariantExpr,
  TopologyItem,
  CausalNode,
  TrajectoryPoint,
  HarmonicEntry,
  WeightsBlock,
  Vector8,
  StatementKind,
  Statement,
  FileVersion,
  Rima,
  RimaStats,
} from './ast';

export {
  createSpan,
  spanZero,
  spanned,
  synthetic,
  createVerbRef,
  createSubjectRef,
  isVerbKnown,
  isSubjectKnown,
  formatRelationalOp,
  validateWeightsSum,
  createRima,
  iterCommands,
  rimaStats,
} from './ast';

// ---- Diccionario v2.0 ----
export {
  DOMAIN_BASE_VECTORS_V2,
  KSCRIPT_VERBS,
  KSCRIPT_VERB_ALIASES,
  KSCRIPT_SUBJECTS,
  domainBaseVector,
  findVerb,
  resolveCanonicalId,
  findSubject,
  resolveSubjectId,
  getCoreVerbs,
  suggestVerb,
  suggestSubject,
} from './dictionary';

// ---- Lexer v2.0 ----
export type {
  Token,
  Token as TokenV2,
  SpannedToken,
  SpannedToken as SpannedTokenV2,
} from './lexerV2';
export {
  Lexer,
  Lexer as LexerV2,
  LexError,
  tokenize,
  tokenize as tokenizeV2,
  tokenKindName,
} from './lexerV2';

// ---- Parser v2.0 ----
export { ParserV2, ParseError, parse, parse as parseV2 } from './parserV2';

// ---- Evaluator v2.0 ----
export type {
  Value,
  EvalErrorDetail,
  ExecutionContext,
  EvaluationResult,
} from './evaluatorV2';

export {
  Evaluator,
  EvalError,
  evaluate,
  evaluate as evaluateV2,
  createContext,
  normalizeSolfeggio,
  valueKindName,
} from './evaluatorV2';
