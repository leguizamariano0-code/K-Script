# K-Script (`.koko`)

K-Script is a declarative language for building self-contained apps. An entire app is a single `.koko` text file that parses, evaluates under constitutional invariants, renders reactively, and round-trips bit-perfect through a formal compiler.

- **Live Demo:** [Open Hello World `.koko` v2.0 Studio](https://k-script.vercel.app)
- **Repository:** `https://github.com/leguizamariano0-code/k-script`

## The `.koko` file

```koko
RIMA: HelloWorld_v2

VERSION: "2.0.0-hello";
AUTOR: "Mariano_Leguiza";

INVARIANT: Etica >= 0.85;
INVARIANT: Incertidumbre <= 0.50;

FRECUENCIAS: 0.174 | 0.285 | 0.396 | 0.417 | 0.432 | 0.528 | 0.639 | 0.741 | 0.852 | 0.963;

TOPOLOGICOS: Nombre["Hello World Fractal"] | Genero[Visualizador_Reactivo] | Paleta["#af9aca"] | Complejidad[0.65];

RESONANCIA: Vector[0.4000, 0.1500, 0.5000, 0.2000, 0.9500, 0.1000, 0.5280, 0.0800];

PESOS: Topologicos[0.30] | Causales[0.00] | Resonancia[0.70] | Interferencia[0.00];
```

Ten declarative lines. One interactive fractal app with audio pitch detection and `.koko` export/import round-trip.

## Architecture

```
.koko (text)
   │
   ▼  Lexer      (Rust + TypeScript, parity-tested)
tokens
   │
   ▼  Parser
Rima (AST)
   │
   ▼  Evaluator  (8D semantic state + constitutional invariants)
EvaluationResult
   │
   ▼  Renderer   (Canvas / Web Audio / round-trip export)
Interactive UI
```

Two independent implementations (Rust in `korivm/src/kscript/` and TypeScript in `src/kscript/`) verified for behavioral parity across **118 automated tests**.

## Why 8D?

Every `.koko` program evaluates onto an 8-dimensional semantic state:

| Dimension | Meaning | Range |
|---|---|---|
| Conceptual | What is being expressed | `[-1, 1]` |
| Temporal | When / pacing | `[-1, 1]` |
| Spatial | Scale / geometry | `[-1, 1]` |
| Causal | Cause-effect asymmetry | `[-1, 1]` |
| **Ethics** | **Constitutional floor (`>= 0.85`)** | `[0, 1]` |
| Energetic | Density / compute cost | `[0, 1]` |
| Resonance | Harmonic frequency (Solfeggio) | `[0, 1]` |
| Uncertainty | Epistemic dispersion | `[0, 1]` |

The first four dimensions live inside a hyperbolic Poincaré ball (`||x|| < 0.999`). The last four enforce constitutional bounds at evaluation time.

## Constitutional invariants

Every `.koko` file declares invariants checked by the evaluator:

```koko
INVARIANT: Etica >= 0.85;           // ethics floor
INVARIANT: Incertidumbre <= 0.50;   // uncertainty ceiling
```

If any declared invariant or reconstruction weight constraint fails, evaluation **fails closed** rather than mutating into an invalid state.

## Test counts

| Suite | Count | Status |
|---|---|---|
| Rust (`dictionary` + `ast` + `lexer` + `parser` + `evaluator`) | 56 | ✅ |
| TypeScript v2.0 (`lexer` + `parser` + `evaluator` + `cutover`) | 49 | ✅ |
| TypeScript v2.0 Hello World round-trip (`state8D <-> .koko`) | 13 | ✅ |
| **Total Rust ↔ TS parity coverage** | **118** | ✅ |

GitHub Actions CI validates the Rust workspace across 3 OS targets × 2 toolchains (`stable`, `beta`).

## Quick start

```bash
# Rust compiler & VM tests
cd korivm
cargo test --all-targets
cargo test --doc

# TypeScript pipeline & Hello World Studio
git clone https://github.com/leguizamariano0-code/k-script.git
cd k-script
npm install
npm run dev
```

Open `http://localhost:3000` to launch the Hello World `.koko` v2.0 Studio directly.

Run the TypeScript parity and round-trip suites:

```bash
npm run build
npm run lint
npx tsx tests/kscript_v2_roundtrip_hello_world.test.ts
npx tsx tests/kscript_v2_lexer_test.ts
npx tsx tests/kscript_v2_parser_test.ts
npx tsx tests/kscript_v2_evaluator_test.ts
npx tsx tests/kscript_v2_cutover_test.ts
```

## Status

- ✅ Compiler complete in Rust and TypeScript (`lexer`, `parser`, `evaluator`, AST, dictionary)
- ✅ 20 canonical core verbs implemented (of 73 dictionary verbs)
- ✅ Cryptographic primitives: ML-DSA-44 (FIPS 204), Blake3, bidirectional cross-checks
- ✅ Byzantine resilience tests: 100-node simulation, 6 attacks, Trimmed Karcher consensus
- ✅ End-to-end `.koko` v2.0 Hello World demo with bit-perfect round-trip
- 🚧 Remaining 53 non-core dictionary verbs (stubs)
- 🚧 Standalone WASM packaging and ESP32 target
- 🚧 Semantic distillation pipeline

## License

MIT
