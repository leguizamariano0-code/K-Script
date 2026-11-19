// tests/kscript_v2_roundtrip_hello_world.test.ts
// Test end-to-end del Hello World: state8D → .koko → kScriptV2.parse/evaluate → state8D
import {
  serializeKokoV2Canonical,
  importKokoV2Canonical,
  buildManifestFromState,
  type State8D,
} from '../src/lib/kokoV2Canonical';
import { kScriptV2 } from '../src/kscript';

let passed = 0, failed = 0;
function ok(l: string) { passed++; console.log(`  ✅ ${l}`); }
function bad(l: string, m: string) { failed++; console.log(`  ❌ ${l}\n     ${m}`); }
function assertNear(a: number, e: number, eps: number, l: string) {
  Math.abs(a - e) < eps ? ok(l) : bad(l, `expected ${e}±${eps}, actual ${a}`);
}
function assertEq<T>(a: T, e: T, l: string) {
  JSON.stringify(a) === JSON.stringify(e) ? ok(l) : bad(l, `expected ${JSON.stringify(e)}, actual ${JSON.stringify(a)}`);
}

// Case 1: estado inicial arbitrario
{
  const s: State8D = {
    conceptual: 0.4,
    temporal: 0.15,
    espacial: 0.5,
    causal: 0.2,
    etica: 0.95,
    energetica: 0.1,
    resonancia: 0.528,
    incertidumbre: 0.08,
  };
  const manifest = buildManifestFromState(s);
  const koko = serializeKokoV2Canonical(manifest);
  const imported = importKokoV2Canonical(koko);
  if (!imported) { bad('RT1: round-trip', 'import retornó null'); }
  else {
    const r = imported.manifest.state8D;
    assertNear(r.conceptual, s.conceptual, 1e-3, 'RT1: conceptual');
    assertNear(r.temporal, s.temporal, 1e-3, 'RT1: temporal');
    assertNear(r.espacial, s.espacial, 1e-3, 'RT1: espacial');
    assertNear(r.causal, s.causal, 1e-3, 'RT1: causal');
    assertNear(r.etica, s.etica, 1e-3, 'RT1: etica');
    assertNear(r.energetica, s.energetica, 1e-3, 'RT1: energetica');
    assertNear(r.resonancia, s.resonancia, 1e-3, 'RT1: resonancia');
    assertNear(r.incertidumbre, s.incertidumbre, 1e-3, 'RT1: incertidumbre');
  }
}

// Case 2: ética fuera de rango (debe clampear a 0.85)
{
  const s: State8D = { conceptual: 0.4, temporal: 0.15, espacial: 0.5, causal: 0.2, etica: 0.5, energetica: 0.1, resonancia: 0.528, incertidumbre: 0.08 };
  const koko = serializeKokoV2Canonical(buildManifestFromState(s));
  const imported = importKokoV2Canonical(koko);
  if (!imported) { bad('RT2: ética clamp', 'null'); }
  else {
    assertNear(imported.manifest.state8D.etica, 0.85, 1e-3, 'RT2: ética clamp a 0.85');
  }
}

// Case 3: coordenadas hiperbólicas fuera del disco (deben proyectarse)
{
  const s: State8D = { conceptual: 5.0, temporal: 5.0, espacial: 5.0, causal: 5.0, etica: 0.95, energetica: 0.1, resonancia: 0.528, incertidumbre: 0.08 };
  const koko = serializeKokoV2Canonical(buildManifestFromState(s));
  const imported = importKokoV2Canonical(koko);
  if (!imported) { bad('RT3: proyección', 'null'); }
  else {
    const norm = Math.sqrt(imported.manifest.state8D.conceptual ** 2 + imported.manifest.state8D.temporal ** 2 + imported.manifest.state8D.espacial ** 2 + imported.manifest.state8D.causal ** 2);
    if (norm < 0.999) ok(`RT3: norma ${norm.toFixed(4)} < 0.999`);
    else bad('RT3: proyección', `norma ${norm} ≥ 0.999`);
  }
}

// Case 4: .koko malformado (falta RESONANCIA) → null
{
  const badKoko = `RIMA: bad\nVERSION: "1";`;
  const r = importKokoV2Canonical(badKoko);
  assertEq(r, null, 'RT4: sin RESONANCIA → null');
}

// Case 5: .koko con Paleta SIN comillas (bug legacy) → debe fallar
{
  const badKoko = `RIMA: legacy
RESONANCIA: Vector[0.4, 0.1, 0.5, 0.2, 0.95, 0.1, 0.528, 0.08];
TOPOLOGICOS: Paleta[#af9aca];`;
  const r = importKokoV2Canonical(badKoko);
  assertEq(r, null, 'RT5: Paleta sin comillas → null (lexer # = comment)');
}

// Case 6: kScriptV2 parsea directamente el output canónico
{
  const s: State8D = { conceptual: 0.4, temporal: 0.15, espacial: 0.5, causal: 0.2, etica: 0.95, energetica: 0.1, resonancia: 0.528, incertidumbre: 0.08 };
  const koko = serializeKokoV2Canonical(buildManifestFromState(s));
  let parsed = false;
  try {
    const rima = kScriptV2.parse(koko);
    const result = kScriptV2.evaluate(rima);
    parsed = result.poincareNorm < 0.999 && result.finalState[4] >= 0.85;
  } catch (e) {
    bad('RT6: kScriptV2 parse/eval', String(e));
  }
  if (parsed) ok('RT6: kScriptV2 parse+eval directo');
}

console.log(`\nROUNDTRIP_HELLO_WORLD: ${passed}/${passed + failed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
