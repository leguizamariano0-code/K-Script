//! Kori VM — Kernel Virtual para K-Script / `.koko` v2.0.
//!
//! Pipeline: `.koko` → lexer → parser → evaluator → `EvaluationResult`.
//!
//! # Ejemplo
//! ```
//! use korivm::{Parser, Evaluator};
//!
//! let src = r#"
//! RIMA: HelloWorld
//! INVARIANT: Etica >= 0.85
//! RESONANCIA: Vector[0.4, 0.15, 0.5, 0.2, 0.95, 0.1, 0.528, 0.08]
//! "#;
//! let rima = Parser::parse(src).expect("parse ok");
//! let result = Evaluator::evaluate(&rima).expect("eval ok");
//! assert!(result.poincare_norm < 0.999);
//! assert!(result.final_state[4] >= 0.85);
//! ```

pub mod kscript;

// Re-exports para uso cómodo: `use korivm::Parser;`
pub use kscript::{
    ast::Rima,
    dictionary::KScriptDictionary,
    evaluator::{EvalError, EvaluationResult, Evaluator},
    lexer::{LexError, Lexer},
    parser::{ParseError, Parser},
};
