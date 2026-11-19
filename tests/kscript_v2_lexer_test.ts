// Suite de paridad TS <-> Rust para `src/kscript/lexerV2.ts`
// Replica los 18 tests de `korivm/src/kscript/lexer.rs` + verificación Unicode.

import assert from 'node:assert/strict';
import { Lexer, LexError, tokenize, tokenKindName, type Token } from '../src/kscript/lexerV2';

function lex(input: string): Token[] {
  return tokenize(input).map((s) => s.token);
}

function lexNoEof(input: string): Token[] {
  const toks = lex(input);
  const eof = toks.pop();
  assert.deepEqual(eof, { type: 'eof' });
  return toks.filter((t) => t.type !== 'newline');
}

const tests: Array<[string, () => void]> = [
  [
    'test_simple_command',
    () => {
      const toks = lexNoEof('Armonizar: Suelo_Biotico[528Hz]');
      assert.deepEqual(toks, [
        { type: 'identifier', value: 'Armonizar' },
        { type: 'colon' },
        { type: 'identifier', value: 'Suelo_Biotico' },
        { type: 'openBracket' },
        { type: 'hertz', value: 528.0 },
        { type: 'closeBracket' },
      ]);
    },
  ],
  [
    'test_string_quoted',
    () => {
      const toks = lexNoEof('Guardar: Archivo["MiCaptura"]');
      assert.deepEqual(toks, [
        { type: 'identifier', value: 'Guardar' },
        { type: 'colon' },
        { type: 'identifier', value: 'Archivo' },
        { type: 'openBracket' },
        { type: 'string', value: 'MiCaptura' },
        { type: 'closeBracket' },
      ]);
    },
  ],
  [
    'test_pipeline',
    () => {
      const toks = lexNoEof('Ver: Camara >> Guardar: Archivo');
      assert.equal(toks.filter((t) => t.type === 'pipe').length, 1);
    },
  ],
  [
    'test_reference_condition_modifier',
    () => {
      const toks = lexNoEof('@now ?bateria_baja ~pulso');
      assert.deepEqual(toks, [
        { type: 'reference', value: 'now' },
        { type: 'conditional', value: 'bateria_baja' },
        { type: 'modifier', value: 'pulso' },
      ]);
    },
  ],
  [
    'test_modifier_with_value',
    () => {
      const toks = lexNoEof('~aire:12');
      assert.deepEqual(toks, [
        { type: 'modifier', value: 'aire' },
        { type: 'colon' },
        { type: 'integer', value: 12 },
      ]);
    },
  ],
  [
    'test_invariant_with_operators',
    () => {
      const toks = lexNoEof('INVARIANT: Etica >= 0.85');
      assert.deepEqual(toks, [
        { type: 'identifier', value: 'INVARIANT' },
        { type: 'colon' },
        { type: 'identifier', value: 'Etica' },
        { type: 'gte' },
        { type: 'number', value: 0.85 },
      ]);
    },
  ],
  [
    'test_all_relational_ops',
    () => {
      const toks = lexNoEof('>= <= > < == !=');
      assert.deepEqual(toks, [
        { type: 'gte' },
        { type: 'lte' },
        { type: 'gt' },
        { type: 'lt' },
        { type: 'eq' },
        { type: 'neq' },
      ]);
    },
  ],
  [
    'test_glifos_k_script',
    () => {
      const toks = lexNoEof('•| •-');
      assert.deepEqual(toks, [
        { type: 'glyphVertical' },
        { type: 'glyphHorizontal' },
      ]);
    },
  ],
  [
    'test_glyph_map',
    () => {
      const toks = lexNoEof('🗺️[Header/Footer]');
      assert.deepEqual(toks, [
        { type: 'glyphMap' },
        { type: 'openBracket' },
        { type: 'identifier', value: 'Header' },
        { type: 'slash' },
        { type: 'identifier', value: 'Footer' },
        { type: 'closeBracket' },
      ]);
    },
  ],
  [
    'test_comments',
    () => {
      const toks = lexNoEof('// esto es un comentario\nArmonizar: Suelo');
      assert.ok(toks.some((t) => t.type === 'comment'));
      assert.ok(toks.some((t) => t.type === 'identifier' && t.value === 'Armonizar'));
    },
  ],
  [
    'test_hash_comment',
    () => {
      const toks = lexNoEof('# otro comentario');
      assert.equal(toks.length, 1);
      assert.equal(toks[0].type, 'comment');
      if (toks[0].type === 'comment') {
        assert.ok(toks[0].value.startsWith('#'));
      }
    },
  ],
  [
    'test_numbers_integer_float_negative',
    () => {
      const toks = lexNoEof('42 0.85 -1.5 -7');
      assert.deepEqual(toks, [
        { type: 'integer', value: 42 },
        { type: 'number', value: 0.85 },
        { type: 'number', value: -1.5 },
        { type: 'integer', value: -7 },
      ]);
    },
  ],
  [
    'test_causal_arrow_range',
    () => {
      const toks = lexNoEof('[0.3 -> 0.9]');
      assert.deepEqual(toks, [
        { type: 'openBracket' },
        { type: 'number', value: 0.3 },
        { type: 'arrow' },
        { type: 'number', value: 0.9 },
        { type: 'closeBracket' },
      ]);
    },
  ],
  [
    'test_concat_operator',
    () => {
      const toks = lexNoEof('a || b');
      assert.ok(toks.some((t) => t.type === 'concat'));
      assert.ok(!toks.some((t) => t.type === 'bar'));
    },
  ],
  [
    'test_unclosed_string_error',
    () => {
      assert.throws(
        () => new Lexer('"sin cerrar').tokenize(),
        (err: unknown) =>
          err instanceof LexError && err.message.includes('string sin comilla')
      );
    },
  ],
  [
    'test_glifo_invalido_error',
    () => {
      assert.throws(() => new Lexer('•X').tokenize(), LexError);
    },
  ],
  [
    'test_span_tracking',
    () => {
      const toks = new Lexer('Armonizar: Suelo').tokenize();
      assert.equal(toks[0].span.line, 1);
      assert.equal(toks[0].span.col, 1);
      assert.equal(toks[0].span.len, 9);
    },
  ],
  [
    'test_koko_v2_header',
    () => {
      const src = `RIMA: HelloWorld_v2
VERSION: "2.0.0-hello"
AUTOR: Mariano_Leguiza
INVARIANT: Etica >= 0.85`;
      const toks = lexNoEof(src);
      assert.ok(toks.some((t) => t.type === 'identifier' && t.value === 'RIMA'));
      assert.ok(toks.some((t) => t.type === 'string' && t.value === '2.0.0-hello'));
      assert.ok(toks.some((t) => t.type === 'gte'));
    },
  ],
  [
    'test_unicode_spanish_accents_and_tokenKindName',
    () => {
      const toks = lexNoEof('Ética: Suelo_Biótico');
      assert.deepEqual(toks, [
        { type: 'identifier', value: 'Ética' },
        { type: 'colon' },
        { type: 'identifier', value: 'Suelo_Biótico' },
      ]);
      assert.equal(tokenKindName({ type: 'glyphMap' }), "'🗺️'");
    },
  ],
];

let passed = 0;
for (const [name, fn] of tests) {
  fn();
  passed++;
}
console.log(`LEXER_V2_PARITY: ${passed}/${tests.length} passed`);
