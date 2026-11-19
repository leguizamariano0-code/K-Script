//! Módulo `kscript`: compilador completo de K-Script y `.koko` v2.0.
//!
//! Orden interno de dependencias:
//! - `ast`         (sin dependencias)
//! - `dictionary`  (sin dependencias)
//! - `errors`      (re-exporta errores de lexer/parser/evaluator)
//! - `lexer`       (usa `ast::Span`)
//! - `parser`      (usa `ast`, `lexer`, `dictionary`)
//! - `evaluator`   (usa `ast`, `dictionary`)

pub mod ast;
pub mod dictionary;
pub mod errors;
pub mod evaluator;
pub mod lexer;
pub mod parser;

// Re-exports internos
pub use ast::Rima;
pub use dictionary::KScriptDictionary;
pub use errors::KScriptError;
pub use evaluator::Evaluator;
pub use lexer::Lexer;
pub use parser::Parser;
