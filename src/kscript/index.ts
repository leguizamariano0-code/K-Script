export * from './types';
export * from './dictionary';
export * from './lexer';
export * from './parser';
export * from './evaluator';

import { KScriptParser } from './parser';
import { KScriptEvaluator } from './evaluator';
import { KScriptEvaluationResult, KScriptError, KScriptProgram } from './types';

export function executeKScript(
  source: string,
  initialState?: [number, number, number, number, number, number, number, number]
): { result?: KScriptEvaluationResult; error?: KScriptError } {
  const parseRes = KScriptParser.parse(source);
  if (parseRes.error) return { error: parseRes.error };
  return KScriptEvaluator.evaluate(parseRes.program!, initialState);
}

export function validateKScript(source: string): { program?: KScriptProgram; error?: KScriptError } {
  return KScriptParser.parse(source);
}

// ---- K-Script v2.0 (namespace aislado) ----
// Expone el pipeline completo `ast + lexerV2 + parserV2 + evaluatorV2`
// bajo `kScriptV2` sin colisionar con los exports v1.1 (`Statement`,
// `KScriptProgram`, `CommandNode`, etc.).
export * as kScriptV2 from './indexV2';

