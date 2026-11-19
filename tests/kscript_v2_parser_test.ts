// Suite de paridad TS <-> Rust para `src/kscript/parserV2.ts`
// Replica los 12 tests de `korivm/src/kscript/parser.rs`.

import assert from 'node:assert/strict';
import { ParserV2, ParseError } from '../src/kscript/parserV2';
import { isVerbKnown, validateWeightsSum } from '../src/kscript/ast';

let passed = 0;

function run(label: string, fn: () => void): void {
  fn();
  passed++;
  console.log(`  ✅ ${label}`);
}

// Test 1: comando simple (test_simple_command)
run('T1: test_simple_command', () => {
  const rima = ParserV2.parse('Armonizar: Suelo_Biotico[528Hz]');
  assert.equal(rima.statements.length, 1);
  const stmt = rima.statements[0].node;
  assert.equal(stmt.kind, 'Command');
  if (stmt.kind === 'Command') {
    assert.equal(stmt.command.verb.rawName, 'Armonizar');
    assert.ok(isVerbKnown(stmt.command.verb));
    assert.equal(stmt.command.subject.rawName, 'Suelo_Biotico');
    assert.equal(stmt.command.subject.canonicalId, 0);
    assert.equal(stmt.command.params.length, 1);
    assert.deepEqual(stmt.command.params[0], { kind: 'Hertz', value: 528 });
  }
});

// Test 2: pipeline (test_pipeline)
run('T2: test_pipeline', () => {
  const rima = ParserV2.parse('Ver: Camara >> Guardar: Archivo');
  assert.equal(rima.statements.length, 1);
  const stmt = rima.statements[0].node;
  assert.equal(stmt.kind, 'Pipeline');
  if (stmt.kind === 'Pipeline') {
    assert.equal(stmt.statements.length, 2);
  }
});

// Test 3: koko v2 header (test_koko_v2_header)
run('T3: test_koko_v2_header', () => {
  const src = `RIMA: HelloWorld_v2
VERSION: "2.0.0-hello"
AUTOR: Mariano_Leguiza
INVARIANT: Etica >= 0.85`;
  const rima = ParserV2.parse(src);
  assert.equal(rima.name, 'HelloWorld_v2');
  assert.equal(rima.version, 'KokoV20');
  assert.equal(rima.statements.length, 3);
  assert.equal(rima.statements[0].node.kind, 'HeaderField');
  assert.equal(rima.statements[1].node.kind, 'HeaderField');
  assert.equal(rima.statements[2].node.kind, 'Invariant');
  if (rima.statements[2].node.kind === 'Invariant') {
    assert.deepEqual(rima.statements[2].node.invariant, {
      subject: 'Etica',
      op: 'Gte',
      value: 0.85,
    });
  }
});

// Test 4: frequencies (test_frequencies)
run('T4: test_frequencies', () => {
  const rima = ParserV2.parse(
    'FRECUENCIAS: 0.174 | 0.285 | 0.396 | 0.417 | 0.432 | 0.528 | 0.639 | 0.741 | 0.852 | 0.963'
  );
  const stmt = rima.statements[0].node;
  assert.equal(stmt.kind, 'Frequencies');
  if (stmt.kind === 'Frequencies') {
    assert.equal(stmt.frequencies.length, 10);
    assert.equal(stmt.frequencies[5], 0.528);
  }
});

// Test 5: topology (test_topology)
run('T5: test_topology', () => {
  const rima = ParserV2.parse(
    'TOPOLOGICOS: Nombre["Hello"] | Genero[Visualizador] | Paleta["#af9aca"]'
  );
  const stmt = rima.statements[0].node;
  assert.equal(stmt.kind, 'Topology');
  if (stmt.kind === 'Topology') {
    assert.equal(stmt.items.length, 3);
    assert.equal(stmt.items[0].key, 'Nombre');
    assert.equal(stmt.items[1].key, 'Genero');
    assert.equal(stmt.items[2].key, 'Paleta');
  }
});

// Test 6: resonance (test_resonance)
run('T6: test_resonance', () => {
  const rima = ParserV2.parse(
    'RESONANCIA: Vector[0.4, 0.15, 0.5, 0.2, 0.95, 0.1, 0.528, 0.08]'
  );
  const stmt = rima.statements[0].node;
  assert.equal(stmt.kind, 'Resonance');
  if (stmt.kind === 'Resonance') {
    assert.equal(stmt.vector[0], 0.4);
    assert.equal(stmt.vector[4], 0.95);
  }
});

// Test 7: trajectory sin prefijo t (test_trajectory_without_t_prefix)
run('T7: test_trajectory_without_t_prefix', () => {
  const rima = ParserV2.parse(
    'TRAYECTORIA: 0.0[0.3, 0.1, 0.4, 0.2, 0.7, 0.1, 0.4, 0.2] | 0.5[0.5, 0.3, 0.5, 0.3, 0.85, 0.15, 0.5, 0.15]'
  );
  const stmt = rima.statements[0].node;
  assert.equal(stmt.kind, 'Trajectory');
  if (stmt.kind === 'Trajectory') {
    assert.equal(stmt.points.length, 2);
    assert.equal(stmt.points[0].t, 0.0);
    assert.equal(stmt.points[1].t, 0.5);
  }
});

// Test 8: weights válidos (test_weights_valid)
run('T8: test_weights_valid', () => {
  const rima = ParserV2.parse(
    'PESOS: Topologicos[0.30] | Causales[0.00] | Resonancia[0.70] | Interferencia[0.00]'
  );
  const stmt = rima.statements[0].node;
  assert.equal(stmt.kind, 'Weights');
  if (stmt.kind === 'Weights') {
    assert.equal(stmt.weights.topologicos, 0.3);
    assert.equal(validateWeightsSum(stmt.weights).ok, true);
  }
});

// Test 9: weights inválidos parsean y se validan después (test_weights_sum_parses_but_does_not_validate)
run('T9: test_weights_sum_parses_but_does_not_validate', () => {
  const rima = ParserV2.parse(
    'PESOS: Topologicos[0.5] | Causales[0.5] | Resonancia[0.5] | Interferencia[0.5]'
  );
  const stmt = rima.statements[0].node;
  assert.equal(stmt.kind, 'Weights');
  if (stmt.kind === 'Weights') {
    assert.equal(validateWeightsSum(stmt.weights).ok, false);
  }
});

// Test 10: causal order (test_causal_order)
run('T10: test_causal_order', () => {
  const rima = ParserV2.parse(
    'ORDEN: NODO_00_Semilla | NODO_01_Camara | NODO_02_Luz'
  );
  const stmt = rima.statements[0].node;
  assert.equal(stmt.kind, 'CausalOrder');
  if (stmt.kind === 'CausalOrder') {
    assert.equal(stmt.order.length, 3);
    assert.equal(stmt.order[0], 'NODO_00_Semilla');
  }
});

// Test 11: command con modificador y tiempo (test_command_with_modifier_and_time)
run('T11: test_command_with_modifier_and_time', () => {
  const rima = ParserV2.parse('Sentir: Clima_termica ~pulso @now');
  const stmt = rima.statements[0].node;
  assert.equal(stmt.kind, 'Command');
  if (stmt.kind === 'Command') {
    assert.equal(stmt.command.modifiers.length, 1);
    assert.deepEqual(stmt.command.modifiers[0], { kind: 'Pulse' });
    assert.deepEqual(stmt.command.time, { kind: 'Now' });
  }
});

// Test 12: verbo desconocido sigue parseando (test_unknown_verb_still_parses)
run('T12: test_unknown_verb_still_parses', () => {
  const rima = ParserV2.parse('InventadoXYZ: Suelo_Biotico');
  const stmt = rima.statements[0].node;
  assert.equal(stmt.kind, 'Command');
  if (stmt.kind === 'Command') {
    assert.equal(stmt.command.verb.rawName, 'InventadoXYZ');
    assert.equal(stmt.command.verb.canonicalId, null);
    assert.equal(isVerbKnown(stmt.command.verb), false);
  }
});

// Extra: ParseError envolviendo LexError
run('T13: LexError wrapped as ParseError', () => {
  assert.throws(() => ParserV2.parse('"sin cerrar'), ParseError);
});

console.log(`\nPARSER_V2_PARITY: ${passed}/${passed} passed`);
