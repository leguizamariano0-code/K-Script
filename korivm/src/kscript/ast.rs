//! Módulo `ast`: Árbol de Sintaxis Abstracta de K-Script y `.koko` v2.0.
//!
//! Este módulo define el CONTRATO entre el parser y el evaluador.
//! El parser produce `Rima` (el árbol). El evaluador consume `Rima`.
//!
//! Diseño:
//! - Independiente de `dictionary.rs` (no lo importa).
//! - Los `canonical_id` se rellenan en el parser usando `KScriptDictionary`.
//! - Soporta gramática K-Script v1.1 (commands, pipelines, layouts) y
//!   `.koko` v2.0 (5 capas ontológicas: cabecera, topológicos, causal,
//!   resonancia, residuo).
//! - Cada nodo puede llevar `Span` para mensajes de error precisos.

use std::fmt;

/// Posición en el archivo fuente para mensajes de error.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Span {
    pub line: u32,
    pub col: u32,
    pub offset: u32,
    pub len: u32,
}

impl Span {
    pub fn new(line: u32, col: u32, offset: u32, len: u32) -> Self {
        Self {
            line,
            col,
            offset,
            len,
        }
    }

    /// Span "vacío" (para nodos sintéticos generados en tests).
    pub fn zero() -> Self {
        Self {
            line: 0,
            col: 0,
            offset: 0,
            len: 0,
        }
    }
}

impl Default for Span {
    fn default() -> Self {
        Self::zero()
    }
}

/// Nodo con su posición en fuente.
#[derive(Debug, Clone, PartialEq)]
pub struct Spanned<T> {
    pub node: T,
    pub span: Span,
}

impl<T> Spanned<T> {
    pub fn new(node: T, span: Span) -> Self {
        Self { node, span }
    }

    pub fn synthetic(node: T) -> Self {
        Self {
            node,
            span: Span::zero(),
        }
    }
}

// ============================================================================
// REFERENCIAS A VERBO Y SUJETO (resueltas contra el diccionario)
// ============================================================================

/// Referencia a un verbo del diccionario.
/// - `raw_name`: lo que apareció en el fuente (para errores y round-trip).
/// - `canonical_id`: Some(id) si coincide con un verbo canónico o alias.
#[derive(Debug, Clone, PartialEq)]
pub struct VerbRef {
    pub raw_name: String,
    pub canonical_id: Option<usize>,
}

impl VerbRef {
    pub fn new(raw_name: impl Into<String>, canonical_id: Option<usize>) -> Self {
        Self {
            raw_name: raw_name.into(),
            canonical_id,
        }
    }

    pub fn is_known(&self) -> bool {
        self.canonical_id.is_some()
    }
}

/// Referencia a un sujeto del diccionario.
#[derive(Debug, Clone, PartialEq)]
pub struct SubjectRef {
    pub raw_name: String,
    pub canonical_id: Option<usize>,
}

impl SubjectRef {
    pub fn new(raw_name: impl Into<String>, canonical_id: Option<usize>) -> Self {
        Self {
            raw_name: raw_name.into(),
            canonical_id,
        }
    }

    pub fn is_known(&self) -> bool {
        self.canonical_id.is_some()
    }
}

// ============================================================================
// VALORES Y PARÁMETROS
// ============================================================================

/// Un valor literal o calculado dentro de un parámetro.
#[derive(Debug, Clone, PartialEq)]
pub enum Parametro {
    /// Número flotante: 0.5, 3.14, -1
    Number(f64),
    /// Número entero: 42 (guardado como i64 para no perder precisión)
    Integer(i64),
    /// Cadena literal: "MiCaptura" o 'texto'
    String(String),
    /// Identificador sin comillas: Nombre_Objeto
    Identifier(String),
    /// Frecuencia en Hz: 528Hz
    Hertz(f64),
    /// Referencia a resultado previo o variable: @last, @result
    Reference(String),
    /// Array: [1, 2, 3] o [a, b, c]
    Array(Vec<Parametro>),
    /// Par clave-valor dentro de un parámetro: Parametros[Tipo: binario]
    KeyValue(Box<NamedParam>),
    /// Expresión binaria (reservado para futuro: `a + b`)
    BinaryOp {
        op: BinaryOperator,
        left: Box<Parametro>,
        right: Box<Parametro>,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BinaryOperator {
    Add,      // +
    Subtract, // -
    Concat,   // ||
}

/// Parámetro con nombre: `key: value`.
#[derive(Debug, Clone, PartialEq)]
pub struct NamedParam {
    pub key: String,
    pub value: Parametro,
}

// ============================================================================
// MODIFICADORES
// ============================================================================

/// Modificador que se aplica a un comando.
#[derive(Debug, Clone, PartialEq)]
pub enum Modificador {
    /// ~pulso — emisión pulsante
    Pulse,
    /// (texto) — tooltip al pasar el mouse
    Tooltip(String),
    /// ~hover:flotar — efecto al hover
    Hover(String),
    /// ~aire:12 — espaciado
    Air(u8),
    /// ~curva:organica — tipo de curva
    Curve(String),
    /// ~esencia — invoca esencia semántica (de un tema)
    Esence(String),
    /// ~modificador:valor — custom
    Custom { key: String, value: Option<String> },
}

// ============================================================================
// TIEMPO Y CONDICIÓN (@time, ?condition)
// ============================================================================

/// Calificador temporal.
#[derive(Debug, Clone, PartialEq)]
pub enum Tiempo {
    Now,                        // @now
    Delayed(f64),               // @after:0.5
    Scheduled { when: String }, // @at:"2026-01-01"
    Custom(String),
}

/// Condición de ejecución.
#[derive(Debug, Clone, PartialEq)]
pub enum Condicion {
    BatteryLow,                                     // ?bateria_baja
    SensorAbove { sensor: String, threshold: f64 }, // ?temperatura>30
    Custom(String),
}

// ============================================================================
// COMANDOS Y STATEMENTS
// ============================================================================

/// Comando básico: `Verbo: Sujeto[params] modifiers @time ?cond`
#[derive(Debug, Clone, PartialEq)]
pub struct Command {
    pub verb: VerbRef,
    pub subject: SubjectRef,
    pub params: Vec<Parametro>,
    pub modifiers: Vec<Modificador>,
    pub time: Option<Tiempo>,
    pub condition: Option<Condicion>,
}

/// Celda dentro de un layout.
#[derive(Debug, Clone, PartialEq)]
pub struct LayoutCell {
    pub content: Box<Statement>,
    pub weight: Option<f64>,
}

/// Tipo de layout.
#[derive(Debug, Clone, PartialEq)]
pub enum LayoutExpr {
    /// `•|` — vertical
    Vertical(Vec<LayoutCell>),
    /// `•-` — horizontal
    Horizontal(Vec<LayoutCell>),
    /// `•|N` — vertical con N columnas
    WithColumns { n: u8, cells: Vec<LayoutCell> },
}

/// Sección dentro de un mapa de layout (`🗺️[...]`).
#[derive(Debug, Clone, PartialEq)]
pub struct LayoutSection {
    pub name: String,
    pub children: Vec<LayoutSection>,
    pub is_leaf: bool,
}

/// Mapa de layout completo (`🗺️[Header / Body / Footer]`).
#[derive(Debug, Clone, PartialEq)]
pub struct LayoutMap {
    pub sections: Vec<LayoutSection>,
}

// ============================================================================
// KOKO v2.0 — CAPAS ONTOLÓGICAS
// ============================================================================

/// Operador relacional en invariantes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RelationalOp {
    Gte, // >=
    Lte, // <=
    Gt,  // >
    Lt,  // <
    Eq,  // ==
    Neq, // !=
}

impl fmt::Display for RelationalOp {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            RelationalOp::Gte => ">=",
            RelationalOp::Lte => "<=",
            RelationalOp::Gt => ">",
            RelationalOp::Lt => "<",
            RelationalOp::Eq => "==",
            RelationalOp::Neq => "!=",
        };
        write!(f, "{}", s)
    }
}

/// Invariante constitucional: `INVARIANT: Etica >= 0.85`
#[derive(Debug, Clone, PartialEq)]
pub struct InvariantExpr {
    pub subject: String,
    pub op: RelationalOp,
    pub value: f64,
}

/// Item topológico de la Capa 1: `Nombre[Hello World]`
#[derive(Debug, Clone, PartialEq)]
pub struct TopologyItem {
    pub key: String,
    pub value: Parametro,
}

/// Nodo del grafo causal (Capa 2).
#[derive(Debug, Clone, PartialEq)]
pub struct CausalNode {
    pub id: String,
    pub depends_on: Vec<String>,
    pub operator: Option<String>,
    pub params: Vec<NamedParam>,
}

/// Punto de trayectoria emocional (Capa 3): `t0.5[vec8]`
#[derive(Debug, Clone, PartialEq)]
pub struct TrajectoryPoint {
    pub t: f64,
    pub vector: [f64; 8],
}

/// Entrada armónica (Capa 3): `528[Reparacion]`
#[derive(Debug, Clone, PartialEq)]
pub struct HarmonicEntry {
    pub freq_hz: f64,
    pub label: String,
}

/// Bloque de pesos de reconstrucción.
#[derive(Debug, Clone, PartialEq)]
pub struct WeightsBlock {
    pub topologicos: f64,
    pub causales: f64,
    pub resonancia: f64,
    pub interferencia: f64,
}

impl WeightsBlock {
    /// Valida que los 4 pesos sumen ~1.0 (± 1e-6).
    pub fn validate_sum(&self) -> Result<(), String> {
        let sum = self.topologicos + self.causales + self.resonancia + self.interferencia;
        if (sum - 1.0).abs() > 1e-6 {
            return Err(format!(
                "PESOS_RECONSTRUCCION deben sumar 1.0 (suma actual: {:.6})",
                sum
            ));
        }
        Ok(())
    }
}

// ============================================================================
// STATEMENT (nodo unificado del AST)
// ============================================================================

/// Un statement de K-Script o de `.koko` v2.0.
#[derive(Debug, Clone, PartialEq)]
pub enum StatementKind {
    // ---- K-Script v1.1 ----
    /// Comando básico con verbo y sujeto.
    Command(Command),
    /// Pipeline: `A >> B >> C`
    Pipeline(Vec<Statement>),
    /// Layout vertical/horizontal: `•|` o `•-`
    Layout(LayoutExpr),
    /// Mapa visual: `🗺️[...]`
    LayoutMap(LayoutMap),
    /// Comentario (`// ...` o `# ...`).
    Comment(String),

    // ---- Koko v2.0 — Capa 0 ----
    /// `VERSION: "2.0.0"` / `AUTOR: ...` / `HASH: ...` / `FIRMA: ...`
    HeaderField { key: String, value: Parametro },
    /// `INVARIANT: Etica >= 0.85`
    Invariant(InvariantExpr),
    /// `FRECUENCIAS: 174 | 285 | ...`
    Frequencies(Vec<f64>),

    // ---- Koko v2.0 — Capa 1 ----
    /// `TOPOLOGICOS: Nombre[...] | Genero[...] | ...`
    Topology(Vec<TopologyItem>),

    // ---- Koko v2.0 — Capa 2 ----
    /// `CAUSAL: NODO_00_Semilla[...]`
    CausalNode(CausalNode),
    /// `ORDEN: NODO_00 | NODO_01 | ...`
    CausalOrder(Vec<String>),

    // ---- Koko v2.0 — Capa 3 ----
    /// `RESONANCIA: Vector[8 floats]`
    Resonance([f64; 8]),
    /// `TRAYECTORIA: t0.0[...] | t0.5[...] | ...`
    Trajectory(Vec<TrajectoryPoint>),
    /// `ARMONICOS: 432[...] | 528[...] | ...`
    Harmonics(Vec<HarmonicEntry>),

    // ---- Koko v2.0 — Capa 4 ----
    /// `RESIDUO: Mascara[...] | Algoritmo[...] | ...`
    Residue(Vec<NamedParam>),

    // ---- Koko v2.0 — Pesos ----
    /// `PESOS: Topologicos[0.30] | Causales[0.0] | ...`
    Weights(WeightsBlock),
}

/// Un statement con su span.
pub type Statement = Spanned<StatementKind>;

// ============================================================================
// RIMA — RAÍZ DEL AST
// ============================================================================

/// Archivo `.koko` o script K-Script completo.
#[derive(Debug, Clone, PartialEq)]
pub struct Rima {
    pub name: String,
    pub statements: Vec<Statement>,
    /// Versión detectada: K-Script v1.1, .koko v2.0, o mixto.
    pub version: FileVersion,
}

/// Versión del archivo fuente.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileVersion {
    KScriptV11,
    KokoV20,
    Mixed,
    Unknown,
}

impl Rima {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            statements: Vec::new(),
            version: FileVersion::Unknown,
        }
    }

    /// Itera sobre todos los commands del archivo (incluyendo nested en pipelines).
    pub fn iter_commands(&self) -> Box<dyn Iterator<Item = &Command> + '_> {
        Box::new(self.statements.iter().flat_map(iter_commands_in))
    }

    /// Cuenta cuántos verbos conocidos y desconocidos hay.
    pub fn stats(&self) -> RimaStats {
        let mut stats = RimaStats::default();
        for cmd in self.iter_commands() {
            if cmd.verb.is_known() {
                stats.known_verbs += 1;
            } else {
                stats.unknown_verbs.push(cmd.verb.raw_name.clone());
            }
            if !cmd.subject.is_known() {
                stats.unknown_subjects.push(cmd.subject.raw_name.clone());
            }
        }
        stats
    }
}

fn iter_commands_in<'a>(s: &'a Statement) -> Box<dyn Iterator<Item = &'a Command> + 'a> {
    match &s.node {
        StatementKind::Command(c) => Box::new(std::iter::once(c)),
        StatementKind::Pipeline(stmts) => Box::new(stmts.iter().flat_map(iter_commands_in)),
        StatementKind::Layout(LayoutExpr::Vertical(cells))
        | StatementKind::Layout(LayoutExpr::Horizontal(cells))
        | StatementKind::Layout(LayoutExpr::WithColumns { cells, .. }) => {
            Box::new(cells.iter().flat_map(|c| iter_commands_in(&c.content)))
        }
        _ => Box::new(std::iter::empty()),
    }
}

/// Estadísticas de un archivo.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct RimaStats {
    pub known_verbs: usize,
    pub unknown_verbs: Vec<String>,
    pub unknown_subjects: Vec<String>,
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn vref(name: &str, id: Option<usize>) -> VerbRef {
        VerbRef::new(name, id)
    }

    fn sref(name: &str, id: Option<usize>) -> SubjectRef {
        SubjectRef::new(name, id)
    }

    fn cmd(verb: &str, vid: Option<usize>, subj: &str, sid: Option<usize>) -> Statement {
        Spanned::synthetic(StatementKind::Command(Command {
            verb: vref(verb, vid),
            subject: sref(subj, sid),
            params: Vec::new(),
            modifiers: Vec::new(),
            time: None,
            condition: None,
        }))
    }

    #[test]
    fn test_simple_command() {
        let stmt = cmd("Armonizar", Some(59), "Suelo_Biotico", Some(0));
        if let StatementKind::Command(c) = &stmt.node {
            assert_eq!(c.verb.raw_name, "Armonizar");
            assert_eq!(c.verb.canonical_id, Some(59));
            assert!(c.verb.is_known());
            assert_eq!(c.subject.raw_name, "Suelo_Biotico");
        } else {
            panic!("Se esperaba Command");
        }
    }

    #[test]
    fn test_command_with_hz_param() {
        let stmt = Spanned::synthetic(StatementKind::Command(Command {
            verb: vref("Armonizar", Some(59)),
            subject: sref("Suelo_Biotico", Some(0)),
            params: vec![Parametro::Hertz(528.0)],
            modifiers: vec![Modificador::Pulse],
            time: Some(Tiempo::Now),
            condition: None,
        }));
        if let StatementKind::Command(c) = &stmt.node {
            assert_eq!(c.params.len(), 1);
            assert!(matches!(c.params[0], Parametro::Hertz(hz) if (hz - 528.0).abs() < 1e-9));
            assert!(matches!(c.modifiers[0], Modificador::Pulse));
            assert!(matches!(c.time, Some(Tiempo::Now)));
        }
    }

    #[test]
    fn test_pipeline() {
        let s1 = cmd("Ver", Some(32), "Camara_Esencia", None);
        let s2 = cmd("Guardar", Some(11), "Archivo_Imagen", None);
        let pipeline = Spanned::synthetic(StatementKind::Pipeline(vec![s1, s2]));
        if let StatementKind::Pipeline(stmts) = &pipeline.node {
            assert_eq!(stmts.len(), 2);
        } else {
            panic!("Se esperaba Pipeline");
        }
    }

    #[test]
    fn test_koko_v2_full() {
        let mut rima = Rima::new("HelloWorld_v2");
        rima.version = FileVersion::KokoV20;

        // Capa 0
        rima.statements
            .push(Spanned::synthetic(StatementKind::HeaderField {
                key: "VERSION".into(),
                value: Parametro::String("2.0.0-hello".into()),
            }));
        rima.statements
            .push(Spanned::synthetic(StatementKind::Invariant(
                InvariantExpr {
                    subject: "Etica".into(),
                    op: RelationalOp::Gte,
                    value: 0.85,
                },
            )));
        rima.statements
            .push(Spanned::synthetic(StatementKind::Frequencies(vec![
                0.174, 0.285, 0.396, 0.417, 0.432, 0.528, 0.639, 0.741, 0.852, 0.963,
            ])));

        // Capa 1
        rima.statements
            .push(Spanned::synthetic(StatementKind::Topology(vec![
                TopologyItem {
                    key: "Nombre".into(),
                    value: Parametro::String("Hello".into()),
                },
                TopologyItem {
                    key: "Genero".into(),
                    value: Parametro::Identifier("Visualizador".into()),
                },
            ])));

        // Capa 3
        rima.statements
            .push(Spanned::synthetic(StatementKind::Resonance([
                0.4, 0.15, 0.5, 0.2, 0.95, 0.1, 0.528, 0.08,
            ])));

        // Pesos
        let weights = WeightsBlock {
            topologicos: 0.30,
            causales: 0.0,
            resonancia: 0.70,
            interferencia: 0.0,
        };
        assert!(weights.validate_sum().is_ok());
        rima.statements
            .push(Spanned::synthetic(StatementKind::Weights(weights)));

        // Verificaciones
        assert_eq!(rima.name, "HelloWorld_v2");
        assert_eq!(rima.version, FileVersion::KokoV20);
        assert_eq!(rima.statements.len(), 6);
    }

    #[test]
    fn test_weights_validation_fails() {
        let weights = WeightsBlock {
            topologicos: 0.5,
            causales: 0.5,
            resonancia: 0.5,
            interferencia: 0.5, // suma 2.0 → error
        };
        assert!(weights.validate_sum().is_err());
    }

    #[test]
    fn test_rima_stats_with_unknown_verb() {
        let mut rima = Rima::new("test");
        rima.statements
            .push(cmd("Armonizar", Some(59), "Suelo_Biotico", Some(0)));
        rima.statements
            .push(cmd("InventadoXYZ", None, "Suelo_Biotico", Some(0)));
        let stats = rima.stats();
        assert_eq!(stats.known_verbs, 1);
        assert_eq!(stats.unknown_verbs.len(), 1);
        assert_eq!(stats.unknown_verbs[0], "InventadoXYZ");
    }

    #[test]
    fn test_iter_commands_through_pipeline() {
        let mut rima = Rima::new("test");
        let s1 = cmd("Sentir", Some(33), "Clima", None);
        let s2 = cmd("Visualizar", Some(40), "Lienzo", None);
        rima.statements
            .push(Spanned::synthetic(StatementKind::Pipeline(vec![s1, s2])));
        let cmds: Vec<&Command> = rima.iter_commands().collect();
        assert_eq!(cmds.len(), 2);
    }

    #[test]
    fn test_causal_node() {
        let node = CausalNode {
            id: "NODO_00_Semilla".into(),
            depends_on: vec![],
            operator: Some("Instanciar".into()),
            params: vec![NamedParam {
                key: "Escena".into(),
                value: Parametro::String("nave".into()),
            }],
        };
        let stmt = Spanned::synthetic(StatementKind::CausalNode(node));
        if let StatementKind::CausalNode(n) = &stmt.node {
            assert_eq!(n.id, "NODO_00_Semilla");
            assert_eq!(n.operator.as_deref(), Some("Instanciar"));
        }
    }

    #[test]
    fn test_trajectory_point() {
        let tp = TrajectoryPoint {
            t: 0.5,
            vector: [0.3, 0.1, 0.4, 0.2, 0.7, 0.1, 0.4, 0.2],
        };
        let stmt = Spanned::synthetic(StatementKind::Trajectory(vec![tp.clone()]));
        if let StatementKind::Trajectory(pts) = &stmt.node {
            assert_eq!(pts.len(), 1);
            assert!((pts[0].t - 0.5).abs() < 1e-9);
            assert!((pts[0].vector[4] - 0.7).abs() < 1e-9);
        }
    }

    #[test]
    fn test_span_zero() {
        let s = Span::zero();
        assert_eq!(s.line, 0);
        assert_eq!(s.col, 0);
    }
}
