// Tipos y AST formal de K-Script para el motor TypeScript/React

export type OntologicalDomain = 
  | 'Biotic'
  | 'Cognitive'
  | 'Harmonic'
  | 'Physical'
  | 'Cryptographic'
  | 'Systemic'
  | 'Creative';

export interface VerbDef {
  name: string;
  isCore: boolean;
  domain: OntologicalDomain;
  causalImpact: number;
  ethicalFloor: number;
  energyCost: number;
  description: string;
}

export interface SubjectDef {
  name: string;
  domain: OntologicalDomain;
  defaultFreqHz?: number;
  baseResilience: number;
  description: string;
}

export type ErrorCode = 
  | 'E001_UNEXPECTED_TOKEN'
  | 'E002_UNKNOWN_VERB'
  | 'E003_UNKNOWN_SUBJECT'
  | 'E004_UNBALANCED_BRACKETS'
  | 'E005_INVALID_PARAM'
  | 'E006_UNTERMINATED_STRING'
  | 'E007_EXPECTED_COLON'
  | 'E008_EMPTY_PROGRAM'
  | 'E009_INVALID_FREQUENCY'
  | 'E010_LYAPUNOV_DIVERGENCE'
  | 'E011_POINCARE_VIOLATION';

export interface KScriptError {
  code: ErrorCode;
  message: string;
  line: number;
  column: number;
  suggestion?: string;
}

export type TokenKind = 
  | { type: 'IDENTIFIER'; value: string }
  | { type: 'STRING_LITERAL'; value: string }
  | { type: 'NUMBER'; value: number }
  | { type: 'FREQUENCY'; value: number }
  | { type: 'COLON' }
  | { type: 'BRACKET_OPEN' }
  | { type: 'BRACKET_CLOSE' }
  | { type: 'PIPE' }
  | { type: 'PIPELINE_ARROW' }
  | { type: 'TILDE' }
  | { type: 'EXCLAMATION' }
  | { type: 'AT' }
  | { type: 'COMMA' }
  | { type: 'SEMICOLON' }
  | { type: 'COMMENT'; value: string }
  | { type: 'NEWLINE' }
  | { type: 'EOF' };

export interface Token {
  kind: TokenKind;
  line: number;
  column: number;
  raw: string;
}

export interface ModifierNode {
  symbol: string;
  description: string;
}

export type ValueNode = 
  | { type: 'Number'; value: number }
  | { type: 'Frequency'; value: number }
  | { type: 'Text'; value: string }
  | { type: 'Identifier'; value: string }
  | { type: 'Vector'; value: number[] }
  | { type: 'Boolean'; value: boolean };

export interface ParamNode {
  key: string;
  value: ValueNode;
}

export interface CommandNode {
  verb: string;
  subject: string;
  modifier?: ModifierNode;
  params: ParamNode[];
  line: number;
  column: number;
}

export interface PipelineNode {
  steps: CommandNode[];
}

export interface ParallelNode {
  branches: CommandNode[];
}

export type Statement = 
  | { type: 'Command'; command: CommandNode }
  | { type: 'Pipeline'; pipeline: PipelineNode }
  | { type: 'Parallel'; parallel: ParallelNode }
  | { type: 'Header'; key: string; value: string }
  | { type: 'Comment'; value: string };

export interface KScriptProgram {
  statements: Statement[];
}

export interface ExecutionTrace {
  statementIndex: number;
  description: string;
  inputVector: [number, number, number, number, number, number, number, number];
  finalVector: [number, number, number, number, number, number, number, number];
  normFinal: number;
  ethicalScore: number;
  resonanceScore: number;
  isStable: boolean;
}

export interface KScriptEvaluationResult {
  initialState: [number, number, number, number, number, number, number, number];
  finalState: [number, number, number, number, number, number, number, number];
  traces: ExecutionTrace[];
  trajectory: Array<[number, number, number, number, number, number, number, number]>;
  lyapunovStable: boolean;
  allInvariantsPreserved: boolean;
}
