// Suite de paridad TS <-> Rust para `src/kscript/evaluatorV2.ts`
// Replica los 13 tests de `korivm/src/kscript/evaluator.rs`.

import assert from 'node:assert/strict';
import { ParserV2 } from '../src/kscript/parserV2';
import {
  Evaluator,
  EvalError,
  normalizeSolfeggio,
  type EvalErrorDetail,
  type EvaluationResult,
} from '../src/kscript/evaluatorV2';

let passed = 0;

function run(label: string, fn: () => void): void {
  fn();
  passed++;
  console.log(`  ✅ ${label}`);
}

function assertNear(actual: number, expected: number, eps: number): void {
  assert.ok(
    Math.abs(actual - expected) < eps,
    `expected ${expected}±${eps}, got ${actual}`
  );
}

function evalSrc(src: string): EvaluationResult {
  return Evaluator.evaluate(ParserV2.parse(src));
}

function assertEvalErrorKind(src: string, expectedKind: EvalErrorDetail['kind']): void {
  assert.throws(
    () => evalSrc(src),
    (err: unknown) => err instanceof EvalError && err.detail.kind === expectedKind
  );
}

// T1: programa vacío → estado por defecto
run('T1: test_empty_program', () => {
  const r = evalSrc('RIMA: vacio\n');
  assertNear(r.finalState[4], 0.85, 1e-9);
  assert.equal(r.invariantsPreserved, true);
});

// T2: hello_world.koko completo
run('T2: test_hello_world_koko', () => {
  const src = `RIMA: HelloWorld_v2
VERSION: "2.0.0-hello"
AUTOR: "Mariano_Leguiza"
INVARIANT: Etica >= 0.85
INVARIANT: Incertidumbre <= 0.50
FRECUENCIAS: 0.174 | 0.285 | 0.396 | 0.417 | 0.432 | 0.528 | 0.639 | 0.741 | 0.852 | 0.963
TOPOLOGICOS: Nombre["Hello World Fractal"] | Genero[Visualizador]
RESONANCIA: Vector[0.4, 0.15, 0.5, 0.2, 0.95, 0.1, 0.528, 0.08]
PESOS: Topologicos[0.30] | Causales[0.00] | Resonancia[0.70] | Interferencia[0.00]`;
  const r = evalSrc(src);
  assertNear(r.finalState[0], 0.4, 1e-9);
  assertNear(r.finalState[6], 0.528, 1e-9);
  assert.ok(r.finalState[4] >= 0.85);
  assert.ok(r.poincareNorm < 0.999);
  assert.ok(r.weights !== undefined);
  assert.equal(r.topology.size, 2);
});

// T3: comando con Hz (alias Armonizar -> Modular)
run('T3: test_command_with_hz', () => {
  const r = evalSrc('Armonizar: Suelo_Biotico[528Hz]');
  assertNear(r.finalState[6], 0.5, 1e-9);
  assert.ok(r.finalState[4] >= 0.85);
});

// T4: Visualizar retorna Effect(render)
run('T4: test_command_visualizar_returns_effect', () => {
  const r = evalSrc('Visualizar: Lienzo_Espacial');
  assert.equal(r.lastValue.kind, 'Effect');
  if (r.lastValue.kind === 'Effect') {
    assert.equal(r.lastValue.effectType, 'render');
  }
});

// T5: Pipeline
run('T5: test_pipeline', () => {
  const r = evalSrc('Sentir: Clima_termica >> Visualizar: Lienzo');
  assert.equal(r.lastValue.kind, 'Effect');
  if (r.lastValue.kind === 'Effect') {
    assert.equal(r.lastValue.effectType, 'render');
  }
});

// T6: invariante ética (forzado a >= 0.85 por Resonance)
run('T6: test_invariant_violation_ethics', () => {
  const r = evalSrc(`RIMA: bad
INVARIANT: Etica >= 0.85
RESONANCIA: Vector[0.4, 0.15, 0.5, 0.2, 0.5, 0.1, 0.528, 0.08]`);
  assert.ok(r.finalState[4] >= 0.85);
});

// T7: invariante incertidumbre violado
run('T7: test_invariant_violation_uncertainty', () => {
  assertEvalErrorKind(
    `RIMA: bad
INVARIANT: Incertidumbre <= 0.50
RESONANCIA: Vector[0.4, 0.15, 0.5, 0.2, 0.95, 0.1, 0.528, 0.9]`,
    'InvariantViolation'
  );
});

// T8: proyección Poincaré
run('T8: test_poincare_projection', () => {
  const r = evalSrc(`RIMA: outside
RESONANCIA: Vector[5.0, 5.0, 5.0, 5.0, 0.95, 0.1, 0.528, 0.08]`);
  assert.ok(r.poincareNorm < 0.999);
});

// T9: weights inválidos rechazados en evaluator
run('T9: test_weights_invalid_rejected', () => {
  assertEvalErrorKind(
    `RIMA: bad_weights
PESOS: Topologicos[0.5] | Causales[0.5] | Resonancia[0.5] | Interferencia[0.5]`,
    'WeightsInvalid'
  );
});

// T10: verbo desconocido
run('T10: test_unknown_verb_rejected', () => {
  assertEvalErrorKind('InventadoXYZ: Suelo_Biotico', 'UnknownVerb');
});

// T11: normalizeSolfeggio
run('T11: test_solfeggio_normalization', () => {
  assertNear(normalizeSolfeggio(174.0), 0.0, 1e-9);
  assertNear(normalizeSolfeggio(528.0), 0.5, 1e-9);
  assertNear(normalizeSolfeggio(963.0), 1.0, 1e-9);
  assertNear(normalizeSolfeggio(500.0), 0.5, 1e-9);
});

// T12: ética desde metadata del verbo (Guardar: floor 0.92)
run('T12: test_ethics_floor_from_verb', () => {
  const r = evalSrc('Guardar: Archivo_Imagen');
  assert.ok(r.finalState[4] >= 0.92);
});

// T13: history grabada
run('T13: test_history_recorded', () => {
  const r = evalSrc('Armonizar: Suelo_Biotico[528Hz]');
  assert.ok(r.history.length > 0);
  assert.ok(r.history.some((h) => h.includes('exec:')));
});

console.log(`\nEVALUATOR_V2_PARITY: ${passed}/${passed} passed`);
