//! Módulo `errors`: errores unificados del compilador K-Script.
//!
//! Re-exporta los errores de cada etapa para uso unificado.

pub use crate::kscript::evaluator::EvalError;
pub use crate::kscript::lexer::LexError;
pub use crate::kscript::parser::ParseError;

/// Error agregado de cualquier etapa del pipeline.
#[derive(Debug, Clone, PartialEq)]
pub enum KScriptError {
    Lex(LexError),
    Parse(ParseError),
    Eval(EvalError),
}

impl std::fmt::Display for KScriptError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            KScriptError::Lex(e) => write!(f, "[lex] {}", e),
            KScriptError::Parse(e) => write!(f, "[parse] {}", e),
            KScriptError::Eval(e) => write!(f, "[eval] {}", e),
        }
    }
}

impl std::error::Error for KScriptError {}

impl From<LexError> for KScriptError {
    fn from(e: LexError) -> Self {
        Self::Lex(e)
    }
}
impl From<ParseError> for KScriptError {
    fn from(e: ParseError) -> Self {
        Self::Parse(e)
    }
}
impl From<EvalError> for KScriptError {
    fn from(e: EvalError) -> Self {
        Self::Eval(e)
    }
}
