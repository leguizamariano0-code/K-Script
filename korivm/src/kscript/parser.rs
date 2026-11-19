//! Módulo `parser`: convierte tokens de K-Script / .koko v2.0 en un AST `Rima`.
//!
//! Recursión descendente, sin llaves, alineado con `ast.rs` v2.0 y `lexer.rs`.
//! El parser rellena `VerbRef.canonical_id` y `SubjectRef.canonical_id`
//! consultando `KScriptDictionary` en tiempo de parseo.

use crate::kscript::ast::*;
use crate::kscript::dictionary::KScriptDictionary;
use crate::kscript::lexer::{Lexer, SpannedToken, Token};
use std::fmt;

// ============================================================================
// ERRORES
// ============================================================================

#[derive(Debug, Clone, PartialEq)]
pub struct ParseError {
    pub message: String,
    pub span: Span,
}

impl fmt::Display for ParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Error de parseo en línea {}, col {}: {}",
            self.span.line, self.span.col, self.message
        )
    }
}

impl std::error::Error for ParseError {}

impl ParseError {
    fn new(message: impl Into<String>, span: Span) -> Self {
        Self {
            message: message.into(),
            span,
        }
    }
}

// ============================================================================
// PARSER
// ============================================================================

pub struct Parser {
    tokens: Vec<SpannedToken>,
    pos: usize,
}

impl Parser {
    pub fn new(tokens: Vec<SpannedToken>) -> Self {
        Self { tokens, pos: 0 }
    }

    /// Punto de entrada: string → Rima.
    pub fn parse(input: &str) -> Result<Rima, ParseError> {
        let mut lexer = Lexer::new(input);
        let tokens = lexer
            .tokenize()
            .map_err(|e| ParseError::new(e.message, e.span))?;
        let mut p = Self::new(tokens);
        p.parse_program()
    }

    // ---- Programa completo ----

    fn parse_program(&mut self) -> Result<Rima, ParseError> {
        self.skip_newlines();

        let mut name = "unnamed".to_string();
        let mut version = FileVersion::Unknown;

        if self.check_keyword("RIMA") {
            self.advance();
            self.expect(&Token::Colon)?;
            name = self.expect_identifier()?;
            version = FileVersion::KokoV20;
            self.skip_newlines();
        }

        let mut statements = Vec::new();
        loop {
            self.skip_newlines();
            if self.check_eof() {
                break;
            }
            statements.push(self.parse_statement()?);
        }

        if version == FileVersion::Unknown {
            let has_v2 = statements.iter().any(|s| is_v2_kind(&s.node));
            version = if has_v2 {
                FileVersion::KokoV20
            } else {
                FileVersion::KScriptV11
            };
        }

        Ok(Rima {
            name,
            statements,
            version,
        })
    }

    // ---- Dispatcher ----

    fn parse_statement(&mut self) -> Result<Statement, ParseError> {
        let start = self.current_span();

        if let Some(ident) = self.peek_identifier() {
            match ident.to_uppercase().as_str() {
                "VERSION" | "AUTOR" | "HASH" | "FIRMA" => return self.parse_header_field(start),
                "INVARIANT" => return self.parse_invariant(start),
                "FRECUENCIAS" => return self.parse_frequencies(start),
                "TOPOLOGICOS" => return self.parse_topology(start),
                "CAUSAL" => return self.parse_causal_node(start),
                "ORDEN" => return self.parse_causal_order(start),
                "RESONANCIA" => return self.parse_resonance(start),
                "TRAYECTORIA" => return self.parse_trajectory(start),
                "ARMONICOS" => return self.parse_harmonics(start),
                "RESIDUO" => return self.parse_residue(start),
                "PESOS" => return self.parse_weights(start),
                _ => {}
            }
        }
        self.parse_kscript(start)
    }

    // ---- Capa 0 ----

    fn parse_header_field(&mut self, start: Span) -> Result<Statement, ParseError> {
        let key = self.expect_identifier()?;
        self.expect(&Token::Colon)?;
        let value = self.parse_param()?;
        self.consume_optional(&Token::Semicolon);
        Ok(Spanned::new(
            StatementKind::HeaderField { key, value },
            start,
        ))
    }

    fn parse_invariant(&mut self, start: Span) -> Result<Statement, ParseError> {
        self.expect_keyword("INVARIANT")?;
        self.expect(&Token::Colon)?;
        let subject = self.expect_identifier()?;
        let op = self.expect_relational_op()?;
        let value = self.expect_number()?;
        self.consume_optional(&Token::Semicolon);
        Ok(Spanned::new(
            StatementKind::Invariant(InvariantExpr { subject, op, value }),
            start,
        ))
    }

    fn parse_frequencies(&mut self, start: Span) -> Result<Statement, ParseError> {
        self.expect_keyword("FRECUENCIAS")?;
        self.expect(&Token::Colon)?;
        let mut freqs = vec![self.expect_number()?];
        while self.consume_optional(&Token::Bar) {
            freqs.push(self.expect_number()?);
        }
        self.consume_optional(&Token::Semicolon);
        Ok(Spanned::new(StatementKind::Frequencies(freqs), start))
    }

    // ---- Capa 1 ----

    fn parse_topology(&mut self, start: Span) -> Result<Statement, ParseError> {
        self.expect_keyword("TOPOLOGICOS")?;
        self.expect(&Token::Colon)?;
        let mut items = vec![self.parse_topology_item()?];
        while self.consume_optional(&Token::Bar) {
            items.push(self.parse_topology_item()?);
        }
        self.consume_optional(&Token::Semicolon);
        Ok(Spanned::new(StatementKind::Topology(items), start))
    }

    fn parse_topology_item(&mut self) -> Result<TopologyItem, ParseError> {
        let key = self.expect_identifier()?;
        self.expect(&Token::OpenBracket)?;
        let value = self.parse_param()?;
        self.expect(&Token::CloseBracket)?;
        Ok(TopologyItem { key, value })
    }

    // ---- Capa 2 ----

    fn parse_causal_node(&mut self, start: Span) -> Result<Statement, ParseError> {
        self.expect_keyword("CAUSAL")?;
        self.expect(&Token::Colon)?;
        let id = self.expect_identifier()?;
        self.expect(&Token::OpenBracket)?;

        let mut depends_on = Vec::new();
        let mut operator: Option<String> = None;
        let mut params = Vec::new();

        if !self.check(&Token::CloseBracket) {
            loop {
                let key = self.expect_identifier()?;
                self.expect(&Token::Colon)?;

                // Detectar lista de dependencias: Depende:NODO_00 | NODO_01
                let value = if key.eq_ignore_ascii_case("Depende")
                    || key.eq_ignore_ascii_case("Depende_De")
                {
                    let mut deps = vec![self.expect_identifier()?];
                    while self.consume_optional(&Token::Bar) {
                        deps.push(self.expect_identifier()?);
                    }
                    depends_on = deps;
                    Parametro::Identifier(String::new()) // placeholder, no se usa
                } else {
                    self.parse_param()?
                };

                if key.eq_ignore_ascii_case("Operador") {
                    if let Parametro::Identifier(ref op) = value {
                        operator = Some(op.clone());
                    } else if let Parametro::String(ref op) = value {
                        operator = Some(op.clone());
                    }
                } else if !key.eq_ignore_ascii_case("Depende")
                    && !key.eq_ignore_ascii_case("Depende_De")
                {
                    params.push(NamedParam { key, value });
                }

                if !self.consume_optional(&Token::Comma) {
                    break;
                }
            }
        }
        self.expect(&Token::CloseBracket)?;
        self.consume_optional(&Token::Semicolon);

        Ok(Spanned::new(
            StatementKind::CausalNode(CausalNode {
                id,
                depends_on,
                operator,
                params,
            }),
            start,
        ))
    }

    fn parse_causal_order(&mut self, start: Span) -> Result<Statement, ParseError> {
        self.expect_keyword("ORDEN")?;
        self.expect(&Token::Colon)?;
        let mut ids = vec![self.expect_identifier()?];
        while self.consume_optional(&Token::Bar) {
            ids.push(self.expect_identifier()?);
        }
        self.consume_optional(&Token::Semicolon);
        Ok(Spanned::new(StatementKind::CausalOrder(ids), start))
    }

    // ---- Capa 3 ----

    fn parse_resonance(&mut self, start: Span) -> Result<Statement, ParseError> {
        self.expect_keyword("RESONANCIA")?;
        self.expect(&Token::Colon)?;
        // Aceptar tanto "RESONANCIA: Vector[...]" como "RESONANCIA: [...]"
        if self.check_keyword("Vector") {
            self.advance();
        }
        self.expect(&Token::OpenBracket)?;
        let mut vals = Vec::with_capacity(8);
        for _ in 0..8 {
            vals.push(self.expect_number()?);
            self.consume_optional(&Token::Comma);
        }
        self.expect(&Token::CloseBracket)?;
        self.consume_optional(&Token::Semicolon);
        let vec8: [f64; 8] = vals
            .try_into()
            .map_err(|_| self.err_at_current("Resonance requiere 8 valores"))?;
        Ok(Spanned::new(StatementKind::Resonance(vec8), start))
    }

    fn parse_trajectory(&mut self, start: Span) -> Result<Statement, ParseError> {
        self.expect_keyword("TRAYECTORIA")?;
        self.expect(&Token::Colon)?;
        let mut points = vec![self.parse_trajectory_point()?];
        while self.consume_optional(&Token::Bar) {
            points.push(self.parse_trajectory_point()?);
        }
        self.consume_optional(&Token::Semicolon);
        Ok(Spanned::new(StatementKind::Trajectory(points), start))
    }

    fn parse_trajectory_point(&mut self) -> Result<TrajectoryPoint, ParseError> {
        // Sintaxis MVP: <t> [ v0, v1, ..., v7 ]  (sin prefijo "t" para evitar Token::Dot)
        let t = self.expect_number()?;
        self.expect(&Token::OpenBracket)?;
        let mut vals = Vec::with_capacity(8);
        for _ in 0..8 {
            vals.push(self.expect_number()?);
            self.consume_optional(&Token::Comma);
        }
        self.expect(&Token::CloseBracket)?;
        let vector: [f64; 8] = vals
            .try_into()
            .map_err(|_| self.err_at_current("trajectory point requiere 8 valores"))?;
        Ok(TrajectoryPoint { t, vector })
    }

    fn parse_harmonics(&mut self, start: Span) -> Result<Statement, ParseError> {
        self.expect_keyword("ARMONICOS")?;
        self.expect(&Token::Colon)?;
        let mut entries = vec![self.parse_harmonic_entry()?];
        while self.consume_optional(&Token::Bar) {
            entries.push(self.parse_harmonic_entry()?);
        }
        self.consume_optional(&Token::Semicolon);
        Ok(Spanned::new(StatementKind::Harmonics(entries), start))
    }

    fn parse_harmonic_entry(&mut self) -> Result<HarmonicEntry, ParseError> {
        let freq_hz = self.expect_number()?;
        self.expect(&Token::OpenBracket)?;
        let label = self.expect_identifier()?;
        self.expect(&Token::CloseBracket)?;
        Ok(HarmonicEntry { freq_hz, label })
    }

    // ---- Capa 4 ----

    fn parse_residue(&mut self, start: Span) -> Result<Statement, ParseError> {
        self.expect_keyword("RESIDUO")?;
        self.expect(&Token::Colon)?;
        let mut params = vec![self.parse_named_param_bracket()?];
        while self.consume_optional(&Token::Bar) {
            params.push(self.parse_named_param_bracket()?);
        }
        self.consume_optional(&Token::Semicolon);
        Ok(Spanned::new(StatementKind::Residue(params), start))
    }

    fn parse_named_param_bracket(&mut self) -> Result<NamedParam, ParseError> {
        let key = self.expect_identifier()?;
        self.expect(&Token::OpenBracket)?;
        let value = self.parse_param()?;
        self.expect(&Token::CloseBracket)?;
        Ok(NamedParam { key, value })
    }

    // ---- Pesos ----

    fn parse_weights(&mut self, start: Span) -> Result<Statement, ParseError> {
        self.expect_keyword("PESOS")?;
        self.expect(&Token::Colon)?;

        let mut topologicos = 0.0;
        let mut causales = 0.0;
        let mut resonancia = 0.0;
        let mut interferencia = 0.0;

        loop {
            let key = self.expect_identifier()?;
            self.expect(&Token::OpenBracket)?;
            let val = self.expect_number()?;
            self.expect(&Token::CloseBracket)?;
            match key.to_lowercase().as_str() {
                "topologicos" => topologicos = val,
                "causales" => causales = val,
                "resonancia" => resonancia = val,
                "interferencia" => interferencia = val,
                _ => {
                    return Err(
                        self.err_at_current(format!("clave de pesos desconocida: '{}'", key))
                    )
                }
            }
            if !self.consume_optional(&Token::Bar) {
                break;
            }
        }
        self.consume_optional(&Token::Semicolon);

        let wb = WeightsBlock {
            topologicos,
            causales,
            resonancia,
            interferencia,
        };
        Ok(Spanned::new(StatementKind::Weights(wb), start))
    }

    // ---- K-Script (commands, pipelines, layouts) ----

    fn parse_kscript(&mut self, start: Span) -> Result<Statement, ParseError> {
        if self.check(&Token::GlyphVertical) || self.check(&Token::GlyphHorizontal) {
            return self.parse_layout(start);
        }
        if self.check(&Token::GlyphMap) {
            return self.parse_layout_map(start);
        }
        self.parse_command_or_pipeline(start)
    }

    fn parse_command_or_pipeline(&mut self, start: Span) -> Result<Statement, ParseError> {
        let first = self.parse_command()?;
        if !self.check(&Token::Pipe) {
            return Ok(first);
        }
        let mut stmts = vec![first];
        while self.check(&Token::Pipe) {
            self.advance();
            self.skip_newlines();
            stmts.push(self.parse_command()?);
        }
        Ok(Spanned::new(StatementKind::Pipeline(stmts), start))
    }

    fn parse_command(&mut self) -> Result<Statement, ParseError> {
        let start = self.current_span();
        let verb_name = self.expect_identifier()?;
        let verb_id = KScriptDictionary::resolve_canonical_id(&verb_name);

        self.expect(&Token::Colon)?;
        let subject_name = self.expect_identifier()?;
        let subject_id = KScriptDictionary::SUBJECTS
            .iter()
            .position(|s| s.name.eq_ignore_ascii_case(&subject_name));

        let params = if self.check(&Token::OpenBracket) {
            self.parse_params()?
        } else {
            Vec::new()
        };

        let mut modifiers = Vec::new();
        let mut time = None;
        let mut condition = None;
        loop {
            if self.check(&Token::Modifier(String::new())) {
                modifiers.push(self.parse_modifier()?);
            } else if self.check(&Token::Reference(String::new())) && time.is_none() {
                time = Some(self.parse_time()?);
            } else if self.check(&Token::Conditional(String::new())) && condition.is_none() {
                condition = Some(self.parse_condition()?);
            } else {
                break;
            }
        }
        self.consume_optional(&Token::Semicolon);

        Ok(Spanned::new(
            StatementKind::Command(Command {
                verb: VerbRef::new(verb_name, verb_id),
                subject: SubjectRef::new(subject_name, subject_id),
                params,
                modifiers,
                time,
                condition,
            }),
            start,
        ))
    }

    fn parse_params(&mut self) -> Result<Vec<Parametro>, ParseError> {
        self.expect(&Token::OpenBracket)?;
        let mut params = Vec::new();
        if !self.check(&Token::CloseBracket) {
            loop {
                params.push(self.parse_param()?);
                if !self.consume_optional(&Token::Comma) {
                    break;
                }
            }
        }
        self.expect(&Token::CloseBracket)?;
        Ok(params)
    }

    fn parse_param(&mut self) -> Result<Parametro, ParseError> {
        match self.peek_token().clone() {
            Token::Integer(i) => {
                self.advance();
                Ok(Parametro::Integer(i))
            }
            Token::Number(n) => {
                self.advance();
                Ok(Parametro::Number(n))
            }
            Token::String(s) => {
                self.advance();
                Ok(Parametro::String(s))
            }
            Token::Hertz(hz) => {
                self.advance();
                Ok(Parametro::Hertz(hz))
            }
            Token::Reference(r) => {
                self.advance();
                Ok(Parametro::Reference(r))
            }
            Token::Identifier(name) => {
                self.advance();
                if self.check(&Token::Colon) {
                    self.advance();
                    let value = self.parse_param()?;
                    Ok(Parametro::KeyValue(Box::new(NamedParam {
                        key: name,
                        value,
                    })))
                } else {
                    Ok(Parametro::Identifier(name))
                }
            }
            Token::OpenBracket => {
                self.advance();
                let mut items = Vec::new();
                if !self.check(&Token::CloseBracket) {
                    loop {
                        items.push(self.parse_param()?);
                        if !self.consume_optional(&Token::Comma) {
                            break;
                        }
                    }
                }
                self.expect(&Token::CloseBracket)?;
                Ok(Parametro::Array(items))
            }
            other => Err(self.err_at_current(format!(
                "se esperaba parámetro, se encontró {}",
                other.kind_name()
            ))),
        }
    }

    fn parse_modifier(&mut self) -> Result<Modificador, ParseError> {
        if let Token::Modifier(name) = self.peek_token().clone() {
            self.advance();
            Ok(match name.as_str() {
                "pulso" => Modificador::Pulse,
                "aire" => {
                    self.expect(&Token::Colon)?;
                    let v = self.expect_integer()? as u8;
                    Modificador::Air(v)
                }
                "curva" => {
                    self.expect(&Token::Colon)?;
                    Modificador::Curve(self.expect_identifier()?)
                }
                "hover" => {
                    self.expect(&Token::Colon)?;
                    Modificador::Hover(self.expect_identifier()?)
                }
                "esencia" => Modificador::Esence(String::new()),
                other => Modificador::Custom {
                    key: other.to_string(),
                    value: None,
                },
            })
        } else {
            Err(self.err_at_current("se esperaba modificador"))
        }
    }

    fn parse_time(&mut self) -> Result<Tiempo, ParseError> {
        if let Token::Reference(name) = self.peek_token().clone() {
            self.advance();
            Ok(match name.as_str() {
                "now" => Tiempo::Now,
                "after" => {
                    self.expect(&Token::Colon)?;
                    Tiempo::Delayed(self.expect_number()?)
                }
                "at" => {
                    self.expect(&Token::Colon)?;
                    Tiempo::Scheduled {
                        when: self.expect_string()?,
                    }
                }
                other => Tiempo::Custom(other.to_string()),
            })
        } else {
            Err(self.err_at_current("se esperaba tiempo (@)"))
        }
    }

    fn parse_condition(&mut self) -> Result<Condicion, ParseError> {
        if let Token::Conditional(name) = self.peek_token().clone() {
            self.advance();
            Ok(match name.as_str() {
                "bateria_baja" => Condicion::BatteryLow,
                other => Condicion::Custom(other.to_string()),
            })
        } else {
            Err(self.err_at_current("se esperaba condición (?)"))
        }
    }

    fn parse_layout(&mut self, start: Span) -> Result<Statement, ParseError> {
        // •| o •- o •|N
        let glyph = self.peek_token().clone();
        self.advance();
        let mut n_cols: Option<u8> = None;
        if self.consume_optional(&Token::Colon) {
            n_cols = Some(self.expect_integer()? as u8);
            self.consume_optional(&Token::Colon);
        }
        // Celdas separadas por Bar
        let mut cells = vec![self.parse_layout_cell()?];
        while self.consume_optional(&Token::Bar) {
            cells.push(self.parse_layout_cell()?);
        }
        let expr = match (glyph, n_cols) {
            (Token::GlyphVertical, Some(n)) => LayoutExpr::WithColumns { n, cells },
            (Token::GlyphVertical, None) => LayoutExpr::Vertical(cells),
            (Token::GlyphHorizontal, _) => LayoutExpr::Horizontal(cells),
            _ => return Err(self.err_at_current("glifo de layout inválido")),
        };
        Ok(Spanned::new(StatementKind::Layout(expr), start))
    }

    fn parse_layout_cell(&mut self) -> Result<LayoutCell, ParseError> {
        let content = self.parse_command()?;
        Ok(LayoutCell {
            content: Box::new(content),
            weight: None,
        })
    }

    fn parse_layout_map(&mut self, start: Span) -> Result<Statement, ParseError> {
        self.expect(&Token::GlyphMap)?;
        self.expect(&Token::OpenBracket)?;
        let mut sections = vec![self.parse_layout_section()?];
        while self.consume_optional(&Token::Slash) {
            sections.push(self.parse_layout_section()?);
        }
        self.expect(&Token::CloseBracket)?;
        Ok(Spanned::new(
            StatementKind::LayoutMap(LayoutMap { sections }),
            start,
        ))
    }

    fn parse_layout_section(&mut self) -> Result<LayoutSection, ParseError> {
        if self.check(&Token::OpenBracket) {
            self.advance();
            let mut children = vec![self.parse_layout_section()?];
            while self.consume_optional(&Token::Slash) {
                children.push(self.parse_layout_section()?);
            }
            self.expect(&Token::CloseBracket)?;
            Ok(LayoutSection {
                name: "(grupo)".into(),
                children,
                is_leaf: false,
            })
        } else {
            let name = self.expect_identifier()?;
            Ok(LayoutSection {
                name,
                children: Vec::new(),
                is_leaf: true,
            })
        }
    }

    // ---- Helpers de navegación ----

    fn peek_token(&self) -> &Token {
        &self.tokens[self.pos].0
    }

    fn current_span(&self) -> Span {
        self.tokens[self.pos].1
    }

    fn advance(&mut self) {
        if self.pos < self.tokens.len() - 1 {
            self.pos += 1;
        }
    }

    fn check(&self, expected: &Token) -> bool {
        std::mem::discriminant(self.peek_token()) == std::mem::discriminant(expected)
    }

    fn check_keyword(&self, kw: &str) -> bool {
        matches!(self.peek_token(), Token::Identifier(s) if s.eq_ignore_ascii_case(kw))
    }

    fn check_eof(&self) -> bool {
        matches!(self.peek_token(), Token::EOF)
    }

    fn peek_identifier(&self) -> Option<&str> {
        if let Token::Identifier(s) = self.peek_token() {
            Some(s)
        } else {
            None
        }
    }

    fn expect(&mut self, expected: &Token) -> Result<(), ParseError> {
        if self.check(expected) {
            self.advance();
            Ok(())
        } else {
            Err(self.err_at_current(format!(
                "se esperaba {}, se encontró {}",
                expected.kind_name(),
                self.peek_token().kind_name()
            )))
        }
    }

    fn expect_keyword(&mut self, kw: &str) -> Result<(), ParseError> {
        if self.check_keyword(kw) {
            self.advance();
            Ok(())
        } else {
            Err(self.err_at_current(format!("se esperaba '{}'", kw)))
        }
    }

    fn expect_identifier(&mut self) -> Result<String, ParseError> {
        match self.peek_token().clone() {
            Token::Identifier(s) => {
                self.advance();
                Ok(s)
            }
            other => Err(self.err_at_current(format!(
                "se esperaba identificador, se encontró {}",
                other.kind_name()
            ))),
        }
    }

    fn expect_number(&mut self) -> Result<f64, ParseError> {
        match self.peek_token().clone() {
            Token::Number(n) => {
                self.advance();
                Ok(n)
            }
            Token::Integer(i) => {
                self.advance();
                Ok(i as f64)
            }
            other => Err(self.err_at_current(format!(
                "se esperaba número, se encontró {}",
                other.kind_name()
            ))),
        }
    }

    fn expect_integer(&mut self) -> Result<i64, ParseError> {
        match self.peek_token().clone() {
            Token::Integer(i) => {
                self.advance();
                Ok(i)
            }
            Token::Number(n) => {
                self.advance();
                Ok(n as i64)
            }
            other => Err(self.err_at_current(format!(
                "se esperaba entero, se encontró {}",
                other.kind_name()
            ))),
        }
    }

    fn expect_string(&mut self) -> Result<String, ParseError> {
        match self.peek_token().clone() {
            Token::String(s) => {
                self.advance();
                Ok(s)
            }
            other => Err(self.err_at_current(format!(
                "se esperaba string, se encontró {}",
                other.kind_name()
            ))),
        }
    }

    fn expect_relational_op(&mut self) -> Result<RelationalOp, ParseError> {
        let op = match self.peek_token() {
            Token::Gte => RelationalOp::Gte,
            Token::Lte => RelationalOp::Lte,
            Token::Gt => RelationalOp::Gt,
            Token::Lt => RelationalOp::Lt,
            Token::Eq => RelationalOp::Eq,
            Token::Neq => RelationalOp::Neq,
            other => {
                return Err(self.err_at_current(format!(
                    "se esperaba operador relacional, se encontró {}",
                    other.kind_name()
                )))
            }
        };
        self.advance();
        Ok(op)
    }

    fn consume_optional(&mut self, expected: &Token) -> bool {
        if self.check(expected) {
            self.advance();
            true
        } else {
            false
        }
    }

    fn skip_newlines(&mut self) {
        while self.check(&Token::Newline) || self.check(&Token::Comment(String::new())) {
            self.advance();
        }
    }

    fn err_at_current(&self, msg: impl Into<String>) -> ParseError {
        ParseError::new(msg, self.current_span())
    }
}

fn is_v2_kind(kind: &StatementKind) -> bool {
    matches!(
        kind,
        StatementKind::HeaderField { .. }
            | StatementKind::Invariant(_)
            | StatementKind::Frequencies(_)
            | StatementKind::Topology(_)
            | StatementKind::CausalNode(_)
            | StatementKind::CausalOrder(_)
            | StatementKind::Resonance(_)
            | StatementKind::Trajectory(_)
            | StatementKind::Harmonics(_)
            | StatementKind::Residue(_)
            | StatementKind::Weights(_)
    )
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_ok(src: &str) -> Rima {
        Parser::parse(src).expect("parse debe tener éxito")
    }

    #[test]
    fn test_simple_command() {
        let rima = parse_ok("Armonizar: Suelo_Biotico[528Hz]");
        assert_eq!(rima.statements.len(), 1);
        if let StatementKind::Command(c) = &rima.statements[0].node {
            assert_eq!(c.verb.raw_name, "Armonizar");
            assert!(c.verb.canonical_id.is_some()); // alias resuelto a Modular (59)
            assert_eq!(c.subject.raw_name, "Suelo_Biotico");
            assert_eq!(c.params.len(), 1);
            assert!(matches!(c.params[0], Parametro::Hertz(hz) if (hz - 528.0).abs() < 1e-9));
        } else {
            panic!("se esperaba Command");
        }
    }

    #[test]
    fn test_pipeline() {
        let rima = parse_ok("Ver: Camara >> Guardar: Archivo");
        assert_eq!(rima.statements.len(), 1);
        if let StatementKind::Pipeline(stmts) = &rima.statements[0].node {
            assert_eq!(stmts.len(), 2);
        } else {
            panic!("se esperaba Pipeline");
        }
    }

    #[test]
    fn test_koko_v2_header() {
        let src = r#"RIMA: HelloWorld_v2
VERSION: "2.0.0-hello"
AUTOR: Mariano_Leguiza
INVARIANT: Etica >= 0.85"#;
        let rima = parse_ok(src);
        assert_eq!(rima.name, "HelloWorld_v2");
        assert_eq!(rima.version, FileVersion::KokoV20);
        assert_eq!(rima.statements.len(), 3);
        assert!(matches!(
            rima.statements[0].node,
            StatementKind::HeaderField { .. }
        ));
        assert!(matches!(
            rima.statements[1].node,
            StatementKind::HeaderField { .. }
        ));
        assert!(matches!(
            rima.statements[2].node,
            StatementKind::Invariant(_)
        ));
    }

    #[test]
    fn test_frequencies() {
        let rima = parse_ok(
            "FRECUENCIAS: 0.174 | 0.285 | 0.396 | 0.417 | 0.432 | 0.528 | 0.639 | 0.741 | 0.852 | 0.963",
        );
        if let StatementKind::Frequencies(freqs) = &rima.statements[0].node {
            assert_eq!(freqs.len(), 10);
            assert!((freqs[5] - 0.528).abs() < 1e-9);
        } else {
            panic!("se esperaba Frequencies");
        }
    }

    #[test]
    fn test_topology() {
        //Nota: los colores hex (#...) deben ir entre comillas porque `#` sin comillas inicia comentario en lexer.rs
        let rima = parse_ok(
            r##"TOPOLOGICOS: Nombre["Hello"] | Genero[Visualizador] | Paleta["#af9aca"]"##,
        );
        if let StatementKind::Topology(items) = &rima.statements[0].node {
            assert_eq!(items.len(), 3);
            assert_eq!(items[0].key, "Nombre");
            assert_eq!(items[1].key, "Genero");
            assert_eq!(items[2].key, "Paleta");
        } else {
            panic!("se esperaba Topology");
        }
    }

    #[test]
    fn test_resonance() {
        let rima = parse_ok("RESONANCIA: Vector[0.4, 0.15, 0.5, 0.2, 0.95, 0.1, 0.528, 0.08]");
        if let StatementKind::Resonance(v) = &rima.statements[0].node {
            assert!((v[0] - 0.4).abs() < 1e-9);
            assert!((v[4] - 0.95).abs() < 1e-9);
        } else {
            panic!("se esperaba Resonance");
        }
    }

    #[test]
    fn test_trajectory_without_t_prefix() {
        let rima = parse_ok(
            "TRAYECTORIA: 0.0[0.3, 0.1, 0.4, 0.2, 0.7, 0.1, 0.4, 0.2] | 0.5[0.5, 0.3, 0.5, 0.3, 0.85, 0.15, 0.5, 0.15]",
        );
        if let StatementKind::Trajectory(pts) = &rima.statements[0].node {
            assert_eq!(pts.len(), 2);
            assert!((pts[0].t - 0.0).abs() < 1e-9);
            assert!((pts[1].t - 0.5).abs() < 1e-9);
        } else {
            panic!("se esperaba Trajectory");
        }
    }

    #[test]
    fn test_weights_valid() {
        let rima = parse_ok(
            "PESOS: Topologicos[0.30] | Causales[0.00] | Resonancia[0.70] | Interferencia[0.00]",
        );
        if let StatementKind::Weights(w) = &rima.statements[0].node {
            assert!((w.topologicos - 0.30).abs() < 1e-9);
            assert!(w.validate_sum().is_ok());
        } else {
            panic!("se esperaba Weights");
        }
    }

    #[test]
    fn test_weights_sum_parses_but_does_not_validate() {
        let rima = parse_ok(
            "PESOS: Topologicos[0.5] | Causales[0.5] | Resonancia[0.5] | Interferencia[0.5]",
        );
        if let StatementKind::Weights(w) = &rima.statements[0].node {
            assert!(w.validate_sum().is_err());
        } else {
            panic!("se esperaba Weights");
        }
    }

    #[test]
    fn test_causal_order() {
        let rima = parse_ok("ORDEN: NODO_00_Semilla | NODO_01_Camara | NODO_02_Luz");
        if let StatementKind::CausalOrder(ids) = &rima.statements[0].node {
            assert_eq!(ids.len(), 3);
            assert_eq!(ids[0], "NODO_00_Semilla");
        } else {
            panic!("se esperaba CausalOrder");
        }
    }

    #[test]
    fn test_command_with_modifier_and_time() {
        let rima = parse_ok("Sentir: Clima_termica ~pulso @now");
        if let StatementKind::Command(c) = &rima.statements[0].node {
            assert_eq!(c.modifiers.len(), 1);
            assert!(matches!(c.modifiers[0], Modificador::Pulse));
            assert!(matches!(c.time, Some(Tiempo::Now)));
        } else {
            panic!("se esperaba Command");
        }
    }

    #[test]
    fn test_unknown_verb_still_parses() {
        let rima = parse_ok("InventadoXYZ: Suelo_Biotico");
        if let StatementKind::Command(c) = &rima.statements[0].node {
            assert!(!c.verb.is_known());
            assert_eq!(c.verb.raw_name, "InventadoXYZ");
        } else {
            panic!("se esperaba Command");
        }
    }
}
