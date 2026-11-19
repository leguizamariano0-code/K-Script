//! Módulo `lexer`: convierte texto K-Script / .koko v2.0 en tokens.
//!
//! El lexer es la primera etapa del compilador. NO valida semántica
//! (eso lo hace el parser + dictionary); solo convierte caracteres
//! en una secuencia de tokens con spans para errores precisos.

use crate::kscript::ast::Span;
use std::fmt;

// ============================================================================
// TOKENS
// ============================================================================

#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    // ---- Literales ----
    Identifier(String), // Armonizar, Suelo_Biotico, NODO_00
    Number(f64),        // 528.0, -1.5, 0.85
    Integer(i64),       // 42
    String(String),     // "texto" o 'texto'
    Hertz(f64),         // 528Hz

    // ---- Prefijados ----
    Reference(String),   // @now, @last, @after:0.5 (captura "now", "last", "after")
    Conditional(String), // ?bateria_baja, ?temperatura (captura "bateria_baja")
    Modifier(String),    // ~pulso, ~aire, ~curva (captura "pulso")

    // ---- Puntuación ----
    Colon,        // :
    Comma,        // ,
    Semicolon,    // ;
    Slash,        // / (separador de secciones en LayoutMap 🗺️[Header/Footer])
    OpenBracket,  // [
    CloseBracket, // ]
    OpenParen,    // (
    CloseParen,   // )
    OpenBrace,    // {  (compatibilidad, aunque no se use en v2.0)
    CloseBrace,   // }
    Equals,       // =

    // ---- Operadores ----
    Pipe,   // >>
    Bar,    // |
    Plus,   // +
    Minus,  // -
    Concat, // ||
    Arrow,  // ->
    Gte,    // >=
    Lte,    // <=
    Gt,     // >
    Lt,     // <
    Eq,     // ==
    Neq,    // !=

    // ---- Glifos K-Script ----
    GlyphVertical,   // •|
    GlyphHorizontal, // •-
    GlyphMap,        // 🗺️

    // ---- Control ----
    Comment(String),
    Newline,
    EOF,
}

impl Token {
    /// Nombre legible para mensajes de error.
    pub fn kind_name(&self) -> &'static str {
        match self {
            Token::Identifier(_) => "identificador",
            Token::Number(_) => "número",
            Token::Integer(_) => "entero",
            Token::String(_) => "cadena",
            Token::Hertz(_) => "frecuencia (Hz)",
            Token::Reference(_) => "referencia (@)",
            Token::Conditional(_) => "condición (?)",
            Token::Modifier(_) => "modificador (~)",
            Token::Colon => "':'",
            Token::Comma => "','",
            Token::Semicolon => "';'",
            Token::Slash => "'/'",
            Token::OpenBracket => "'['",
            Token::CloseBracket => "']'",
            Token::OpenParen => "'('",
            Token::CloseParen => "')'",
            Token::OpenBrace => "'{'",
            Token::CloseBrace => "'}'",
            Token::Equals => "'='",
            Token::Pipe => "'>>'",
            Token::Bar => "'|'",
            Token::Plus => "'+'",
            Token::Minus => "'-'",
            Token::Concat => "'||'",
            Token::Arrow => "'->'",
            Token::Gte => "'>='",
            Token::Lte => "'<='",
            Token::Gt => "'>'",
            Token::Lt => "'<'",
            Token::Eq => "'=='",
            Token::Neq => "'!='",
            Token::GlyphVertical => "'•|'",
            Token::GlyphHorizontal => "'•-'",
            Token::GlyphMap => "'🗺️'",
            Token::Comment(_) => "comentario",
            Token::Newline => "salto de línea",
            Token::EOF => "fin de archivo",
        }
    }
}

/// Token con su span para errores.
pub type SpannedToken = (Token, Span);

// ============================================================================
// ERRORES
// ============================================================================

#[derive(Debug, Clone, PartialEq)]
pub struct LexError {
    pub message: String,
    pub span: Span,
}

impl fmt::Display for LexError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Error léxico en línea {}, col {}: {}",
            self.span.line, self.span.col, self.message
        )
    }
}

impl std::error::Error for LexError {}

// ============================================================================
// LEXER
// ============================================================================

pub struct Lexer<'a> {
    chars: Vec<char>,
    pos: usize,
    line: u32,
    col: u32,
    _phantom: std::marker::PhantomData<&'a str>,
}

impl<'a> Lexer<'a> {
    pub fn new(input: &'a str) -> Self {
        Self {
            chars: input.chars().collect(),
            pos: 0,
            line: 1,
            col: 1,
            _phantom: std::marker::PhantomData,
        }
    }

    // ---- Helpers básicos ----

    fn peek(&self) -> Option<char> {
        self.chars.get(self.pos).copied()
    }

    fn peek_at(&self, offset: usize) -> Option<char> {
        self.chars.get(self.pos + offset).copied()
    }

    fn advance(&mut self) -> Option<char> {
        let c = self.chars.get(self.pos).copied()?;
        self.pos += 1;
        if c == '\n' {
            self.line += 1;
            self.col = 1;
        } else {
            self.col += 1;
        }
        Some(c)
    }

    fn current_span(&self, start_line: u32, start_col: u32, start_offset: usize) -> Span {
        let len = (self.pos - start_offset) as u32;
        Span {
            line: start_line,
            col: start_col,
            offset: start_offset as u32,
            len,
        }
    }

    fn make_error(
        &self,
        msg: impl Into<String>,
        start_line: u32,
        start_col: u32,
        start_offset: usize,
    ) -> LexError {
        LexError {
            message: msg.into(),
            span: self.current_span(start_line, start_col, start_offset),
        }
    }

    // ---- Punto de entrada ----

    pub fn tokenize(&mut self) -> Result<Vec<SpannedToken>, LexError> {
        let mut tokens = Vec::new();
        loop {
            self.skip_whitespace_non_newline();
            if self.pos >= self.chars.len() {
                tokens.push((
                    Token::EOF,
                    Span::new(self.line, self.col, self.pos as u32, 0),
                ));
                return Ok(tokens);
            }

            let c = self.peek().unwrap();

            // Newline
            if c == '\n' {
                let (l, col, off) = (self.line, self.col, self.pos);
                self.advance();
                tokens.push((Token::Newline, self.current_span(l, col, off)));
                continue;
            }

            // Comentarios: // o #
            if (c == '/' && self.peek_at(1) == Some('/')) || c == '#' {
                let (l, col, off) = (self.line, self.col, self.pos);
                let mut comment = String::new();
                while let Some(ch) = self.peek() {
                    if ch == '\n' {
                        break;
                    }
                    comment.push(ch);
                    self.advance();
                }
                tokens.push((Token::Comment(comment), self.current_span(l, col, off)));
                continue;
            }

            // Glifos especiales (antes de operadores porque usan •)
            if c == '•' {
                let (l, col, off) = (self.line, self.col, self.pos);
                self.advance(); // consume •
                match self.peek() {
                    Some('|') => {
                        self.advance();
                        tokens.push((Token::GlyphVertical, self.current_span(l, col, off)));
                    }
                    Some('-') => {
                        self.advance();
                        tokens.push((Token::GlyphHorizontal, self.current_span(l, col, off)));
                    }
                    _ => {
                        return Err(self.make_error(
                            "se esperaba '|' o '-' después de '•'",
                            l,
                            col,
                            off,
                        ));
                    }
                }
                continue;
            }

            // 🗺️ (mapa)
            if c == '🗺' {
                let (l, col, off) = (self.line, self.col, self.pos);
                self.advance(); // consume 🗺
                                // El emoji puede venir con variation selector U+FE0F
                if self.peek() == Some('\u{FE0F}') {
                    self.advance();
                }
                tokens.push((Token::GlyphMap, self.current_span(l, col, off)));
                continue;
            }

            // Referencia @xxx
            if c == '@' {
                let (l, col, off) = (self.line, self.col, self.pos);
                self.advance();
                let name = self.read_identifier_body();
                if name.is_empty() {
                    return Err(self.make_error(
                        "se esperaba identificador después de '@'",
                        l,
                        col,
                        off,
                    ));
                }
                tokens.push((Token::Reference(name), self.current_span(l, col, off)));
                continue;
            }

            // Condición ?xxx
            if c == '?' {
                let (l, col, off) = (self.line, self.col, self.pos);
                self.advance();
                let name = self.read_identifier_body();
                if name.is_empty() {
                    return Err(self.make_error(
                        "se esperaba identificador después de '?'",
                        l,
                        col,
                        off,
                    ));
                }
                tokens.push((Token::Conditional(name), self.current_span(l, col, off)));
                continue;
            }

            // Modificador ~xxx
            if c == '~' {
                let (l, col, off) = (self.line, self.col, self.pos);
                self.advance();
                let name = self.read_identifier_body();
                if name.is_empty() {
                    return Err(self.make_error(
                        "se esperaba identificador después de '~'",
                        l,
                        col,
                        off,
                    ));
                }
                tokens.push((Token::Modifier(name), self.current_span(l, col, off)));
                continue;
            }

            // Strings
            if c == '"' || c == '\'' {
                let (l, col, off) = (self.line, self.col, self.pos);
                let s = self.read_string(c)?;
                tokens.push((Token::String(s), self.current_span(l, col, off)));
                continue;
            }

            // Números (incluyendo negativos)
            if c.is_ascii_digit()
                || (c == '-' && matches!(self.peek_at(1), Some(d) if d.is_ascii_digit()))
            {
                let (l, col, off) = (self.line, self.col, self.pos);
                let tok = self.read_number()?;
                tokens.push((tok, self.current_span(l, col, off)));
                continue;
            }

            // Identificadores
            if c.is_alphabetic() || c == '_' {
                let (l, col, off) = (self.line, self.col, self.pos);
                let name = self.read_identifier_body();
                tokens.push((Token::Identifier(name), self.current_span(l, col, off)));
                continue;
            }

            // Operadores de 2 caracteres
            let (l, col, off) = (self.line, self.col, self.pos);
            match (c, self.peek_at(1)) {
                ('>', Some('>')) => {
                    self.advance();
                    self.advance();
                    tokens.push((Token::Pipe, self.current_span(l, col, off)));
                }
                ('>', Some('=')) => {
                    self.advance();
                    self.advance();
                    tokens.push((Token::Gte, self.current_span(l, col, off)));
                }
                ('<', Some('=')) => {
                    self.advance();
                    self.advance();
                    tokens.push((Token::Lte, self.current_span(l, col, off)));
                }
                ('=', Some('=')) => {
                    self.advance();
                    self.advance();
                    tokens.push((Token::Eq, self.current_span(l, col, off)));
                }
                ('!', Some('=')) => {
                    self.advance();
                    self.advance();
                    tokens.push((Token::Neq, self.current_span(l, col, off)));
                }
                ('|', Some('|')) => {
                    self.advance();
                    self.advance();
                    tokens.push((Token::Concat, self.current_span(l, col, off)));
                }
                ('-', Some('>')) => {
                    self.advance();
                    self.advance();
                    tokens.push((Token::Arrow, self.current_span(l, col, off)));
                }
                _ => {}
            }
            if self.pos != off {
                continue;
            }

            // Operadores y puntuación de 1 carácter
            let tok = match c {
                ':' => Token::Colon,
                ',' => Token::Comma,
                ';' => Token::Semicolon,
                '/' => Token::Slash,
                '[' => Token::OpenBracket,
                ']' => Token::CloseBracket,
                '(' => Token::OpenParen,
                ')' => Token::CloseParen,
                '{' => Token::OpenBrace,
                '}' => Token::CloseBrace,
                '=' => Token::Equals,
                '|' => Token::Bar,
                '+' => Token::Plus,
                '-' => Token::Minus,
                '>' => Token::Gt,
                '<' => Token::Lt,
                _ => {
                    return Err(self.make_error(
                        format!("carácter inesperado '{}'", c),
                        l,
                        col,
                        off,
                    ));
                }
            };
            self.advance();
            tokens.push((tok, self.current_span(l, col, off)));
        }
    }

    // ---- Helpers de lectura ----

    fn skip_whitespace_non_newline(&mut self) {
        while let Some(c) = self.peek() {
            if c == ' ' || c == '\t' || c == '\r' {
                self.advance();
            } else {
                break;
            }
        }
    }

    fn read_identifier_body(&mut self) -> String {
        let mut s = String::new();
        while let Some(c) = self.peek() {
            if c.is_alphanumeric() || c == '_' {
                s.push(c);
                self.advance();
            } else {
                break;
            }
        }
        s
    }

    fn read_string(&mut self, quote: char) -> Result<String, LexError> {
        let (l, col, off) = (self.line, self.col, self.pos);
        self.advance(); // consume opening quote
        let mut s = String::new();
        loop {
            match self.advance() {
                Some(c) if c == quote => return Ok(s),
                Some('\\') => match self.advance() {
                    Some('n') => s.push('\n'),
                    Some('t') => s.push('\t'),
                    Some('r') => s.push('\r'),
                    Some('\\') => s.push('\\'),
                    Some(q) if q == quote => s.push(quote),
                    Some(other) => {
                        s.push('\\');
                        s.push(other);
                    }
                    None => {
                        return Err(self.make_error(
                            "escape incompleto al final del archivo",
                            l,
                            col,
                            off,
                        ))
                    }
                },
                Some(c) => s.push(c),
                None => return Err(self.make_error("string sin comilla de cierre", l, col, off)),
            }
        }
    }

    fn read_number(&mut self) -> Result<Token, LexError> {
        let (l, col, off) = (self.line, self.col, self.pos);
        let mut s = String::new();

        if self.peek() == Some('-') {
            s.push('-');
            self.advance();
        }

        let mut has_dot = false;
        while let Some(c) = self.peek() {
            if c.is_ascii_digit() {
                s.push(c);
                self.advance();
            } else if c == '.' && !has_dot {
                // Solo permitir '.' si hay un dígito antes
                if s.is_empty() || s == "-" {
                    break;
                }
                has_dot = true;
                s.push(c);
                self.advance();
            } else {
                break;
            }
        }

        // Verificar sufijo Hz
        if self.peek() == Some('H') && self.peek_at(1) == Some('z') {
            self.advance();
            self.advance();
            let val: f64 = s
                .parse()
                .map_err(|_| self.make_error("frecuencia Hz inválida", l, col, off))?;
            return Ok(Token::Hertz(val));
        }

        if has_dot {
            let val: f64 = s
                .parse()
                .map_err(|_| self.make_error("número flotante inválido", l, col, off))?;
            Ok(Token::Number(val))
        } else {
            let val: i64 = s
                .parse()
                .map_err(|_| self.make_error("entero inválido", l, col, off))?;
            Ok(Token::Integer(val))
        }
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn lex(input: &str) -> Vec<Token> {
        let mut lexer = Lexer::new(input);
        let spanned = lexer.tokenize().expect("lexing debe tener éxito");
        spanned.into_iter().map(|(t, _)| t).collect()
    }

    fn lex_no_eof(input: &str) -> Vec<Token> {
        let mut toks = lex(input);
        toks.pop(); // quitar EOF
        toks.retain(|t| *t != Token::Newline); // quitar newlines
        toks
    }

    #[test]
    fn test_simple_command() {
        let toks = lex_no_eof("Armonizar: Suelo_Biotico[528Hz]");
        assert_eq!(
            toks,
            vec![
                Token::Identifier("Armonizar".into()),
                Token::Colon,
                Token::Identifier("Suelo_Biotico".into()),
                Token::OpenBracket,
                Token::Hertz(528.0),
                Token::CloseBracket,
            ]
        );
    }

    #[test]
    fn test_string_quoted() {
        let toks = lex_no_eof(r#"Guardar: Archivo["MiCaptura"]"#);
        assert_eq!(
            toks,
            vec![
                Token::Identifier("Guardar".into()),
                Token::Colon,
                Token::Identifier("Archivo".into()),
                Token::OpenBracket,
                Token::String("MiCaptura".into()),
                Token::CloseBracket,
            ]
        );
    }

    #[test]
    fn test_pipeline() {
        let toks = lex_no_eof("Ver: Camara >> Guardar: Archivo");
        assert!(toks.contains(&Token::Pipe));
        assert_eq!(toks.iter().filter(|t| matches!(t, Token::Pipe)).count(), 1);
    }

    #[test]
    fn test_reference_condition_modifier() {
        let toks = lex_no_eof("@now ?bateria_baja ~pulso");
        assert_eq!(
            toks,
            vec![
                Token::Reference("now".into()),
                Token::Conditional("bateria_baja".into()),
                Token::Modifier("pulso".into()),
            ]
        );
    }

    #[test]
    fn test_modifier_with_value() {
        let toks = lex_no_eof("~aire:12");
        assert_eq!(
            toks,
            vec![
                Token::Modifier("aire".into()),
                Token::Colon,
                Token::Integer(12),
            ]
        );
    }

    #[test]
    fn test_invariant_with_operators() {
        let toks = lex_no_eof("INVARIANT: Etica >= 0.85");
        assert_eq!(
            toks,
            vec![
                Token::Identifier("INVARIANT".into()),
                Token::Colon,
                Token::Identifier("Etica".into()),
                Token::Gte,
                Token::Number(0.85),
            ]
        );
    }

    #[test]
    fn test_all_relational_ops() {
        let toks = lex_no_eof(">= <= > < == !=");
        assert_eq!(
            toks,
            vec![
                Token::Gte,
                Token::Lte,
                Token::Gt,
                Token::Lt,
                Token::Eq,
                Token::Neq
            ]
        );
    }

    #[test]
    fn test_glifos_k_script() {
        let toks = lex_no_eof("•| •-");
        assert_eq!(toks, vec![Token::GlyphVertical, Token::GlyphHorizontal]);
    }

    #[test]
    fn test_glyph_map() {
        let toks = lex_no_eof("🗺️[Header/Footer]");
        assert_eq!(
            toks,
            vec![
                Token::GlyphMap,
                Token::OpenBracket,
                Token::Identifier("Header".into()),
                Token::Slash,
                Token::Identifier("Footer".into()),
                Token::CloseBracket,
            ]
        );
    }

    #[test]
    fn test_comments() {
        let toks = lex_no_eof("// esto es un comentario\nArmonizar: Suelo");
        assert!(toks.iter().any(|t| matches!(t, Token::Comment(_))));
        assert!(toks
            .iter()
            .any(|t| matches!(t, Token::Identifier(s) if s == "Armonizar")));
    }

    #[test]
    fn test_hash_comment() {
        let toks = lex_no_eof("# otro comentario");
        assert_eq!(toks.len(), 1);
        assert!(matches!(&toks[0], Token::Comment(c) if c.starts_with('#')));
    }

    #[test]
    fn test_numbers_integer_float_negative() {
        let toks = lex_no_eof("42 0.85 -1.5 -7");
        assert_eq!(
            toks,
            vec![
                Token::Integer(42),
                Token::Number(0.85),
                Token::Number(-1.5),
                Token::Integer(-7),
            ]
        );
    }

    #[test]
    fn test_causal_arrow_range() {
        let toks = lex_no_eof("[0.3 -> 0.9]");
        assert_eq!(
            toks,
            vec![
                Token::OpenBracket,
                Token::Number(0.3),
                Token::Arrow,
                Token::Number(0.9),
                Token::CloseBracket,
            ]
        );
    }

    #[test]
    fn test_concat_operator() {
        let toks = lex_no_eof("a || b");
        assert!(toks.contains(&Token::Concat));
        assert!(!toks.contains(&Token::Bar));
    }

    #[test]
    fn test_unclosed_string_error() {
        let mut lexer = Lexer::new(r#""sin cerrar"#);
        let err = lexer.tokenize();
        assert!(err.is_err());
        let e = err.unwrap_err();
        assert!(e.message.contains("string sin comilla"));
    }

    #[test]
    fn test_glifo_invalido_error() {
        let mut lexer = Lexer::new("•X");
        let err = lexer.tokenize();
        assert!(err.is_err());
    }

    #[test]
    fn test_span_tracking() {
        let mut lexer = Lexer::new("Armonizar: Suelo");
        let toks = lexer.tokenize().unwrap();
        // Primer token debe estar en línea 1, col 1
        assert_eq!(toks[0].1.line, 1);
        assert_eq!(toks[0].1.col, 1);
    }

    #[test]
    fn test_koko_v2_header() {
        let src = r#"RIMA: HelloWorld_v2
VERSION: "2.0.0-hello"
AUTOR: Mariano_Leguiza
INVARIANT: Etica >= 0.85"#;
        let toks = lex_no_eof(src);
        assert!(toks
            .iter()
            .any(|t| matches!(t, Token::Identifier(s) if s == "RIMA")));
        assert!(toks
            .iter()
            .any(|t| matches!(t, Token::String(s) if s == "2.0.0-hello")));
        assert!(toks.iter().any(|t| matches!(t, Token::Gte)));
    }
}
