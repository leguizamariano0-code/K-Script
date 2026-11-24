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
            "guardar" => Value::Effect {
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
            "armonizar" | "resonar" | "modular" | "calibrar" | "sintetizar" => {
                Value::Vector8(ctx.state)
            }

            // Lote 1: 10 verbos no-core
            "crear" => {
                ctx.state[0] = (ctx.state[0] + 0.1).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "create".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "destruir" => {
                ctx.state[0] = (ctx.state[0] - 0.1).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "destroy".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "mover" => {
                ctx.state[2] = (ctx.state[2] + 0.05).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "move".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "copiar" => {
                ctx.state[5] = (ctx.state[5] + 0.02).clamp(0.0, 1.0);
                Value::Effect {
                    kind: "copy".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "pegar" => {
                ctx.state[0] = (ctx.state[0] + 0.02).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "paste".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "filtrar" => {
                ctx.state[7] = (ctx.state[7] - 0.05).clamp(0.0, 1.0);
                Value::Vector8(ctx.state)
            }
            "ordenar" => {
                ctx.state[7] = (ctx.state[7] - 0.1).clamp(0.0, 1.0);
                Value::Vector8(ctx.state)
            }
            "agrupar" => {
                ctx.state[2] = (ctx.state[2] + 0.03).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Vector8(ctx.state)
            }
            "abrir" => {
                ctx.state[1] = (ctx.state[1] + 0.05).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "open".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "cerrar" => {
                ctx.state[1] = (ctx.state[1] - 0.05).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "close".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }

            // Lote 2: 10 verbos no-core
            "buscar" => {
                ctx.state[1] = (ctx.state[1] + 0.05).clamp(-0.999, 0.999);
                ctx.state[7] = (ctx.state[7] - 0.05).clamp(0.0, 1.0);
                ctx.project_onto_disk();
                Value::Vector8(ctx.state)
            }
            "analizar" => {
                ctx.state[7] = (ctx.state[7] - 0.10).clamp(0.0, 1.0);
                Value::Vector8(ctx.state)
            }
            "comparar" => {
                ctx.state[3] = (ctx.state[3] + 0.05).clamp(-0.999, 0.999);
                ctx.state[7] = (ctx.state[7] - 0.02).clamp(0.0, 1.0);
                ctx.project_onto_disk();
                Value::Vector8(ctx.state)
            }
            "predecir" => {
                ctx.state[1] = (ctx.state[1] + 0.10).clamp(-0.999, 0.999);
                ctx.state[3] = (ctx.state[3] + 0.05).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "predict".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "estilizar" => {
                ctx.state[0] = (ctx.state[0] + 0.05).clamp(-0.999, 0.999);
                ctx.state[2] = (ctx.state[2] + 0.02).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "style".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "difuminar" => {
                ctx.state[7] = (ctx.state[7] + 0.08).clamp(0.0, 1.0);
                ctx.state[0] = (ctx.state[0] - 0.02).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "blur".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "sombrear" => {
                ctx.state[5] = (ctx.state[5] + 0.05).clamp(0.0, 1.0);
                ctx.state[2] = (ctx.state[2] + 0.02).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "shadow".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "modelar" => {
                ctx.state[2] = (ctx.state[2] + 0.10).clamp(-0.999, 0.999);
                ctx.state[0] = (ctx.state[0] + 0.05).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "model".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "mapear" => {
                ctx.state[2] = (ctx.state[2] + 0.05).clamp(-0.999, 0.999);
                ctx.state[3] = (ctx.state[3] + 0.05).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Vector8(ctx.state)
            }
            "reflejar" => {
                ctx.state[2] = (ctx.state[2] + 0.05).clamp(-0.999, 0.999);
                ctx.state[1] = (ctx.state[1] - 0.02).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "reflect".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }

            // Lote 3: 10 verbos no-core
            "encriptar" => {
                ctx.state[7] = (ctx.state[7] - 0.05).clamp(0.0, 1.0);
                ctx.state[4] = (ctx.state[4] + 0.02).clamp(0.0, 1.0);
                Value::Effect {
                    kind: "encrypt".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "desencriptar" => {
                ctx.state[7] = (ctx.state[7] + 0.02).clamp(0.0, 1.0);
                ctx.state[3] = (ctx.state[3] + 0.05).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "decrypt".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "autenticar" => {
                ctx.state[4] = (ctx.state[4] + 0.05).clamp(0.0, 1.0);
                ctx.state[7] = (ctx.state[7] - 0.05).clamp(0.0, 1.0);
                Value::Effect {
                    kind: "authenticate".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "autorizar" => {
                ctx.state[3] = (ctx.state[3] + 0.05).clamp(-0.999, 0.999);
                ctx.state[4] = (ctx.state[4] + 0.02).clamp(0.0, 1.0);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "authorize".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "vincular" => {
                ctx.state[2] = (ctx.state[2] + 0.05).clamp(-0.999, 0.999);
                ctx.state[1] = (ctx.state[1] + 0.02).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "link".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "compartir" => {
                ctx.state[2] = (ctx.state[2] + 0.08).clamp(-0.999, 0.999);
                ctx.state[1] = (ctx.state[1] + 0.05).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "share".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "eliminar" => {
                ctx.state[0] = (ctx.state[0] - 0.08).clamp(-0.999, 0.999);
                ctx.state[2] = (ctx.state[2] - 0.05).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "delete".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "reiniciar" => {
                ctx.state[1] = 0.0;
                ctx.state[3] = 0.0;
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "restart".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "expandir" => {
                ctx.state[2] = (ctx.state[2] + 0.10).clamp(-0.999, 0.999);
                ctx.state[0] = (ctx.state[0] + 0.02).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "expand".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "contraer" => {
                ctx.state[2] = (ctx.state[2] - 0.10).clamp(-0.999, 0.999);
                ctx.state[0] = (ctx.state[0] - 0.02).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "contract".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }

            // Lote 4: 10 verbos no-core
            "extraer" => {
                ctx.state[2] = (ctx.state[2] - 0.05).clamp(-0.999, 0.999);
                ctx.state[5] = (ctx.state[5] - 0.05).clamp(0.0, 1.0);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "extract".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "configurar" => {
                ctx.state[3] = (ctx.state[3] + 0.02).clamp(-0.999, 0.999);
                ctx.state[0] = (ctx.state[0] + 0.02).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "configure".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "protocolo" => {
                ctx.state[3] = (ctx.state[3] + 0.10).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "protocol".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "reforzar" => {
                ctx.state[5] = (ctx.state[5] + 0.05).clamp(0.0, 1.0);
                ctx.state[3] = (ctx.state[3] + 0.05).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "reinforce".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "traducir" => {
                ctx.state[7] = (ctx.state[7] - 0.05).clamp(0.0, 1.0);
                ctx.state[0] = (ctx.state[0] + 0.05).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "translate".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "olvidar" => {
                ctx.state[0] = (ctx.state[0] - 0.10).clamp(-0.999, 0.999);
                ctx.state[7] = (ctx.state[7] + 0.10).clamp(0.0, 1.0);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "forget".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "detener" => {
                ctx.state[1] = 0.0;
                ctx.state[5] = 0.0;
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "halt".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "decodificar" => {
                ctx.state[7] = (ctx.state[7] - 0.08).clamp(0.0, 1.0);
                ctx.state[0] = (ctx.state[0] + 0.08).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Vector8(ctx.state)
            }
            "cobrar" => {
                ctx.state[5] = (ctx.state[5] - 0.02).clamp(0.0, 1.0);
                ctx.state[3] = (ctx.state[3] - 0.05).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "charge".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "pagar" => {
                ctx.state[5] = (ctx.state[5] + 0.02).clamp(0.0, 1.0);
                ctx.state[3] = (ctx.state[3] + 0.05).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "pay".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }

            // Lote 5: 10 verbos no-core
            "evolucionar" => {
                ctx.state[0] = (ctx.state[0] + 0.10).clamp(-0.999, 0.999);
                ctx.state[7] = (ctx.state[7] - 0.10).clamp(0.0, 1.0);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "evolve".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "hibernar" => {
                ctx.state[5] = (ctx.state[5] - 0.10).clamp(0.0, 1.0);
                ctx.state[1] = (ctx.state[1] - 0.10).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "hibernate".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "orquestar" => {
                ctx.state[3] = (ctx.state[3] + 0.10).clamp(-0.999, 0.999);
                ctx.state[2] = (ctx.state[2] + 0.10).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "orchestrate".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "estimular" => {
                ctx.state[5] = (ctx.state[5] + 0.10).clamp(0.0, 1.0);
                ctx.state[0] = (ctx.state[0] + 0.05).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "stimulate".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "simular" => {
                ctx.state[7] = (ctx.state[7] + 0.05).clamp(0.0, 1.0);
                ctx.state[0] = (ctx.state[0] + 0.05).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Vector8(ctx.state)
            }
            "gobernar" => {
                ctx.state[4] = (ctx.state[4] + 0.05).clamp(0.0, 1.0);
                ctx.state[3] = (ctx.state[3] + 0.05).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "govern".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "intercambiar" => {
                ctx.state[5] = (ctx.state[5] + 0.05).clamp(0.0, 1.0);
                ctx.state[2] = (ctx.state[2] + 0.05).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "exchange".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "inocular" => {
                ctx.state[0] = (ctx.state[0] + 0.08).clamp(-0.999, 0.999);
                ctx.state[2] = (ctx.state[2] + 0.02).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "inoculate".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "cosechar" => {
                ctx.state[5] = (ctx.state[5] + 0.10).clamp(0.0, 1.0);
                ctx.state[1] = (ctx.state[1] + 0.05).clamp(-0.999, 0.999);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "harvest".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }
            "meditar" => {
                ctx.state[7] = (ctx.state[7] - 0.15).clamp(0.0, 1.0);
                ctx.state[4] = (ctx.state[4] + 0.02).clamp(0.0, 1.0);
                Value::Effect {
                    kind: "meditate".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }

            // Verbos de control
            "ejecutar" | "iterar" | "esperar" => Value::Bool(true),

            // Lote 6: 73/73
            "cultivar" => {
                ctx.state[0] = (ctx.state[0] + 0.08).clamp(-0.999, 0.999);
                ctx.state[2] = (ctx.state[2] + 0.08).clamp(-0.999, 0.999);
                ctx.state[5] = (ctx.state[5] + 0.05).clamp(0.0, 1.0);
                ctx.project_onto_disk();
                Value::Effect {
                    kind: "cultivate".into(),
                    payload: format!("{} sobre {}", cmd.verb.raw_name, cmd.subject.raw_name),
                }
            }

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

    #[test]
    fn test_lote1_non_core_verbs() {
        let r_crear = eval("Crear: Bio_Matriz").unwrap();
        assert!(matches!(&r_crear.last_value, Value::Effect { kind, .. } if kind == "create"));
        assert!((r_crear.final_state[0] - 0.1).abs() < 1e-9);

        let r_destruir = eval("Destruir: Bio_Matriz").unwrap();
        assert!(matches!(&r_destruir.last_value, Value::Effect { kind, .. } if kind == "destroy"));
        assert!((r_destruir.final_state[0] + 0.1).abs() < 1e-9);

        let r_mover = eval("Mover: Bio_Matriz").unwrap();
        assert!(matches!(&r_mover.last_value, Value::Effect { kind, .. } if kind == "move"));
        assert!((r_mover.final_state[2] - 0.05).abs() < 1e-9);

        let r_copiar = eval("Copiar: Bio_Matriz").unwrap();
        assert!(matches!(&r_copiar.last_value, Value::Effect { kind, .. } if kind == "copy"));
        assert!((r_copiar.final_state[5] - 0.0275).abs() < 1e-9);

        let r_pegar = eval("Pegar: Bio_Matriz").unwrap();
        assert!(matches!(&r_pegar.last_value, Value::Effect { kind, .. } if kind == "paste"));
        assert!((r_pegar.final_state[0] - 0.02).abs() < 1e-9);

        let r_filtrar =
            eval("RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.1, 0.5, 0.5]\nFiltrar: Senal")
                .unwrap();
        assert!(matches!(r_filtrar.last_value, Value::Vector8(_)));
        assert!((r_filtrar.final_state[7] - 0.45).abs() < 1e-9);

        let r_ordenar =
            eval("RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.1, 0.5, 0.5]\nOrdenar: Senal")
                .unwrap();
        assert!(matches!(r_ordenar.last_value, Value::Vector8(_)));
        assert!((r_ordenar.final_state[7] - 0.4).abs() < 1e-9);

        let r_agrupar = eval("Agrupar: Bio_Matriz").unwrap();
        assert!(matches!(r_agrupar.last_value, Value::Vector8(_)));
        assert!((r_agrupar.final_state[2] - 0.03).abs() < 1e-9);

        let r_abrir = eval("Abrir: Canal_Local").unwrap();
        assert!(matches!(&r_abrir.last_value, Value::Effect { kind, .. } if kind == "open"));
        assert!((r_abrir.final_state[1] - 0.05).abs() < 1e-9);

        let r_cerrar = eval("Cerrar: Canal_Local").unwrap();
        assert!(matches!(&r_cerrar.last_value, Value::Effect { kind, .. } if kind == "close"));
        assert!((r_cerrar.final_state[1] + 0.05).abs() < 1e-9);
    }

    #[test]
    fn test_lote2_non_core_verbs() {
        let r_buscar =
            eval("RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.1, 0.5, 0.5]\nBuscar: Senal")
                .unwrap();
        assert!(matches!(r_buscar.last_value, Value::Vector8(_)));
        assert!((r_buscar.final_state[1] - 0.15).abs() < 1e-9);
        assert!((r_buscar.final_state[7] - 0.45).abs() < 1e-9);

        let r_analizar =
            eval("RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.1, 0.5, 0.5]\nAnalizar: Senal")
                .unwrap();
        assert!(matches!(r_analizar.last_value, Value::Vector8(_)));
        assert!((r_analizar.final_state[7] - 0.4).abs() < 1e-9);

        let r_comparar =
            eval("RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.1, 0.5, 0.5]\nComparar: Senal")
                .unwrap();
        assert!(matches!(r_comparar.last_value, Value::Vector8(_)));
        assert!((r_comparar.final_state[3] - 0.14).abs() < 1e-9);
        assert!((r_comparar.final_state[7] - 0.48).abs() < 1e-9);

        let r_predecir = eval("Predecir: Bio_Matriz").unwrap();
        assert!(matches!(&r_predecir.last_value, Value::Effect { kind, .. } if kind == "predict"));
        assert!((r_predecir.final_state[1] - 0.10).abs() < 1e-9);
        assert!((r_predecir.final_state[3] - 0.08).abs() < 1e-9);

        let r_estilizar = eval("Estilizar: Bio_Matriz").unwrap();
        assert!(matches!(&r_estilizar.last_value, Value::Effect { kind, .. } if kind == "style"));
        assert!((r_estilizar.final_state[0] - 0.05).abs() < 1e-9);
        assert!((r_estilizar.final_state[2] - 0.02).abs() < 1e-9);

        let r_difuminar = eval("Difuminar: Bio_Matriz").unwrap();
        assert!(matches!(&r_difuminar.last_value, Value::Effect { kind, .. } if kind == "blur"));
        assert!((r_difuminar.final_state[7] - 0.08).abs() < 1e-9);
        assert!((r_difuminar.final_state[0] + 0.02).abs() < 1e-9);

        let r_sombrear = eval("Sombrear: Bio_Matriz").unwrap();
        assert!(matches!(&r_sombrear.last_value, Value::Effect { kind, .. } if kind == "shadow"));
        assert!((r_sombrear.final_state[5] - 0.06).abs() < 1e-9);
        assert!((r_sombrear.final_state[2] - 0.02).abs() < 1e-9);

        let r_modelar = eval("Modelar: Bio_Matriz").unwrap();
        assert!(matches!(&r_modelar.last_value, Value::Effect { kind, .. } if kind == "model"));
        assert!((r_modelar.final_state[2] - 0.10).abs() < 1e-9);
        assert!((r_modelar.final_state[0] - 0.05).abs() < 1e-9);

        let r_mapear = eval("Mapear: Bio_Matriz").unwrap();
        assert!(matches!(r_mapear.last_value, Value::Vector8(_)));
        assert!((r_mapear.final_state[2] - 0.05).abs() < 1e-9);
        assert!((r_mapear.final_state[3] - 0.09).abs() < 1e-9);

        let r_reflejar = eval("Reflejar: Bio_Matriz").unwrap();
        assert!(matches!(&r_reflejar.last_value, Value::Effect { kind, .. } if kind == "reflect"));
        assert!((r_reflejar.final_state[2] - 0.05).abs() < 1e-9);
        assert!((r_reflejar.final_state[1] + 0.02).abs() < 1e-9);
    }

    #[test]
    fn test_lote3_non_core_verbs() {
        let r_encriptar = eval(
            "RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.1, 0.5, 0.5]\nEncriptar: Senal",
        )
        .unwrap();
        assert!(matches!(
            &r_encriptar.last_value,
            Value::Effect { kind, .. } if kind == "encrypt"
        ));
        assert!((r_encriptar.final_state[7] - 0.45).abs() < 1e-9);
        assert!((r_encriptar.final_state[4] - 0.97).abs() < 1e-9);

        let r_desencriptar = eval(
            "RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.1, 0.5, 0.5]\nDesencriptar: Senal",
        )
        .unwrap();
        assert!(matches!(
            &r_desencriptar.last_value,
            Value::Effect { kind, .. } if kind == "decrypt"
        ));
        assert!((r_desencriptar.final_state[7] - 0.52).abs() < 1e-9);
        assert!((r_desencriptar.final_state[3] - 0.14).abs() < 1e-9);

        let r_autenticar = eval(
            "RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.90, 0.1, 0.5, 0.5]\nAutenticar: Canal_Local",
        )
        .unwrap();
        assert!(matches!(
            &r_autenticar.last_value,
            Value::Effect { kind, .. } if kind == "authenticate"
        ));
        assert!((r_autenticar.final_state[4] - 1.0).abs() < 1e-9);
        assert!((r_autenticar.final_state[7] - 0.45).abs() < 1e-9);

        let r_autorizar = eval("Autorizar: Bio_Matriz").unwrap();
        assert!(matches!(
            &r_autorizar.last_value,
            Value::Effect { kind, .. } if kind == "authorize"
        ));
        assert!((r_autorizar.final_state[3] - 0.07).abs() < 1e-9);
        assert!((r_autorizar.final_state[4] - 0.95).abs() < 1e-9);

        let r_vincular = eval("Vincular: Bio_Matriz").unwrap();
        assert!(matches!(&r_vincular.last_value, Value::Effect { kind, .. } if kind == "link"));
        assert!((r_vincular.final_state[2] - 0.05).abs() < 1e-9);
        assert!((r_vincular.final_state[1] - 0.02).abs() < 1e-9);

        let r_compartir = eval("Compartir: Bio_Matriz").unwrap();
        assert!(matches!(
            &r_compartir.last_value,
            Value::Effect { kind, .. } if kind == "share"
        ));
        assert!((r_compartir.final_state[2] - 0.08).abs() < 1e-9);
        assert!((r_compartir.final_state[1] - 0.05).abs() < 1e-9);

        let r_eliminar = eval("Eliminar: Bio_Matriz").unwrap();
        assert!(matches!(
            &r_eliminar.last_value,
            Value::Effect { kind, .. } if kind == "delete"
        ));
        assert!((r_eliminar.final_state[0] + 0.08).abs() < 1e-9);
        assert!((r_eliminar.final_state[2] + 0.05).abs() < 1e-9);

        let r_reiniciar = eval(
            "RESONANCIA: Vector[0.2, 0.2, 0.2, 0.2, 0.95, 0.1, 0.5, 0.1]\nReiniciar: Bio_Matriz",
        )
        .unwrap();
        assert!(matches!(
            &r_reiniciar.last_value,
            Value::Effect { kind, .. } if kind == "restart"
        ));
        assert!(r_reiniciar.final_state[1].abs() < 1e-9);
        assert!(r_reiniciar.final_state[3].abs() < 1e-9);

        let r_expandir = eval("Expandir: Bio_Matriz").unwrap();
        assert!(matches!(
            &r_expandir.last_value,
            Value::Effect { kind, .. } if kind == "expand"
        ));
        assert!((r_expandir.final_state[2] - 0.10).abs() < 1e-9);
        assert!((r_expandir.final_state[0] - 0.02).abs() < 1e-9);

        let r_contraer = eval("Contraer: Bio_Matriz").unwrap();
        assert!(matches!(
            &r_contraer.last_value,
            Value::Effect { kind, .. } if kind == "contract"
        ));
        assert!((r_contraer.final_state[2] + 0.10).abs() < 1e-9);
        assert!((r_contraer.final_state[0] + 0.02).abs() < 1e-9);
    }

    #[test]
    fn test_lote4_non_core_verbs() {
        let r_extraer = eval(
            "RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.2, 0.5, 0.1]\nExtraer: Senal",
        )
        .unwrap();
        assert!(matches!(
            &r_extraer.last_value,
            Value::Effect { kind, .. } if kind == "extract"
        ));
        assert!((r_extraer.final_state[2] - 0.05).abs() < 1e-9);
        assert!((r_extraer.final_state[5] - 0.16).abs() < 1e-9);

        let r_configurar = eval("Configurar: Bio_Matriz").unwrap();
        assert!(matches!(
            &r_configurar.last_value,
            Value::Effect { kind, .. } if kind == "configure"
        ));
        assert!((r_configurar.final_state[3] - 0.03).abs() < 1e-9);
        assert!((r_configurar.final_state[0] - 0.02).abs() < 1e-9);

        let r_protocolo = eval("Protocolo: Bio_Matriz").unwrap();
        assert!(matches!(
            &r_protocolo.last_value,
            Value::Effect { kind, .. } if kind == "protocol"
        ));
        assert!((r_protocolo.final_state[3] - 0.13).abs() < 1e-9);

        let r_reforzar = eval("Reforzar: Bio_Matriz").unwrap();
        assert!(matches!(
            &r_reforzar.last_value,
            Value::Effect { kind, .. } if kind == "reinforce"
        ));
        assert!((r_reforzar.final_state[5] - 0.065).abs() < 1e-9);
        assert!((r_reforzar.final_state[3] - 0.09).abs() < 1e-9);

        let r_traducir = eval(
            "RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.1, 0.5, 0.5]\nTraducir: Senal",
        )
        .unwrap();
        assert!(matches!(
            &r_traducir.last_value,
            Value::Effect { kind, .. } if kind == "translate"
        ));
        assert!((r_traducir.final_state[7] - 0.45).abs() < 1e-9);
        assert!((r_traducir.final_state[0] - 0.15).abs() < 1e-9);

        let r_olvidar = eval(
            "RESONANCIA: Vector[0.2, 0.1, 0.1, 0.1, 0.95, 0.1, 0.5, 0.1]\nOlvidar: Senal",
        )
        .unwrap();
        assert!(matches!(
            &r_olvidar.last_value,
            Value::Effect { kind, .. } if kind == "forget"
        ));
        assert!((r_olvidar.final_state[0] - 0.10).abs() < 1e-9);
        assert!((r_olvidar.final_state[7] - 0.20).abs() < 1e-9);

        let r_detener = eval(
            "RESONANCIA: Vector[0.1, 0.2, 0.1, 0.1, 0.95, 0.2, 0.5, 0.1]\nDetener: Canal_Local",
        )
        .unwrap();
        assert!(matches!(&r_detener.last_value, Value::Effect { kind, .. } if kind == "halt"));
        assert!(r_detener.final_state[1].abs() < 1e-9);
        assert!(r_detener.final_state[5].abs() < 1e-9);

        let r_decodificar = eval(
            "RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.1, 0.5, 0.5]\nDecodificar: Senal",
        )
        .unwrap();
        assert!(matches!(r_decodificar.last_value, Value::Vector8(_)));
        assert!((r_decodificar.final_state[7] - 0.42).abs() < 1e-9);
        assert!((r_decodificar.final_state[0] - 0.18).abs() < 1e-9);

        let r_cobrar = eval(
            "RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.2, 0.5, 0.1]\nCobrar: Bio_Matriz",
        )
        .unwrap();
        assert!(matches!(
            &r_cobrar.last_value,
            Value::Effect { kind, .. } if kind == "charge"
        ));
        assert!((r_cobrar.final_state[5] - 0.19).abs() < 1e-9);
        assert!((r_cobrar.final_state[3] - 0.08).abs() < 1e-9);

        let r_pagar = eval("Pagar: Bio_Matriz").unwrap();
        assert!(matches!(&r_pagar.last_value, Value::Effect { kind, .. } if kind == "pay"));
        assert!((r_pagar.final_state[5] - 0.03).abs() < 1e-9);
        assert!((r_pagar.final_state[3] - 0.08).abs() < 1e-9);
    }

    #[test]
    fn test_lote5_non_core_verbs() {
        let r_evolucionar = eval(
            "RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.1, 0.5, 0.5]\nEvolucionar: Senal",
        )
        .unwrap();
        assert!(matches!(
            &r_evolucionar.last_value,
            Value::Effect { kind, .. } if kind == "evolve"
        ));
        assert!((r_evolucionar.final_state[0] - 0.20).abs() < 1e-9);
        assert!((r_evolucionar.final_state[7] - 0.40).abs() < 1e-9);

        let r_hibernar = eval(
            "RESONANCIA: Vector[0.1, 0.2, 0.1, 0.1, 0.95, 0.2, 0.5, 0.1]\nHibernar: Canal_Local",
        )
        .unwrap();
        assert!(matches!(
            &r_hibernar.last_value,
            Value::Effect { kind, .. } if kind == "hibernate"
        ));
        assert!((r_hibernar.final_state[5] - 0.1025).abs() < 1e-9);
        assert!((r_hibernar.final_state[1] - 0.10).abs() < 1e-9);

        let r_orquestar = eval("Orquestar: Bio_Matriz").unwrap();
        assert!(matches!(
            &r_orquestar.last_value,
            Value::Effect { kind, .. } if kind == "orchestrate"
        ));
        assert!((r_orquestar.final_state[3] - 0.16).abs() < 1e-9);
        assert!((r_orquestar.final_state[2] - 0.10).abs() < 1e-9);

        let r_estimular = eval("Estimular: Bio_Matriz").unwrap();
        assert!(matches!(
            &r_estimular.last_value,
            Value::Effect { kind, .. } if kind == "stimulate"
        ));
        assert!((r_estimular.final_state[5] - 0.1175).abs() < 1e-9);
        assert!((r_estimular.final_state[0] - 0.05).abs() < 1e-9);

        let r_simular = eval("Simular: Bio_Matriz").unwrap();
        assert!(matches!(r_simular.last_value, Value::Vector8(_)));
        assert!((r_simular.final_state[7] - 0.05).abs() < 1e-9);
        assert!((r_simular.final_state[0] - 0.05).abs() < 1e-9);

        let r_gobernar = eval("Gobernar: Bio_Matriz").unwrap();
        assert!(matches!(
            &r_gobernar.last_value,
            Value::Effect { kind, .. } if kind == "govern"
        ));
        assert!((r_gobernar.final_state[4] - 0.99).abs() < 1e-9);
        assert!((r_gobernar.final_state[3] - 0.09).abs() < 1e-9);

        let r_intercambiar = eval("Intercambiar: Bio_Matriz").unwrap();
        assert!(matches!(
            &r_intercambiar.last_value,
            Value::Effect { kind, .. } if kind == "exchange"
        ));
        assert!((r_intercambiar.final_state[5] - 0.065).abs() < 1e-9);
        assert!((r_intercambiar.final_state[2] - 0.05).abs() < 1e-9);

        let r_inocular = eval("Inocular: Bio_Matriz").unwrap();
        assert!(matches!(
            &r_inocular.last_value,
            Value::Effect { kind, .. } if kind == "inoculate"
        ));
        assert!((r_inocular.final_state[0] - 0.08).abs() < 1e-9);
        assert!((r_inocular.final_state[2] - 0.02).abs() < 1e-9);

        let r_cosechar = eval("Cosechar: Bio_Matriz").unwrap();
        assert!(matches!(
            &r_cosechar.last_value,
            Value::Effect { kind, .. } if kind == "harvest"
        ));
        assert!((r_cosechar.final_state[5] - 0.115).abs() < 1e-9);
        assert!((r_cosechar.final_state[1] - 0.05).abs() < 1e-9);

        let r_meditar = eval(
            "RESONANCIA: Vector[0.1, 0.1, 0.1, 0.1, 0.95, 0.1, 0.5, 0.5]\nMeditar: Senal",
        )
        .unwrap();
        assert!(matches!(
            &r_meditar.last_value,
            Value::Effect { kind, .. } if kind == "meditate"
        ));
        assert!((r_meditar.final_state[7] - 0.35).abs() < 1e-9);
        assert!((r_meditar.final_state[4] - 0.97).abs() < 1e-9);
    }

    #[test]
    fn test_lote6_cultivar() {
        let r_cultivar = eval("Cultivar: Micelio").unwrap();
        assert!(matches!(
            &r_cultivar.last_value,
            Value::Effect { kind, .. } if kind == "cultivate"
        ));
        assert!((r_cultivar.final_state[0] - 0.08).abs() < 1e-9);
        assert!((r_cultivar.final_state[2] - 0.08).abs() < 1e-9);
        assert!((r_cultivar.final_state[5] - 0.07).abs() < 1e-9);
        assert!(r_cultivar.final_state[4] >= 0.92);
    }
}
