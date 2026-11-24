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

// T14: Lote 1 de 10 verbos no-core
run('T14: test_lote1_non_core_verbs', () => {
  const rCrear = evalSrc('Crear: Bio_Matriz');
  assert.equal(rCrear.lastValue.kind, 'Effect');
  if (rCrear.lastValue.kind === 'Effect') {
    assert.equal(rCrear.lastValue.effectType, 'create');
  }
  assertNear(rCrear.finalState[0], 0.1, 1e-9);

  const rDestruir = evalSrc('Destruir: Bio_Matriz');
  assert.equal(rDestruir.lastValue.kind, 'Effect');
  if (rDestruir.lastValue.kind === 'Effect') {
    assert.equal(rDestruir.lastValue.effectType, 'destroy');
  }
  assertNear(rDestruir.finalState[0], -0.1, 1e-9);

  const rMover = evalSrc('Mover: Bio_Matriz');
  assert.equal(rMover.lastValue.kind, 'Effect');
  if (rMover.lastValue.kind === 'Effect') {
    assert.equal(rMover.lastValue.effectType, 'move');
  }
  assertNear(rMover.finalState[2], 0.05, 1e-9);

  const rCopiar = evalSrc('Copiar: Bio_Matriz');
  assert.equal(rCopiar.lastValue.kind, 'Effect');
  if (rCopiar.lastValue.kind === 'Effect') {
    assert.equal(rCopiar.lastValue.effectType, 'copy');
  }
  assertNear(rCopiar.finalState[5], 0.0275, 1e-9);

  const rPegar = evalSrc('Pegar: Bio_Matriz');
  assert.equal(rPegar.lastValue.kind, 'Effect');
  if (rPegar.lastValue.kind === 'Effect') {
    assert.equal(rPegar.lastValue.effectType, 'paste');
  }
  assertNear(rPegar.finalState[0], 0.02, 1e-9);

  const rFiltrar = evalSrc(
    'RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.1, 0.5, 0.5]\nFiltrar: Senal'
  );
  assert.equal(rFiltrar.lastValue.kind, 'Vector8');
  assertNear(rFiltrar.finalState[7], 0.45, 1e-9);

  const rOrdenar = evalSrc(
    'RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.1, 0.5, 0.5]\nOrdenar: Senal'
  );
  assert.equal(rOrdenar.lastValue.kind, 'Vector8');
  assertNear(rOrdenar.finalState[7], 0.4, 1e-9);

  const rAgrupar = evalSrc('Agrupar: Bio_Matriz');
  assert.equal(rAgrupar.lastValue.kind, 'Vector8');
  assertNear(rAgrupar.finalState[2], 0.03, 1e-9);

  const rAbrir = evalSrc('Abrir: Canal_Local');
  assert.equal(rAbrir.lastValue.kind, 'Effect');
  if (rAbrir.lastValue.kind === 'Effect') {
    assert.equal(rAbrir.lastValue.effectType, 'open');
  }
  assertNear(rAbrir.finalState[1], 0.05, 1e-9);

  const rCerrar = evalSrc('Cerrar: Canal_Local');
  assert.equal(rCerrar.lastValue.kind, 'Effect');
  if (rCerrar.lastValue.kind === 'Effect') {
    assert.equal(rCerrar.lastValue.effectType, 'close');
  }
  assertNear(rCerrar.finalState[1], -0.05, 1e-9);
});

// T15: Lote 2 de 10 verbos no-core
run('T15: test_lote2_non_core_verbs', () => {
  const rBuscar = evalSrc(
    'RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.1, 0.5, 0.5]\nBuscar: Senal'
  );
  assert.equal(rBuscar.lastValue.kind, 'Vector8');
  assertNear(rBuscar.finalState[1], 0.15, 1e-9);
  assertNear(rBuscar.finalState[7], 0.45, 1e-9);

  const rAnalizar = evalSrc(
    'RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.1, 0.5, 0.5]\nAnalizar: Senal'
  );
  assert.equal(rAnalizar.lastValue.kind, 'Vector8');
  assertNear(rAnalizar.finalState[7], 0.4, 1e-9);

  const rComparar = evalSrc(
    'RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.1, 0.5, 0.5]\nComparar: Senal'
  );
  assert.equal(rComparar.lastValue.kind, 'Vector8');
  assertNear(rComparar.finalState[3], 0.14, 1e-9);
  assertNear(rComparar.finalState[7], 0.48, 1e-9);

  const rPredecir = evalSrc('Predecir: Bio_Matriz');
  assert.equal(rPredecir.lastValue.kind, 'Effect');
  if (rPredecir.lastValue.kind === 'Effect') {
    assert.equal(rPredecir.lastValue.effectType, 'predict');
  }
  assertNear(rPredecir.finalState[1], 0.1, 1e-9);
  assertNear(rPredecir.finalState[3], 0.08, 1e-9);

  const rEstilizar = evalSrc('Estilizar: Bio_Matriz');
  assert.equal(rEstilizar.lastValue.kind, 'Effect');
  if (rEstilizar.lastValue.kind === 'Effect') {
    assert.equal(rEstilizar.lastValue.effectType, 'style');
  }
  assertNear(rEstilizar.finalState[0], 0.05, 1e-9);
  assertNear(rEstilizar.finalState[2], 0.02, 1e-9);

  const rDifuminar = evalSrc('Difuminar: Bio_Matriz');
  assert.equal(rDifuminar.lastValue.kind, 'Effect');
  if (rDifuminar.lastValue.kind === 'Effect') {
    assert.equal(rDifuminar.lastValue.effectType, 'blur');
  }
  assertNear(rDifuminar.finalState[7], 0.08, 1e-9);
  assertNear(rDifuminar.finalState[0], -0.02, 1e-9);

  const rSombrear = evalSrc('Sombrear: Bio_Matriz');
  assert.equal(rSombrear.lastValue.kind, 'Effect');
  if (rSombrear.lastValue.kind === 'Effect') {
    assert.equal(rSombrear.lastValue.effectType, 'shadow');
  }
  assertNear(rSombrear.finalState[5], 0.06, 1e-9);
  assertNear(rSombrear.finalState[2], 0.02, 1e-9);

  const rModelar = evalSrc('Modelar: Bio_Matriz');
  assert.equal(rModelar.lastValue.kind, 'Effect');
  if (rModelar.lastValue.kind === 'Effect') {
    assert.equal(rModelar.lastValue.effectType, 'model');
  }
  assertNear(rModelar.finalState[2], 0.1, 1e-9);
  assertNear(rModelar.finalState[0], 0.05, 1e-9);

  const rMapear = evalSrc('Mapear: Bio_Matriz');
  assert.equal(rMapear.lastValue.kind, 'Vector8');
  assertNear(rMapear.finalState[2], 0.05, 1e-9);
  assertNear(rMapear.finalState[3], 0.09, 1e-9);

  const rReflejar = evalSrc('Reflejar: Bio_Matriz');
  assert.equal(rReflejar.lastValue.kind, 'Effect');
  if (rReflejar.lastValue.kind === 'Effect') {
    assert.equal(rReflejar.lastValue.effectType, 'reflect');
  }
  assertNear(rReflejar.finalState[2], 0.05, 1e-9);
  assertNear(rReflejar.finalState[1], -0.02, 1e-9);
});

// T16: Lote 3 de 10 verbos no-core
run('T16: test_lote3_non_core_verbs', () => {
  const rEncriptar = evalSrc(
    'RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.1, 0.5, 0.5]\nEncriptar: Senal'
  );
  assert.equal(rEncriptar.lastValue.kind, 'Effect');
  if (rEncriptar.lastValue.kind === 'Effect') {
    assert.equal(rEncriptar.lastValue.effectType, 'encrypt');
  }
  assertNear(rEncriptar.finalState[7], 0.45, 1e-9);
  assertNear(rEncriptar.finalState[4], 0.97, 1e-9);

  const rDesencriptar = evalSrc(
    'RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.1, 0.5, 0.5]\nDesencriptar: Senal'
  );
  assert.equal(rDesencriptar.lastValue.kind, 'Effect');
  if (rDesencriptar.lastValue.kind === 'Effect') {
    assert.equal(rDesencriptar.lastValue.effectType, 'decrypt');
  }
  assertNear(rDesencriptar.finalState[7], 0.52, 1e-9);
  assertNear(rDesencriptar.finalState[3], 0.14, 1e-9);

  const rAutenticar = evalSrc(
    'RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.90, 0.1, 0.5, 0.5]\nAutenticar: Canal_Local'
  );
  assert.equal(rAutenticar.lastValue.kind, 'Effect');
  if (rAutenticar.lastValue.kind === 'Effect') {
    assert.equal(rAutenticar.lastValue.effectType, 'authenticate');
  }
  assertNear(rAutenticar.finalState[4], 1.0, 1e-9);
  assertNear(rAutenticar.finalState[7], 0.45, 1e-9);

  const rAutorizar = evalSrc('Autorizar: Bio_Matriz');
  assert.equal(rAutorizar.lastValue.kind, 'Effect');
  if (rAutorizar.lastValue.kind === 'Effect') {
    assert.equal(rAutorizar.lastValue.effectType, 'authorize');
  }
  assertNear(rAutorizar.finalState[3], 0.07, 1e-9);
  assertNear(rAutorizar.finalState[4], 0.95, 1e-9);

  const rVincular = evalSrc('Vincular: Bio_Matriz');
  assert.equal(rVincular.lastValue.kind, 'Effect');
  if (rVincular.lastValue.kind === 'Effect') {
    assert.equal(rVincular.lastValue.effectType, 'link');
  }
  assertNear(rVincular.finalState[2], 0.05, 1e-9);
  assertNear(rVincular.finalState[1], 0.02, 1e-9);

  const rCompartir = evalSrc('Compartir: Bio_Matriz');
  assert.equal(rCompartir.lastValue.kind, 'Effect');
  if (rCompartir.lastValue.kind === 'Effect') {
    assert.equal(rCompartir.lastValue.effectType, 'share');
  }
  assertNear(rCompartir.finalState[2], 0.08, 1e-9);
  assertNear(rCompartir.finalState[1], 0.05, 1e-9);

  const rEliminar = evalSrc('Eliminar: Bio_Matriz');
  assert.equal(rEliminar.lastValue.kind, 'Effect');
  if (rEliminar.lastValue.kind === 'Effect') {
    assert.equal(rEliminar.lastValue.effectType, 'delete');
  }
  assertNear(rEliminar.finalState[0], -0.08, 1e-9);
  assertNear(rEliminar.finalState[2], -0.05, 1e-9);

  const rReiniciar = evalSrc(
    'RESONANCIA: Vector[0.2, 0.2, 0.2, 0.2, 0.95, 0.1, 0.5, 0.1]\nReiniciar: Bio_Matriz'
  );
  assert.equal(rReiniciar.lastValue.kind, 'Effect');
  if (rReiniciar.lastValue.kind === 'Effect') {
    assert.equal(rReiniciar.lastValue.effectType, 'restart');
  }
  assertNear(rReiniciar.finalState[1], 0.0, 1e-9);
  assertNear(rReiniciar.finalState[3], 0.0, 1e-9);

  const rExpandir = evalSrc('Expandir: Bio_Matriz');
  assert.equal(rExpandir.lastValue.kind, 'Effect');
  if (rExpandir.lastValue.kind === 'Effect') {
    assert.equal(rExpandir.lastValue.effectType, 'expand');
  }
  assertNear(rExpandir.finalState[2], 0.1, 1e-9);
  assertNear(rExpandir.finalState[0], 0.02, 1e-9);

  const rContraer = evalSrc('Contraer: Bio_Matriz');
  assert.equal(rContraer.lastValue.kind, 'Effect');
  if (rContraer.lastValue.kind === 'Effect') {
    assert.equal(rContraer.lastValue.effectType, 'contract');
  }
  assertNear(rContraer.finalState[2], -0.1, 1e-9);
  assertNear(rContraer.finalState[0], -0.02, 1e-9);
});

// T17: Lote 4 de 10 verbos no-core
run('T17: test_lote4_non_core_verbs', () => {
  const rExtraer = evalSrc(
    'RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.2, 0.5, 0.1]\nExtraer: Senal'
  );
  assert.equal(rExtraer.lastValue.kind, 'Effect');
  if (rExtraer.lastValue.kind === 'Effect') {
    assert.equal(rExtraer.lastValue.effectType, 'extract');
  }
  assertNear(rExtraer.finalState[2], 0.05, 1e-9);
  assertNear(rExtraer.finalState[5], 0.16, 1e-9);

  const rConfigurar = evalSrc('Configurar: Bio_Matriz');
  assert.equal(rConfigurar.lastValue.kind, 'Effect');
  if (rConfigurar.lastValue.kind === 'Effect') {
    assert.equal(rConfigurar.lastValue.effectType, 'configure');
  }
  assertNear(rConfigurar.finalState[3], 0.03, 1e-9);
  assertNear(rConfigurar.finalState[0], 0.02, 1e-9);

  const rProtocolo = evalSrc('Protocolo: Bio_Matriz');
  assert.equal(rProtocolo.lastValue.kind, 'Effect');
  if (rProtocolo.lastValue.kind === 'Effect') {
    assert.equal(rProtocolo.lastValue.effectType, 'protocol');
  }
  assertNear(rProtocolo.finalState[3], 0.13, 1e-9);

  const rReforzar = evalSrc('Reforzar: Bio_Matriz');
  assert.equal(rReforzar.lastValue.kind, 'Effect');
  if (rReforzar.lastValue.kind === 'Effect') {
    assert.equal(rReforzar.lastValue.effectType, 'reinforce');
  }
  assertNear(rReforzar.finalState[5], 0.065, 1e-9);
  assertNear(rReforzar.finalState[3], 0.09, 1e-9);

  const rTraducir = evalSrc(
    'RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.1, 0.5, 0.5]\nTraducir: Senal'
  );
  assert.equal(rTraducir.lastValue.kind, 'Effect');
  if (rTraducir.lastValue.kind === 'Effect') {
    assert.equal(rTraducir.lastValue.effectType, 'translate');
  }
  assertNear(rTraducir.finalState[7], 0.45, 1e-9);
  assertNear(rTraducir.finalState[0], 0.15, 1e-9);

  const rOlvidar = evalSrc(
    'RESONANCIA: Vector[0.2, 0.1, 0.1, 0.1, 0.95, 0.1, 0.5, 0.1]\nOlvidar: Senal'
  );
  assert.equal(rOlvidar.lastValue.kind, 'Effect');
  if (rOlvidar.lastValue.kind === 'Effect') {
    assert.equal(rOlvidar.lastValue.effectType, 'forget');
  }
  assertNear(rOlvidar.finalState[0], 0.1, 1e-9);
  assertNear(rOlvidar.finalState[7], 0.2, 1e-9);

  const rDetener = evalSrc(
    'RESONANCIA: Vector[0.1, 0.2, 0.1, 0.1, 0.95, 0.2, 0.5, 0.1]\nDetener: Canal_Local'
  );
  assert.equal(rDetener.lastValue.kind, 'Effect');
  if (rDetener.lastValue.kind === 'Effect') {
    assert.equal(rDetener.lastValue.effectType, 'halt');
  }
  assertNear(rDetener.finalState[1], 0.0, 1e-9);
  assertNear(rDetener.finalState[5], 0.0, 1e-9);

  const rDecodificar = evalSrc(
    'RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.1, 0.5, 0.5]\nDecodificar: Senal'
  );
  assert.equal(rDecodificar.lastValue.kind, 'Vector8');
  assertNear(rDecodificar.finalState[7], 0.42, 1e-9);
  assertNear(rDecodificar.finalState[0], 0.18, 1e-9);

  const rCobrar = evalSrc(
    'RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.2, 0.5, 0.1]\nCobrar: Bio_Matriz'
  );
  assert.equal(rCobrar.lastValue.kind, 'Effect');
  if (rCobrar.lastValue.kind === 'Effect') {
    assert.equal(rCobrar.lastValue.effectType, 'charge');
  }
  assertNear(rCobrar.finalState[5], 0.19, 1e-9);
  assertNear(rCobrar.finalState[3], 0.08, 1e-9);

  const rPagar = evalSrc('Pagar: Bio_Matriz');
  assert.equal(rPagar.lastValue.kind, 'Effect');
  if (rPagar.lastValue.kind === 'Effect') {
    assert.equal(rPagar.lastValue.effectType, 'pay');
  }
  assertNear(rPagar.finalState[5], 0.03, 1e-9);
  assertNear(rPagar.finalState[3], 0.08, 1e-9);
});

// T18: Lote 5 de 10 verbos no-core
run('T18: test_lote5_non_core_verbs', () => {
  const rEvolucionar = evalSrc(
    'RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.1, 0.5, 0.5]\nEvolucionar: Senal'
  );
  assert.equal(rEvolucionar.lastValue.kind, 'Effect');
  if (rEvolucionar.lastValue.kind === 'Effect') {
    assert.equal(rEvolucionar.lastValue.effectType, 'evolve');
  }
  assertNear(rEvolucionar.finalState[0], 0.2, 1e-9);
  assertNear(rEvolucionar.finalState[7], 0.4, 1e-9);

  const rHibernar = evalSrc(
    'RESONANCIA: Vector[0.1, 0.2, 0.1, 0.1, 0.95, 0.2, 0.5, 0.1]\nHibernar: Canal_Local'
  );
  assert.equal(rHibernar.lastValue.kind, 'Effect');
  if (rHibernar.lastValue.kind === 'Effect') {
    assert.equal(rHibernar.lastValue.effectType, 'hibernate');
  }
  assertNear(rHibernar.finalState[5], 0.1025, 1e-9);
  assertNear(rHibernar.finalState[1], 0.1, 1e-9);

  const rOrquestar = evalSrc('Orquestar: Bio_Matriz');
  assert.equal(rOrquestar.lastValue.kind, 'Effect');
  if (rOrquestar.lastValue.kind === 'Effect') {
    assert.equal(rOrquestar.lastValue.effectType, 'orchestrate');
  }
  assertNear(rOrquestar.finalState[3], 0.16, 1e-9);
  assertNear(rOrquestar.finalState[2], 0.1, 1e-9);

  const rEstimular = evalSrc('Estimular: Bio_Matriz');
  assert.equal(rEstimular.lastValue.kind, 'Effect');
  if (rEstimular.lastValue.kind === 'Effect') {
    assert.equal(rEstimular.lastValue.effectType, 'stimulate');
  }
  assertNear(rEstimular.finalState[5], 0.1175, 1e-9);
  assertNear(rEstimular.finalState[0], 0.05, 1e-9);

  const rSimular = evalSrc('Simular: Bio_Matriz');
  assert.equal(rSimular.lastValue.kind, 'Vector8');
  assertNear(rSimular.finalState[7], 0.05, 1e-9);
  assertNear(rSimular.finalState[0], 0.05, 1e-9);

  const rGobernar = evalSrc('Gobernar: Bio_Matriz');
  assert.equal(rGobernar.lastValue.kind, 'Effect');
  if (rGobernar.lastValue.kind === 'Effect') {
    assert.equal(rGobernar.lastValue.effectType, 'govern');
  }
  assertNear(rGobernar.finalState[4], 0.99, 1e-9);
  assertNear(rGobernar.finalState[3], 0.09, 1e-9);

  const rIntercambiar = evalSrc('Intercambiar: Bio_Matriz');
  assert.equal(rIntercambiar.lastValue.kind, 'Effect');
  if (rIntercambiar.lastValue.kind === 'Effect') {
    assert.equal(rIntercambiar.lastValue.effectType, 'exchange');
  }
  assertNear(rIntercambiar.finalState[5], 0.065, 1e-9);
  assertNear(rIntercambiar.finalState[2], 0.05, 1e-9);

  const rInocular = evalSrc('Inocular: Bio_Matriz');
  assert.equal(rInocular.lastValue.kind, 'Effect');
  if (rInocular.lastValue.kind === 'Effect') {
    assert.equal(rInocular.lastValue.effectType, 'inoculate');
  }
  assertNear(rInocular.finalState[0], 0.08, 1e-9);
  assertNear(rInocular.finalState[2], 0.02, 1e-9);

  const rCosechar = evalSrc('Cosechar: Bio_Matriz');
  assert.equal(rCosechar.lastValue.kind, 'Effect');
  if (rCosechar.lastValue.kind === 'Effect') {
    assert.equal(rCosechar.lastValue.effectType, 'harvest');
  }
  assertNear(rCosechar.finalState[5], 0.115, 1e-9);
  assertNear(rCosechar.finalState[1], 0.05, 1e-9);

  const rMeditar = evalSrc(
    'RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.1, 0.5, 0.5]\nMeditar: Senal'
  );
  assert.equal(rMeditar.lastValue.kind, 'Effect');
  if (rMeditar.lastValue.kind === 'Effect') {
    assert.equal(rMeditar.lastValue.effectType, 'meditate');
  }
  assertNear(rMeditar.finalState[7], 0.35, 1e-9);
  assertNear(rMeditar.finalState[4], 0.97, 1e-9);
});

// T19: Lote 6 Cultivar (73/73)
run('T19: test_lote6_cultivar', () => {
  const rCultivar = evalSrc('Cultivar: Micelio');
  assert.equal(rCultivar.lastValue.kind, 'Effect');
  if (rCultivar.lastValue.kind === 'Effect') {
    assert.equal(rCultivar.lastValue.effectType, 'cultivate');
  }
  assertNear(rCultivar.finalState[0], 0.08, 1e-9);
  assertNear(rCultivar.finalState[2], 0.08, 1e-9);
  assertNear(rCultivar.finalState[5], 0.07, 1e-9);
  assert.ok(rCultivar.finalState[4] >= 0.92);
});

console.log(`\nEVALUATOR_V2_PARITY: ${passed}/${passed} passed`);
