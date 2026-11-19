//! Módulo `evaluator`: ejecuta un AST `Rima` produciendo un estado 8D + diagnósticos.
//!
//! Responsabilidades:
//! - Procesar las 5 capas .koko v2.0 (cabecera, topología, causal, resonancia, residuo).
//! - Ejecutar commands K-Script aplicando el metadata de `KScriptDictionary`.
//! - Validar invariantes constitucionales (`Etica >= 0.85`, `‖x₄‖ < 0.999`).
//! - Emitir `EvaluationResult` con el estado final + historia.

use crate::kscript::ast::*;
use crate::kscript::dictionary::KScriptDictionary;
use std::collections::HashMap;
use std::fmt;

// ============================================================================
// VALORES
// ============================================================================

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Null,
    Bool(bool),
    Integer(i64),
    Number(f64),
    String(String),
    Vector8([f64; 8]),
    Array(Vec<Value>),
    /// Marcador de efecto (visualización, audio, persistencia).
    Effect {
        kind: String,
        payload: String,
    },
}

// ============================================================================
// ERRORES
// ============================================================================

#[derive(Debug, Clone, PartialEq)]
pub enum EvalError {
    InvariantViolation {
        name: String,
        expected: String,
        actual: f64,
    },
    PoincareViolation {
        norm: f64,
    },
    EthicsFloorViolation {
        floor: f64,
        actual: f64,
    },
    WeightsInvalid(String),
    NotImplemented {
        verb: String,
        subject: String,
    },
    UnknownVerb(String),
    Other(String),
}

impl fmt::Display for EvalError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            EvalError::InvariantViolation {
                name,
                expected,
                actual,
            } => write!(
                f,
                "invariante '{}' violado: esperado {}, obtenido {}",
                name, expected, actual
            ),
            EvalError::PoincareViolation { norm } => {
                write!(f, "norma de Poincaré {:.4} excede el límite 0.999", norm)
            }
            EvalError::EthicsFloorViolation { floor, actual } => {
                write!(f, "piso ético {:.2} violado (actual: {:.2})", floor, actual)
            }
            EvalError::WeightsInvalid(s) => write!(f, "pesos inválidos: {}", s),
            EvalError::NotImplemented { verb, subject } => write!(
                f,
                "verbo '{}' sobre sujeto '{}' no implementado en MVP",
                verb, subject
            ),
            EvalError::UnknownVerb(v) => write!(f, "verbo desconocido: '{}'", v),
            EvalError::Other(s) => write!(f, "{}", s),
        }
    }
}

impl std::error::Error for EvalError {}

// ============================================================================
// CONTEXTO DE EJECUCIÓN
// ============================================================================

#[derive(Debug, Clone)]
pub struct ExecutionContext {
    /// Estado semántico actual [c, t, s, ch, et, en, res, inc].
    pub state: [f64; 8],
    /// Invariantes declarados en Capa 0.
    pub invariants: Vec<InvariantExpr>,
    /// Frecuencias Solfeggio declaradas en Capa 0.
    pub frequencies: Vec<f64>,
    /// Bloque de pesos (Capa 4 / PESOS).
    pub weights: Option<WeightsBlock>,
    /// Capa 1: invariantes topológicos.
    pub topology: HashMap<String, Parametro>,
    /// Variables locales (para pipelines, @last, etc.).
    pub variables: HashMap<String, Value>,
    /// Resultado del último statement.
    pub last_result: Value,
    /// Historia de ejecución (para debug y tests).
    pub history: Vec<String>,
}

impl ExecutionContext {
    pub fn new() -> Self {
        Self {
            // Estado por defecto: cero, salvo ética que arranca en el piso 0.85
            state: [0.0, 0.0, 0.0, 0.0, 0.85, 0.0, 0.5, 0.0],
            invariants: Vec::new(),
            frequencies: vec![
                0.174, 0.285, 0.396, 0.417, 0.432, 0.528, 0.639, 0.741, 0.852, 0.963,
            ],
            weights: None,
            topology: HashMap::new(),
            variables: HashMap::new(),
            last_result: Value::Null,
            history: Vec::new(),
        }
    }

    fn log(&mut self, msg: impl Into<String>) {
        self.history.push(msg.into());
    }

    fn project_onto_disk(&mut self) {
        const POINCARE_LIMIT: f64 = 0.999;
        // Radio de seguridad estricto < 0.999 para evitar falsos positivos por redondeo IEEE-754 en f64
        const POINCARE_SAFE_RADIUS: f64 = 0.998999;
        let norm = (self.state[0].powi(2)
            + self.state[1].powi(2)
            + self.state[2].powi(2)
            + self.state[3].powi(2))
        .sqrt();
        if norm >= POINCARE_LIMIT {
            let factor = POINCARE_SAFE_RADIUS / norm;
            for coord in self.state.iter_mut().take(4) {
                *coord *= factor;
            }
        }
    }

    fn enforce_ethics_floor(&mut self, floor: f64) {
        self.state[4] = self.state[4].max(floor);
    }
}

impl Default for ExecutionContext {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// RESULTADO
// ============================================================================

#[derive(Debug, Clone)]
pub struct EvaluationResult {
    pub final_state: [f64; 8],
    pub poincare_norm: f64,
    pub invariants_preserved: bool,
    pub topology: HashMap<String, Parametro>,
    pub weights: Option<WeightsBlock>,
    pub last_value: Value,
    pub history: Vec<String>,
}

// ============================================================================
// EVALUADOR
// ============================================================================

pub struct Evaluator;

impl Evaluator {
    /// Punto de entrada: ejecuta un AST `Rima` completo.
    pub fn evaluate(rima: &Rima) -> Result<EvaluationResult, EvalError> {
        let mut ctx = ExecutionContext::new();

        // Fase 1: procesar statements declarativos y comandos
        for stmt in &rima.statements {
            Self::execute_statement(&mut ctx, stmt)?;
        }

        // Fase 2: validar invariantes constitucionales
        Self::validate_invariants(&ctx)?;

        // Fase 3: validar piso ético global (0.85)
        if ctx.state[4] < 0.85 {
            return Err(EvalError::EthicsFloorViolation {
                floor: 0.85,
                actual: ctx.state[4],
            });
        }

        // Fase 4: validar norma de Poincaré
        let poincare_norm = (ctx.state[0].powi(2)
            + ctx.state[1].powi(2)
            + ctx.state[2].powi(2)
            + ctx.state[3].powi(2))
        .sqrt();
        if poincare_norm >= 0.999 {
            return Err(EvalError::PoincareViolation {
                norm: poincare_norm,
            });
        }

        Ok(EvaluationResult {
            final_state: ctx.state,
            poincare_norm,
            invariants_preserved: true,
            topology: ctx.topology,
            weights: ctx.weights,
            last_value: ctx.last_result.clone(),
            history: ctx.history,
        })
    }

    // ---- Dispatcher ----

    fn execute_statement(ctx: &mut ExecutionContext, stmt: &Statement) -> Result<(), EvalError> {
        match &stmt.node {
            // ---- Capa 0 ----
            StatementKind::HeaderField { key, value } => {
                ctx.variables
                    .insert(key.clone(), Self::param_to_value(value));
                ctx.log(format!("header {} = {:?}", key, value));
            }
            StatementKind::Invariant(inv) => {
                ctx.invariants.push(inv.clone());
                ctx.log(format!(
                    "invariant {} {} {}",
                    inv.subject, inv.op, inv.value
                ));
                // Enforce ética como caso especial
                if inv.subject.eq_ignore_ascii_case("Etica") && inv.op == RelationalOp::Gte {
                    ctx.enforce_ethics_floor(inv.value);
                }
            }
            StatementKind::Frequencies(freqs) => {
                ctx.frequencies = freqs.clone();
                ctx.log(format!("frequencies: {} valores", freqs.len()));
            }

            // ---- Capa 1 ----
            StatementKind::Topology(items) => {
                for item in items {
                    ctx.topology.insert(item.key.clone(), item.value.clone());
                }
                ctx.log(format!("topology: {} items", items.len()));
            }

            // ---- Capa 2 ----
            StatementKind::CausalNode(node) => {
                ctx.log(format!(
                    "causal node {} (deps: {})",
                    node.id,
                    node.depends_on.len()
                ));
                // MVP: registrar en historia; grafo causal se evalúa en fase posterior
            }
            StatementKind::CausalOrder(order) => {
                ctx.log(format!("causal order: {} nodos", order.len()));
            }

            // ---- Capa 3 ----
            StatementKind::Resonance(vec8) => {
                // Solo las 4 primeras coords son hiperbólicas
                ctx.state[..4].copy_from_slice(&vec8[..4]);
                // Las 4 últimas son invariantes: forzar ética >= 0.85
                ctx.state[4] = vec8[4].max(0.85);
                ctx.state[5] = vec8[5].clamp(0.0, 1.0);
                ctx.state[6] = vec8[6].clamp(0.0, 1.0);
                ctx.state[7] = vec8[7].clamp(0.0, 1.0);
                ctx.project_onto_disk();
                ctx.log(format!("resonance: {:?}", ctx.state));
            }
            StatementKind::Trajectory(points) => {
                ctx.log(format!("trajectory: {} puntos", points.len()));
                // MVP: usar el último punto como estado de partida
                if let Some(last) = points.last() {
                    ctx.state[..4].copy_from_slice(&last.vector[..4]);
                    ctx.state[4] = last.vector[4].max(0.85);
                    ctx.state[5] = last.vector[5].clamp(0.0, 1.0);
                    ctx.state[6] = last.vector[6].clamp(0.0, 1.0);
                    ctx.state[7] = last.vector[7].clamp(0.0, 1.0);
                    ctx.project_onto_disk();
                }
            }
            StatementKind::Harmonics(entries) => {
                ctx.log(format!("harmonics: {} entradas", entries.len()));
                for e in entries {
                    ctx.variables
                        .insert(format!("harmonic_{}", e.label), Value::Number(e.freq_hz));
                }
            }

            // ---- Capa 4 ----
            StatementKind::Residue(params) => {
                for p in params {
                    ctx.variables
                        .insert(format!("residue_{}", p.key), Self::param_to_value(&p.value));
                }
                ctx.log(format!("residue: {} params", params.len()));
            }

            // ---- Pesos ----
            StatementKind::Weights(w) => {
                w.validate_sum().map_err(EvalError::WeightsInvalid)?;
                ctx.weights = Some(w.clone());
                ctx.log("weights validados (suma = 1.0)");
            }

            // ---- K-Script ----
            StatementKind::Command(cmd) => {
                let value = Self::execute_command(ctx, cmd)?;
                ctx.last_result = value.clone();
                ctx.variables.insert("@last".into(), value);
            }
            StatementKind::Pipeline(stmts) => {
                for sub in stmts {
                    Self::execute_statement(ctx, sub)?;
                }
            }
            StatementKind::Layout(_) | StatementKind::LayoutMap(_) => {
                // MVP: registrar en historia; layouts se resuelven en el renderer
                ctx.log("layout registrado (no ejecutado en MVP)");
            }
            StatementKind::Comment(_) => {
                // Ignorar
            }
        }
        Ok(())
    }

    // ---- Ejecución de commands ----

    fn execute_command(ctx: &mut ExecutionContext, cmd: &Command) -> Result<Value, EvalError> {
        let verb_def = match cmd.verb.canonical_id {
            Some(id) => KScriptDictionary::VERBS.get(id),
            None => None,
        };

        // 1. Aplicar metadata del verbo al estado
        if let Some(vdef) = verb_def {
            // Causal impact sobre χ (dimensión 3)
            ctx.state[3] = (ctx.state[3] + vdef.causal_impact * 0.1).clamp(-0.999, 0.999);
            // Energética (dimensión 5)
            ctx.state[5] = (ctx.state[5] + vdef.energy_cost * 0.05).clamp(0.0, 1.0);
            // Ética forzada al piso del verbo
            ctx.enforce_ethics_floor(vdef.ethical_floor);
        }

        // 2. Aplicar parámetros
        let mut output_hint = String::new();
        for p in &cmd.params {
            match p {
                Parametro::Hertz(hz) => {
                    ctx.state[6] = normalize_solfeggio(*hz);
                    output_hint = format!(" @{}Hz", hz);
                }
                Parametro::Number(n) => {
                    // Sin semántica específica: influir conceptualmente leve
                    ctx.state[0] = (ctx.state[0] + n * 0.01).clamp(-0.999, 0.999);
                }
                Parametro::String(s) => {
                    output_hint.push_str(&format!(" \"{}\"", s));
                }
                _ => {}
            }
        }

        // 3. Aplicar tiempo/condición (MVP: solo registrar)
        if let Some(t) = &cmd.time {
            ctx.log(format!("tiempo: {:?}", t));
        }
        if let Some(c) = &cmd.condition {
            ctx.log(format!("condición: {:?}", c));
        }

        // 4. Proyectar al disco tras mutaciones
        ctx.project_onto_disk();

        // 5. Verb-specific output (usando nombre canónico si es alias)
        let verb_key = verb_def
            .map(|v| v.name.to_lowercase())
            .unwrap_or_else(|| cmd.verb.raw_name.to_lowercase());
        let value = match verb_key.as_str() {
            // Verbos de efecto (retornan Effect markers)
            "visualizar" | "proyectar" => Value::Effect {
                kind: "render".into(),
                payload: format!(
                    "{} sobre {}{}",
                    cmd.verb.raw_name, cmd.subject.raw_name, output_hint
                ),
            },
            "hablar" | "transmitir" => Value::Effect {
                kind: "audio".into(),
                payload: format!(
                    "{} sobre {}{}",
                    cmd.verb.raw_name, cmd.subject.raw_name, output_hint
                ),
            },
            "guardar" | "compartir" => Value::Effect {
                kind: "persist".into(),
                payload: format!(
                    "{} sobre {}{}",
                    cmd.verb.raw_name, cmd.subject.raw_name, output_hint
                ),
            },
            "notificar" => Value::Effect {
                kind: "alert".into(),
                payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
            },

            // Verbos de lectura (retornan Vector8 del estado actual)
            "sentir" | "escuchar" | "ver" | "escanear" | "monitorear" | "detectar" => {
                Value::Vector8(ctx.state)
            }

            // Verbos de memoria
            "recordar" | "aprender" | "codificar" => {
                ctx.variables.insert(
                    format!("stored_{}", cmd.subject.raw_name),
                    Value::Vector8(ctx.state),
                );
                Value::Vector8(ctx.state)
            }

            // Verbos de transformación (retornan estado modificado)
            "armonizar" | "resonar" | "modular" | "calibrar" | "sintetizar" | "filtrar" => {
                Value::Vector8(ctx.state)
            }

            // Verbos de control
            "ejecutar" | "iterar" | "esperar" | "detener" => Value::Bool(true),

            // Fallback: verbos conocidos pero sin handler específico
            _ => {
                if verb_def.is_some() {
                    Value::Null
                } else {
                    return Err(EvalError::UnknownVerb(cmd.verb.raw_name.clone()));
                }
            }
        };

        ctx.log(format!(
            "exec: {}:{}[{}] → {:?}",
            cmd.verb.raw_name,
            cmd.subject.raw_name,
            cmd.params.len(),
            value_kind(&value),
        ));

        Ok(value)
    }

    // ---- Validación de invariantes ----

    fn validate_invariants(ctx: &ExecutionContext) -> Result<(), EvalError> {
        for inv in &ctx.invariants {
            let actual = match inv.subject.to_lowercase().as_str() {
                "etica" | "ética" | "η" => ctx.state[4],
                "incertidumbre" | "υ" => ctx.state[7],
                "causalidad" | "χ" => ctx.state[3],
                "energetica" | "energética" | "ε" => ctx.state[5],
                "resonancia" | "ω" => ctx.state[6],
                _ => continue, // invariante sobre campo no mapeado: skip
            };

            let passes = match inv.op {
                RelationalOp::Gte => actual >= inv.value,
                RelationalOp::Lte => actual <= inv.value,
                RelationalOp::Gt => actual > inv.value,
                RelationalOp::Lt => actual < inv.value,
                RelationalOp::Eq => (actual - inv.value).abs() < 1e-9,
                RelationalOp::Neq => (actual - inv.value).abs() >= 1e-9,
            };

            if !passes {
                return Err(EvalError::InvariantViolation {
                    name: inv.subject.clone(),
                    expected: format!("{} {}", inv.op, inv.value),
                    actual,
                });
            }
        }
        Ok(())
    }

    // ---- Helpers ----

    fn param_to_value(p: &Parametro) -> Value {
        match p {
            Parametro::Integer(i) => Value::Integer(*i),
            Parametro::Number(n) => Value::Number(*n),
            Parametro::Hertz(hz) => Value::Number(*hz),
            Parametro::String(s) => Value::String(s.clone()),
            Parametro::Identifier(s) => Value::String(s.clone()),
            Parametro::Reference(s) => Value::String(format!("@{}", s)),
            Parametro::Array(arr) => Value::Array(arr.iter().map(Self::param_to_value).collect()),
            Parametro::KeyValue(kv) => Value::String(format!("{}:{:?}", kv.key, kv.value)),
            Parametro::BinaryOp { .. } => Value::Null,
        }
    }
}

fn value_kind(v: &Value) -> &'static str {
    match v {
        Value::Null => "Null",
        Value::Bool(_) => "Bool",
        Value::Integer(_) => "Integer",
        Value::Number(_) => "Number",
        Value::String(_) => "String",
        Value::Vector8(_) => "Vector8",
        Value::Array(_) => "Array",
        Value::Effect { .. } => "Effect",
    }
}

/// Normaliza Hz al rango [0, 1] usando la tabla Solfeggio.
fn normalize_solfeggio(hz: f64) -> f64 {
    const TABLE: &[(f64, f64)] = &[
        (174.0, 0.0),
        (285.0, 0.125),
        (396.0, 0.25),
        (417.0, 0.375),
        (528.0, 0.5),
        (639.0, 0.625),
        (741.0, 0.75),
        (852.0, 0.875),
        (963.0, 1.0),
    ];
    TABLE
        .iter()
        .min_by(|(a, _), (b, _)| {
            (a - hz)
                .abs()
                .partial_cmp(&(b - hz).abs())
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .map(|(_, v)| *v)
        .unwrap_or(0.5)
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::kscript::parser::Parser;

    fn eval(src: &str) -> Result<EvaluationResult, EvalError> {
        let rima = Parser::parse(src).map_err(|e| EvalError::Other(e.to_string()))?;
        Evaluator::evaluate(&rima)
    }

    #[test]
    fn test_empty_program() {
        let result = eval("RIMA: vacio\n").unwrap();
        // Estado por defecto: ética 0.85, resto 0
        assert!((result.final_state[4] - 0.85).abs() < 1e-9);
        assert!(result.invariants_preserved);
    }

    #[test]
    fn test_hello_world_koko() {
        let src = r#"
RIMA: HelloWorld_v2
VERSION: "2.0.0-hello"
AUTOR: "Mariano_Leguiza"
INVARIANT: Etica >= 0.85
INVARIANT: Incertidumbre <= 0.50
FRECUENCIAS: 0.174 | 0.285 | 0.396 | 0.417 | 0.432 | 0.528 | 0.639 | 0.741 | 0.852 | 0.963
TOPOLOGICOS: Nombre["Hello World Fractal"] | Genero[Visualizador]
RESONANCIA: Vector[0.4, 0.15, 0.5, 0.2, 0.95, 0.1, 0.528, 0.08]
PESOS: Topologicos[0.30] | Causales[0.00] | Resonancia[0.70] | Interferencia[0.00]
"#;
        let result = eval(src).unwrap();
        assert!((result.final_state[0] - 0.4).abs() < 1e-9);
        assert!((result.final_state[6] - 0.528).abs() < 1e-9);
        assert!(result.final_state[4] >= 0.85);
        assert!(result.poincare_norm < 0.999);
        assert!(result.weights.is_some());
        assert_eq!(result.topology.len(), 2);
    }

    #[test]
    fn test_command_with_hz() {
        let result = eval("Armonizar: Suelo_Biotico[528Hz]").unwrap();
        // 528Hz → resonancia 0.5
        assert!((result.final_state[6] - 0.5).abs() < 1e-9);
        // Verbo Armonizar → alias de Modular (59), ética al piso (0.88)
        assert!(result.final_state[4] >= 0.85);
    }

    #[test]
    fn test_command_visualizar_returns_effect() {
        let result = eval("Visualizar: Lienzo_Espacial").unwrap();
        match &result.last_value {
            Value::Effect { kind, .. } => assert_eq!(kind, "render"),
            other => panic!("se esperaba Effect(render), fue {:?}", other),
        }
    }

    #[test]
    fn test_pipeline() {
        let result = eval("Sentir: Clima_termica >> Visualizar: Lienzo").unwrap();
        // El último valor es del segundo comando
        match &result.last_value {
            Value::Effect { kind, .. } => assert_eq!(kind, "render"),
            other => panic!("se esperaba Effect, fue {:?}", other),
        }
    }

    #[test]
    fn test_invariant_violation_ethics() {
        // Intentar bajar ética por debajo de 0.85 vía resonancia
        let src = r#"
RIMA: bad
INVARIANT: Etica >= 0.85
RESONANCIA: Vector[0.4, 0.15, 0.5, 0.2, 0.5, 0.1, 0.528, 0.08]
"#;
        // El evaluador debe forzar ética >= 0.85 (no violar)
        let result = eval(src).unwrap();
        assert!(result.final_state[4] >= 0.85);
    }

    #[test]
    fn test_invariant_violation_uncertainty() {
        // Incertidumbre > 0.5 debe violar
        let src = r#"
RIMA: bad
INVARIANT: Incertidumbre <= 0.50
RESONANCIA: Vector[0.4, 0.15, 0.5, 0.2, 0.95, 0.1, 0.528, 0.9]
"#;
        let result = eval(src);
        assert!(matches!(result, Err(EvalError::InvariantViolation { .. })));
    }

    #[test]
    fn test_poincare_projection() {
        // Coordenadas fuera de la bola deben proyectarse
        let src = r#"
RIMA: outside
RESONANCIA: Vector[5.0, 5.0, 5.0, 5.0, 0.95, 0.1, 0.528, 0.08]
"#;
        let result = eval(src).unwrap();
        assert!(result.poincare_norm < 0.999);
    }

    #[test]
    fn test_weights_invalid_rejected() {
        let src = r#"
RIMA: bad_weights
PESOS: Topologicos[0.5] | Causales[0.5] | Resonancia[0.5] | Interferencia[0.5]
"#;
        let result = eval(src);
        assert!(matches!(result, Err(EvalError::WeightsInvalid(_))));
    }

    #[test]
    fn test_unknown_verb_rejected() {
        let result = eval("InventadoXYZ: Suelo_Biotico");
        assert!(matches!(result, Err(EvalError::UnknownVerb(_))));
    }

    #[test]
    fn test_solfeggio_normalization() {
        assert!((normalize_solfeggio(174.0) - 0.0).abs() < 1e-9);
        assert!((normalize_solfeggio(528.0) - 0.5).abs() < 1e-9);
        assert!((normalize_solfeggio(963.0) - 1.0).abs() < 1e-9);
        assert!((normalize_solfeggio(500.0) - 0.5).abs() < 1e-9); // más cerca de 528
    }

    #[test]
    fn test_ethics_floor_from_verb() {
        // Guardar tiene ethical_floor 0.92 en el diccionario
        let result = eval("Guardar: Archivo_Imagen").unwrap();
        assert!(result.final_state[4] >= 0.92);
    }

    #[test]
    fn test_history_recorded() {
        let result = eval("Armonizar: Suelo_Biotico[528Hz]").unwrap();
        assert!(!result.history.is_empty());
        assert!(result.history.iter().any(|h| h.contains("exec:")));
    }
}
