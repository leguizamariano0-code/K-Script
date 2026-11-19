// src/lib/kokoV2Canonical.ts
// Serializador/importador canónico .koko v2.0.
// Garantiza round-trip con kScriptV2.parse + kScriptV2.evaluate.
//
// Formato canónico emitido:
//   RIMA: Nombre
//   VERSION: "..."
//   AUTOR: "..."
//   INVARIANT: Etica >= 0.85
//   INVARIANT: Incertidumbre <= 0.50
//   FRECUENCIAS: 0.174 | 0.285 | ...
//   TOPOLOGICOS: Nombre["..."] | Genero[...] | Paleta["#af9aca"]
//   RESONANCIA: Vector[c, t, s, ch, et, en, res, inc]
//   PESOS: Topologicos[0.30] | Causales[0.00] | Resonancia[0.70] | Interferencia[0.00]

import { kScriptV2 } from '../kscript';

// ============================================================================
// TIPOS
// ============================================================================

export interface State8D {
  conceptual: number;
  temporal: number;
  espacial: number;
  causal: number;
  etica: number;
  energetica: number;
  resonancia: number;
  incertidumbre: number;
}

export interface KokoV2Manifest {
  name: string;
  version: string;
  author: string;
  palette: string;
  state8D: State8D;
  weights: {
    topologicos: number;
    causales: number;
    resonancia: number;
    interferencia: number;
  };
}

export interface KokoV2ImportResult {
  manifest: KokoV2Manifest;
  rima: kScriptV2.Rima;
  evaluation: kScriptV2.EvaluationResult;
}

// ============================================================================
// SERIALIZACIÓN
// ============================================================================

const clampEtica = (v: number): number => Math.max(0.85, Math.min(0.99, v));
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

function fmt(n: number, decimals: number = 4): string {
  return n.toFixed(decimals);
}

/**
 * Serializa el estado 8D + metadata a un `.koko` v2.0 canónico.
 * El output es 100% parseable por `kScriptV2.parse`.
 */
export function serializeKokoV2Canonical(manifest: KokoV2Manifest): string {
  const s = manifest.state8D;

  // Sanitización: ética en [0.85, 0.99], resto en [0, 1] salvo primeras 4
  // dimensiones hiperbólicas (pueden estar en [-0.999, 0.999]).
  const vec: string[] = [
    fmt(Math.max(-0.999, Math.min(0.999, s.conceptual))),
    fmt(Math.max(-0.999, Math.min(0.999, s.temporal))),
    fmt(Math.max(-0.999, Math.min(0.999, s.espacial))),
    fmt(Math.max(-0.999, Math.min(0.999, s.causal))),
    fmt(clampEtica(s.etica)),
    fmt(clamp01(s.energetica)),
    fmt(clamp01(s.resonancia)),
    fmt(clamp01(s.incertidumbre)),
  ];

  const palette = manifest.palette.startsWith('#')
    ? manifest.palette
    : `#${manifest.palette}`;

  return `RIMA: ${manifest.name}

VERSION: "${manifest.version}";
AUTOR: "${manifest.author}";

INVARIANT: Etica >= 0.85;
INVARIANT: Etica <= 0.99;
INVARIANT: Incertidumbre >= 0.00;
INVARIANT: Incertidumbre <= 0.50;

FRECUENCIAS: 0.174 | 0.285 | 0.396 | 0.417 | 0.432 | 0.528 | 0.639 | 0.741 | 0.852 | 0.963;

TOPOLOGICOS: Nombre["Hello World Fractal"] | Genero[Visualizador_Reactivo] | Paleta["${palette}"] | Complejidad[0.65];

RESONANCIA: Vector[${vec.join(', ')}];

PESOS: Topologicos[${fmt(manifest.weights.topologicos, 2)}] | Causales[${fmt(manifest.weights.causales, 2)}] | Resonancia[${fmt(manifest.weights.resonancia, 2)}] | Interferencia[${fmt(manifest.weights.interferencia, 2)}];
`;
}

// ============================================================================
// IMPORTACIÓN
// ============================================================================

/**
 * Parsea y evalúa un `.koko` v2.0 canónico.
 * Retorna null si:
 *  - el archivo no es parseable (syntax error)
 *  - falla la evaluación (invariante roto, pesos inválidos, etc.)
 *  - no contiene RESONANCIA.
 */
export function importKokoV2Canonical(source: string): KokoV2ImportResult | null {
  let rima: kScriptV2.Rima;
  try {
    rima = kScriptV2.parse(source);
  } catch (e) {
    console.warn('[kokoV2] parse failed:', e);
    return null;
  }

  let evaluation: kScriptV2.EvaluationResult;
  try {
    evaluation = kScriptV2.evaluate(rima);
  } catch (e) {
    console.warn('[kokoV2] eval failed:', e);
    return null;
  }

  // Extraer manifest desde el AST
  let version = '2.0.0-hello';
  let author = 'unknown';
  let palette = '#af9aca';
  let weights = { topologicos: 0.3, causales: 0, resonancia: 0.7, interferencia: 0 };
  let hasResonance = false;

  for (const stmt of rima.statements) {
    const n = stmt.node;
    switch (n.kind) {
      case 'HeaderField':
        if (n.key.toLowerCase() === 'version' && n.value.kind === 'String') {
          version = n.value.value;
        } else if (n.key.toLowerCase() === 'autor' && n.value.kind === 'String') {
          author = n.value.value;
        }
        break;
      case 'Topology':
        for (const item of n.items) {
          if (item.key === 'Paleta' && item.value.kind === 'String') {
            palette = item.value.value;
          }
        }
        break;
      case 'Resonance':
        hasResonance = true;
        break;
      case 'Weights':
        weights = n.weights;
        break;
    }
  }

  if (!hasResonance) {
    console.warn('[kokoV2] no RESONANCIA found');
    return null;
  }

  // El estado final del evaluator es la fuente de verdad (respeta proyección
  // Poincaré, clamps éticos, etc.)
  const fs = evaluation.finalState;
  const state8D: State8D = {
    conceptual: fs[0],
    temporal: fs[1],
    espacial: fs[2],
    causal: fs[3],
    etica: clampEtica(fs[4]),
    energetica: clamp01(fs[5]),
    resonancia: clamp01(fs[6]),
    incertidumbre: clamp01(fs[7]),
  };

  return {
    manifest: {
      name: rima.name,
      version,
      author,
      palette,
      state8D,
      weights,
    },
    rima,
    evaluation,
  };
}

// ============================================================================
// HELPER: manifest por defecto desde state8D actual
// ============================================================================

export function buildManifestFromState(
  state8D: State8D,
  overrides?: Partial<Omit<KokoV2Manifest, 'state8D'>>
): KokoV2Manifest {
  return {
    name: overrides?.name ?? 'HelloWorld_v2',
    version: overrides?.version ?? '2.0.0-hello',
    author: overrides?.author ?? 'Mariano_Leguiza',
    palette: overrides?.palette ?? '#af9aca',
    weights: overrides?.weights ?? {
      topologicos: 0.3,
      causales: 0.0,
      resonancia: 0.7,
      interferencia: 0.0,
    },
    state8D,
  };
}
