# korivm

Kernel Virtual de Kori Neural OS. Implementación Rust de K-Script y
`.koko` v2.0.

## Pipeline

```
.koko ──► Lexer ──► Parser ──► Evaluator ──► EvaluationResult
         (tokens)   (Rima)     (8D state + history)
```

## Uso

```rust
use korivm::{Parser, Evaluator};

let rima = Parser::parse(src)?;
let result = Evaluator::evaluate(&rima)?;
println!("{:?}", result.final_state);
```

## Tests

```bash
cargo test --all-targets
cargo test --doc
cargo clippy --all-targets -- -D warnings
cargo fmt --check
```

## Estructura

- `src/lib.rs` — punto de entrada del crate.
- `src/kscript/` — compilador completo.
  - `ast.rs` — Árbol de Sintaxis Abstracta.
  - `dictionary.rs` — 73 verbos + 105 sujetos + aliases.
  - `lexer.rs` — texto → tokens con spans.
  - `parser.rs` — tokens → AST `Rima`.
  - `evaluator.rs` — AST → `EvaluationResult`.
  - `errors.rs` — errores unificados.

## Estado

- **55 tests unitarios + 1 doc-test** pendientes de ejecución real en CI.
- MVP: los 20 verbos core ejecutan handlers; los 53 restantes retornan `Null`.
- Layouts (`🗺️`, `•|`) registrados pero no renderizados (MVP).
