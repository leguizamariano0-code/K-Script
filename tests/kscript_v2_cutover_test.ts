// tests/kscript_v2_cutover_test.ts
// Verifica el cutover de `kScriptV2` en `src/kscript/index.ts` y convivencia con v1.1.

import assert from 'node:assert/strict';
import {
  kScriptV2,
  executeKScript,
  validateKScript,
  KScriptParser,
  KScriptEvaluator,
} from '../src/kscript';

let passed = 0;

function run(label: string, fn: () => void): void {
  fn();
  passed++;
  console.log(`  ✅ ${label}`);
}

run('C1: kScriptV2 exporta funciones clave', () => {
  assert.equal(typeof kScriptV2.parse, 'function');
  assert.equal(typeof kScriptV2.parseV2, 'function');
  assert.equal(typeof kScriptV2.evaluate, 'function');
  assert.equal(typeof kScriptV2.evaluateV2, 'function');
  assert.equal(typeof kScriptV2.tokenize, 'function');
  assert.equal(typeof kScriptV2.createRima, 'function');
  assert.equal(typeof kScriptV2.validateWeightsSum, 'function');
  assert.equal(typeof kScriptV2.normalizeSolfeggio, 'function');
  assert.equal(typeof kScriptV2.domainBaseVector, 'function');
});

run('C2: comando K-Script vía kScriptV2 (version KScriptV11 + eval)', () => {
  const rima = kScriptV2.parse('Armonizar: Suelo_Biotico[528Hz]');
  assert.equal(rima.version, 'KScriptV11');
  assert.equal(rima.statements.length, 1);

  const result = kScriptV2.evaluate(rima);
  assert.ok(Math.abs(result.finalState[6] - 0.5) < 1e-9);
  assert.ok(result.finalState[4] >= 0.85);
});

run('C3: manifiesto .koko v2.0 completo vía kScriptV2 (version KokoV20 + eval)', () => {
  const src = `RIMA: HelloWorld_v2
VERSION: "2.0.0-hello"
AUTOR: "Mariano_Leguiza"
INVARIANT: Etica >= 0.85
INVARIANT: Incertidumbre <= 0.50
TOPOLOGICOS: Nombre["Hello World Fractal"] | Genero[Visualizador_Reactivo]
RESONANCIA: Vector[0.4, 0.15, 0.5, 0.2, 0.95, 0.1, 0.528, 0.08]
PESOS: Topologicos[0.30] | Causales[0.00] | Resonancia[0.70] | Interferencia[0.00]`;

  const rima = kScriptV2.parse(src);
  assert.equal(rima.name, 'HelloWorld_v2');
  assert.equal(rima.version, 'KokoV20');

  const result = kScriptV2.evaluate(rima);
  assert.ok(Math.abs(result.finalState[0] - 0.4) < 1e-9);
  assert.ok(Math.abs(result.finalState[6] - 0.528) < 1e-9);
  assert.ok(result.poincareNorm < 0.999);
  assert.equal(result.topology.size, 2);
});

run('C4: callers v1.1 intactos (executeKScript, validateKScript, KScriptParser, KScriptEvaluator)', () => {
  assert.equal(typeof executeKScript, 'function');
  assert.equal(typeof validateKScript, 'function');
  assert.equal(typeof KScriptParser.parse, 'function');
  assert.equal(typeof KScriptEvaluator.evaluate, 'function');

  const res = executeKScript('Sentir: Suelo_Biotico[528Hz]');
  assert.equal(res.error, undefined);
  assert.ok(res.result !== undefined);
  assert.ok(res.result.finalState[4] >= 0.85);
});

console.log(`\nCUTOVER_V2: ${passed}/${passed} passed`);
