// Módulo `evaluatorV2`: ejecuta un AST `Rima` produciendo un estado 8D + diagnósticos.
// Port directo de `korivm/src/kscript/evaluator.rs` a TypeScript estricto.
// Alineado con `src/kscript/ast.ts`, `parserV2.ts` y `dictionary.ts`.

import type {
  Rima,
  Statement,
  Command,
  Parametro,
  InvariantExpr,
  WeightsBlock,
  Vector8,
} from './ast';
import { validateWeightsSum } from './ast';
import { KSCRIPT_VERBS } from './dictionary';

// ============================================================================
// VALORES
// ============================================================================

export type Value =
  | { kind: 'Null' }
  | { kind: 'Bool'; value: boolean }
  | { kind: 'Integer'; value: number }
  | { kind: 'Number'; value: number }
  | { kind: 'String'; value: string }
  | { kind: 'Vector8'; value: Vector8 }
  | { kind: 'Array'; value: Value[] }
  | { kind: 'Effect'; effectType: string; payload: string };

export function valueKindName(v: Value): string {
  switch (v.kind) {
    case 'Null':
      return 'Null';
    case 'Bool':
      return 'Bool';
    case 'Integer':
      return 'Integer';
    case 'Number':
      return 'Number';
    case 'String':
      return 'String';
    case 'Vector8':
      return 'Vector8';
    case 'Array':
      return 'Array';
    case 'Effect':
      return 'Effect';
  }
}

// ============================================================================
// ERRORES
// ============================================================================

export type EvalErrorDetail =
  | { kind: 'InvariantViolation'; name: string; expected: string; actual: number }
  | { kind: 'PoincareViolation'; norm: number }
  | { kind: 'EthicsFloorViolation'; floor: number; actual: number }
  | { kind: 'WeightsInvalid'; message: string }
  | { kind: 'NotImplemented'; verb: string; subject: string }
  | { kind: 'UnknownVerb'; verb: string }
  | { kind: 'Other'; message: string };

function formatEvalError(d: EvalErrorDetail): string {
  switch (d.kind) {
    case 'InvariantViolation':
      return `invariante '${d.name}' violado: esperado ${d.expected}, obtenido ${d.actual}`;
    case 'PoincareViolation':
      return `norma de Poincaré ${d.norm.toFixed(4)} excede el límite 0.999`;
    case 'EthicsFloorViolation':
      return `piso ético ${d.floor.toFixed(2)} violado (actual: ${d.actual.toFixed(2)})`;
    case 'WeightsInvalid':
      return `pesos inválidos: ${d.message}`;
    case 'NotImplemented':
      return `verbo '${d.verb}' sobre sujeto '${d.subject}' no implementado en MVP`;
    case 'UnknownVerb':
      return `verbo desconocido: '${d.verb}'`;
    case 'Other':
      return d.message;
  }
}

export class EvalError extends Error {
  public readonly detail: EvalErrorDetail;

  constructor(detail: EvalErrorDetail) {
    super(formatEvalError(detail));
    this.name = 'EvalError';
    this.detail = detail;
  }
}

// ============================================================================
// CONTEXTO DE EJECUCIÓN
// ============================================================================

export interface ExecutionContext {
  state: Vector8;
  invariants: InvariantExpr[];
  frequencies: number[];
  weights?: WeightsBlock;
  topology: Map<string, Parametro>;
  variables: Map<string, Value>;
  lastResult: Value;
  history: string[];
}

export function createContext(): ExecutionContext {
  return {
    // [c, t, s, ch, et, en, res, inc]
    state: [0, 0, 0, 0, 0.85, 0, 0.5, 0],
    invariants: [],
    frequencies: [0.174, 0.285, 0.396, 0.417, 0.432, 0.528, 0.639, 0.741, 0.852, 0.963],
    weights: undefined,
    topology: new Map(),
    variables: new Map(),
    lastResult: { kind: 'Null' },
    history: [],
  };
}

// ============================================================================
// RESULTADO
// ============================================================================

export interface EvaluationResult {
  finalState: Vector8;
  poincareNorm: number;
  invariantsPreserved: boolean;
  topology: Map<string, Parametro>;
  weights?: WeightsBlock;
  lastValue: Value;
  history: string[];
}

// ============================================================================
// HELPERS
// ============================================================================

const POINCARE_LIMIT = 0.999;
const POINCARE_SAFE_RADIUS = 0.998999;

/** Proyecta las 4 primeras coords al disco de Poincaré (radio seguro 0.998999). */
function projectOntoDisk(state: Vector8): void {
  const norm = Math.sqrt(
    state[0] ** 2 + state[1] ** 2 + state[2] ** 2 + state[3] ** 2
  );
  if (norm >= POINCARE_LIMIT) {
    const factor = POINCARE_SAFE_RADIUS / norm;
    for (let d = 0; d < 4; d++) {
      state[d] *= factor;
    }
  }
}

function enforceEthicsFloor(state: Vector8, floor: number): void {
  state[4] = Math.max(state[4], floor);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Normaliza Hz al rango [0, 1] usando la tabla Solfeggio. */
export function normalizeSolfeggio(hz: number): number {
  const TABLE: ReadonlyArray<readonly [number, number]> = [
    [174.0, 0.0],
    [285.0, 0.125],
    [396.0, 0.25],
    [417.0, 0.375],
    [528.0, 0.5],
    [639.0, 0.625],
    [741.0, 0.75],
    [852.0, 0.875],
    [963.0, 1.0],
  ];
  let best = TABLE[0];
  let bestDist = Math.abs(best[0] - hz);
  for (const row of TABLE) {
    const d = Math.abs(row[0] - hz);
    if (d < bestDist) {
      bestDist = d;
      best = row;
    }
  }
  return best[1];
}

function paramToValue(p: Parametro): Value {
  switch (p.kind) {
    case 'Integer':
      return { kind: 'Integer', value: p.value };
    case 'Number':
    case 'Hertz':
      return { kind: 'Number', value: p.value };
    case 'String':
    case 'Identifier':
      return { kind: 'String', value: p.value };
    case 'Reference':
      return { kind: 'String', value: `@${p.value}` };
    case 'Array':
      return { kind: 'Array', value: p.value.map(paramToValue) };
    case 'KeyValue':
      return {
        kind: 'String',
        value: `${p.value.key}:${paramValueToString(p.value.value)}`,
      };
    case 'BinaryOp':
      return { kind: 'Null' };
  }
}

function paramValueToString(p: Parametro): string {
  switch (p.kind) {
    case 'Integer':
    case 'Number':
    case 'Hertz':
      return String(p.value);
    case 'String':
    case 'Identifier':
    case 'Reference':
      return p.value;
    case 'Array':
      return `[${p.value.map(paramValueToString).join(', ')}]`;
    case 'KeyValue':
      return `${p.value.key}:${paramValueToString(p.value.value)}`;
    case 'BinaryOp':
      return '(expr)';
  }
}

// ============================================================================
// EVALUADOR
// ============================================================================

export class Evaluator {
  public static evaluate(rima: Rima): EvaluationResult {
    const ctx = createContext();

    // Fase 1: procesar statements declarativos y commands
    for (const stmt of rima.statements) {
      Evaluator.executeStatement(ctx, stmt);
    }

    // Fase 2: validar invariantes constitucionales
    Evaluator.validateInvariants(ctx);

    // Fase 3: piso ético global (0.85)
    if (ctx.state[4] < 0.85) {
      throw new EvalError({
        kind: 'EthicsFloorViolation',
        floor: 0.85,
        actual: ctx.state[4],
      });
    }

    // Fase 4: norma de Poincaré
    const poincareNorm = Math.sqrt(
      ctx.state[0] ** 2 + ctx.state[1] ** 2 + ctx.state[2] ** 2 + ctx.state[3] ** 2
    );
    if (poincareNorm >= POINCARE_LIMIT) {
      throw new EvalError({ kind: 'PoincareViolation', norm: poincareNorm });
    }

    return {
      finalState: ctx.state,
      poincareNorm,
      invariantsPreserved: true,
      topology: ctx.topology,
      weights: ctx.weights,
      lastValue: ctx.lastResult,
      history: ctx.history,
    };
  }

  // ---- Dispatcher ----

  private static executeStatement(ctx: ExecutionContext, stmt: Statement): void {
    const node = stmt.node;

    switch (node.kind) {
      // ---- Capa 0 ----
      case 'HeaderField':
        ctx.variables.set(node.key, paramToValue(node.value));
        ctx.history.push(`header ${node.key} = ${paramValueToString(node.value)}`);
        return;

      case 'Invariant':
        ctx.invariants.push(node.invariant);
        ctx.history.push(
          `invariant ${node.invariant.subject} ${node.invariant.op} ${node.invariant.value}`
        );
        if (node.invariant.subject.toLowerCase() === 'etica' && node.invariant.op === 'Gte') {
          enforceEthicsFloor(ctx.state, node.invariant.value);
        }
        return;

      case 'Frequencies':
        ctx.frequencies = node.frequencies.slice();
        ctx.history.push(`frequencies: ${node.frequencies.length} valores`);
        return;

      // ---- Capa 1 ----
      case 'Topology':
        for (const item of node.items) {
          ctx.topology.set(item.key, item.value);
        }
        ctx.history.push(`topology: ${node.items.length} items`);
        return;

      // ---- Capa 2 ----
      case 'CausalNode':
        ctx.history.push(
          `causal node ${node.node.id} (deps: ${node.node.dependsOn.length})`
        );
        return;

      case 'CausalOrder':
        ctx.history.push(`causal order: ${node.order.length} nodos`);
        return;

      // ---- Capa 3 ----
      case 'Resonance':
        for (let d = 0; d < 4; d++) {
          ctx.state[d] = node.vector[d];
        }
        ctx.state[4] = Math.max(0.85, node.vector[4]);
        ctx.state[5] = clamp01(node.vector[5]);
        ctx.state[6] = clamp01(node.vector[6]);
        ctx.state[7] = clamp01(node.vector[7]);
        projectOntoDisk(ctx.state);
        ctx.history.push(`resonance: [${ctx.state.map((x) => x.toFixed(3)).join(', ')}]`);
        return;

      case 'Trajectory': {
        ctx.history.push(`trajectory: ${node.points.length} puntos`);
        const last = node.points[node.points.length - 1];
        if (last) {
          for (let d = 0; d < 4; d++) {
            ctx.state[d] = last.vector[d];
          }
          ctx.state[4] = Math.max(0.85, last.vector[4]);
          ctx.state[5] = clamp01(last.vector[5]);
          ctx.state[6] = clamp01(last.vector[6]);
          ctx.state[7] = clamp01(last.vector[7]);
          projectOntoDisk(ctx.state);
        }
        return;
      }

      case 'Harmonics':
        ctx.history.push(`harmonics: ${node.entries.length} entradas`);
        for (const e of node.entries) {
          ctx.variables.set(`harmonic_${e.label}`, { kind: 'Number', value: e.freqHz });
        }
        return;

      // ---- Capa 4 ----
      case 'Residue':
        for (const p of node.params) {
          ctx.variables.set(`residue_${p.key}`, paramToValue(p.value));
        }
        ctx.history.push(`residue: ${node.params.length} params`);
        return;

      // ---- Pesos ----
      case 'Weights': {
        const check = validateWeightsSum(node.weights);
        if (!check.ok) {
          throw new EvalError({ kind: 'WeightsInvalid', message: check.error });
        }
        ctx.weights = node.weights;
        ctx.history.push('weights validados (suma = 1.0)');
        return;
      }

      // ---- K-Script ----
      case 'Command': {
        const value = Evaluator.executeCommand(ctx, node.command);
        ctx.lastResult = value;
        ctx.variables.set('@last', value);
        return;
      }

      case 'Pipeline':
        for (const sub of node.statements) {
          Evaluator.executeStatement(ctx, sub);
        }
        return;

      case 'Layout':
      case 'LayoutMap':
        ctx.history.push('layout registrado (no ejecutado en MVP)');
        return;

      case 'Comment':
        return;
    }
  }

  // ---- Ejecución de commands ----

  private static executeCommand(ctx: ExecutionContext, cmd: Command): Value {
    const verbDef =
      cmd.verb.canonicalId !== null ? KSCRIPT_VERBS[cmd.verb.canonicalId] : undefined;

    // 1. Metadata del verbo al estado
    if (verbDef) {
      ctx.state[3] = Math.max(-0.999, Math.min(0.999, ctx.state[3] + verbDef.causalImpact * 0.1));
      ctx.state[5] = clamp01(ctx.state[5] + verbDef.energyCost * 0.05);
      enforceEthicsFloor(ctx.state, verbDef.ethicalFloor);
    }

    // 2. Parámetros
    let outputHint = '';
    for (const p of cmd.params) {
      if (p.kind === 'Hertz') {
        ctx.state[6] = normalizeSolfeggio(p.value);
        outputHint = ` @${p.value}Hz`;
      } else if (p.kind === 'Number') {
        ctx.state[0] = Math.max(-0.999, Math.min(0.999, ctx.state[0] + p.value * 0.01));
      } else if (p.kind === 'String') {
        outputHint += ` "${p.value}"`;
      }
    }

    // 3. Tiempo / condición (MVP: registrar)
    if (cmd.time) {
      ctx.history.push(`tiempo: ${cmd.time.kind}`);
    }
    if (cmd.condition) {
      ctx.history.push(`condición: ${cmd.condition.kind}`);
    }

    // 4. Proyectar al disco
    projectOntoDisk(ctx.state);

    // 5. Resolver nombre canónico para el handler (alias -> canónico)
    const handlerKey = verbDef
      ? verbDef.name.toLowerCase()
      : cmd.verb.rawName.toLowerCase();

    // 6. Verb-specific output
    let value: Value;
    switch (handlerKey) {
      case 'visualizar':
      case 'proyectar':
        value = {
          kind: 'Effect',
          effectType: 'render',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}${outputHint}`,
        };
        break;
      case 'hablar':
      case 'transmitir':
        value = {
          kind: 'Effect',
          effectType: 'audio',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}${outputHint}`,
        };
        break;
      case 'guardar':
        value = {
          kind: 'Effect',
          effectType: 'persist',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}${outputHint}`,
        };
        break;
      case 'notificar':
        value = {
          kind: 'Effect',
          effectType: 'alert',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;

      case 'sentir':
      case 'escuchar':
      case 'ver':
      case 'escanear':
      case 'monitorear':
      case 'detectar':
        value = { kind: 'Vector8', value: [...ctx.state] as Vector8 };
        break;

      case 'recordar':
      case 'aprender':
      case 'codificar':
        ctx.variables.set(`stored_${cmd.subject.rawName}`, {
          kind: 'Vector8',
          value: [...ctx.state] as Vector8,
        });
        value = { kind: 'Vector8', value: [...ctx.state] as Vector8 };
        break;

      case 'armonizar':
      case 'resonar':
      case 'modular':
      case 'calibrar':
      case 'sintetizar':
        value = { kind: 'Vector8', value: [...ctx.state] as Vector8 };
        break;

      // Lote 1: 10 verbos no-core
      case 'crear':
        ctx.state[0] = Math.max(-0.999, Math.min(0.999, ctx.state[0] + 0.1));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'create',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'destruir':
        ctx.state[0] = Math.max(-0.999, Math.min(0.999, ctx.state[0] - 0.1));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'destroy',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'mover':
        ctx.state[2] = Math.max(-0.999, Math.min(0.999, ctx.state[2] + 0.05));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'move',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'copiar':
        ctx.state[5] = clamp01(ctx.state[5] + 0.02);
        value = {
          kind: 'Effect',
          effectType: 'copy',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'pegar':
        ctx.state[0] = Math.max(-0.999, Math.min(0.999, ctx.state[0] + 0.02));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'paste',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'filtrar':
        ctx.state[7] = clamp01(ctx.state[7] - 0.05);
        value = { kind: 'Vector8', value: [...ctx.state] as Vector8 };
        break;
      case 'ordenar':
        ctx.state[7] = clamp01(ctx.state[7] - 0.1);
        value = { kind: 'Vector8', value: [...ctx.state] as Vector8 };
        break;
      case 'agrupar':
        ctx.state[2] = Math.max(-0.999, Math.min(0.999, ctx.state[2] + 0.03));
        projectOntoDisk(ctx.state);
        value = { kind: 'Vector8', value: [...ctx.state] as Vector8 };
        break;
      case 'abrir':
        ctx.state[1] = Math.max(-0.999, Math.min(0.999, ctx.state[1] + 0.05));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'open',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'cerrar':
        ctx.state[1] = Math.max(-0.999, Math.min(0.999, ctx.state[1] - 0.05));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'close',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;

      // Lote 2: 10 verbos no-core
      case 'buscar':
        ctx.state[1] = Math.max(-0.999, Math.min(0.999, ctx.state[1] + 0.05));
        ctx.state[7] = clamp01(ctx.state[7] - 0.05);
        projectOntoDisk(ctx.state);
        value = { kind: 'Vector8', value: [...ctx.state] as Vector8 };
        break;
      case 'analizar':
        ctx.state[7] = clamp01(ctx.state[7] - 0.1);
        value = { kind: 'Vector8', value: [...ctx.state] as Vector8 };
        break;
      case 'comparar':
        ctx.state[3] = Math.max(-0.999, Math.min(0.999, ctx.state[3] + 0.05));
        ctx.state[7] = clamp01(ctx.state[7] - 0.02);
        projectOntoDisk(ctx.state);
        value = { kind: 'Vector8', value: [...ctx.state] as Vector8 };
        break;
      case 'predecir':
        ctx.state[1] = Math.max(-0.999, Math.min(0.999, ctx.state[1] + 0.1));
        ctx.state[3] = Math.max(-0.999, Math.min(0.999, ctx.state[3] + 0.05));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'predict',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'estilizar':
        ctx.state[0] = Math.max(-0.999, Math.min(0.999, ctx.state[0] + 0.05));
        ctx.state[2] = Math.max(-0.999, Math.min(0.999, ctx.state[2] + 0.02));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'style',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'difuminar':
        ctx.state[7] = clamp01(ctx.state[7] + 0.08);
        ctx.state[0] = Math.max(-0.999, Math.min(0.999, ctx.state[0] - 0.02));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'blur',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'sombrear':
        ctx.state[5] = clamp01(ctx.state[5] + 0.05);
        ctx.state[2] = Math.max(-0.999, Math.min(0.999, ctx.state[2] + 0.02));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'shadow',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'modelar':
        ctx.state[2] = Math.max(-0.999, Math.min(0.999, ctx.state[2] + 0.1));
        ctx.state[0] = Math.max(-0.999, Math.min(0.999, ctx.state[0] + 0.05));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'model',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'mapear':
        ctx.state[2] = Math.max(-0.999, Math.min(0.999, ctx.state[2] + 0.05));
        ctx.state[3] = Math.max(-0.999, Math.min(0.999, ctx.state[3] + 0.05));
        projectOntoDisk(ctx.state);
        value = { kind: 'Vector8', value: [...ctx.state] as Vector8 };
        break;
      case 'reflejar':
        ctx.state[2] = Math.max(-0.999, Math.min(0.999, ctx.state[2] + 0.05));
        ctx.state[1] = Math.max(-0.999, Math.min(0.999, ctx.state[1] - 0.02));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'reflect',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;

      // Lote 3: 10 verbos no-core
      case 'encriptar':
        ctx.state[7] = clamp01(ctx.state[7] - 0.05);
        ctx.state[4] = clamp01(ctx.state[4] + 0.02);
        value = {
          kind: 'Effect',
          effectType: 'encrypt',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'desencriptar':
        ctx.state[7] = clamp01(ctx.state[7] + 0.02);
        ctx.state[3] = Math.max(-0.999, Math.min(0.999, ctx.state[3] + 0.05));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'decrypt',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'autenticar':
        ctx.state[4] = clamp01(ctx.state[4] + 0.05);
        ctx.state[7] = clamp01(ctx.state[7] - 0.05);
        value = {
          kind: 'Effect',
          effectType: 'authenticate',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'autorizar':
        ctx.state[3] = Math.max(-0.999, Math.min(0.999, ctx.state[3] + 0.05));
        ctx.state[4] = clamp01(ctx.state[4] + 0.02);
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'authorize',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'vincular':
        ctx.state[2] = Math.max(-0.999, Math.min(0.999, ctx.state[2] + 0.05));
        ctx.state[1] = Math.max(-0.999, Math.min(0.999, ctx.state[1] + 0.02));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'link',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'compartir':
        ctx.state[2] = Math.max(-0.999, Math.min(0.999, ctx.state[2] + 0.08));
        ctx.state[1] = Math.max(-0.999, Math.min(0.999, ctx.state[1] + 0.05));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'share',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'eliminar':
        ctx.state[0] = Math.max(-0.999, Math.min(0.999, ctx.state[0] - 0.08));
        ctx.state[2] = Math.max(-0.999, Math.min(0.999, ctx.state[2] - 0.05));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'delete',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'reiniciar':
        ctx.state[1] = 0.0;
        ctx.state[3] = 0.0;
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'restart',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'expandir':
        ctx.state[2] = Math.max(-0.999, Math.min(0.999, ctx.state[2] + 0.1));
        ctx.state[0] = Math.max(-0.999, Math.min(0.999, ctx.state[0] + 0.02));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'expand',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'contraer':
        ctx.state[2] = Math.max(-0.999, Math.min(0.999, ctx.state[2] - 0.1));
        ctx.state[0] = Math.max(-0.999, Math.min(0.999, ctx.state[0] - 0.02));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'contract',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;

      // Lote 4: 10 verbos no-core
      case 'extraer':
        ctx.state[2] = Math.max(-0.999, Math.min(0.999, ctx.state[2] - 0.05));
        ctx.state[5] = clamp01(ctx.state[5] - 0.05);
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'extract',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'configurar':
        ctx.state[3] = Math.max(-0.999, Math.min(0.999, ctx.state[3] + 0.02));
        ctx.state[0] = Math.max(-0.999, Math.min(0.999, ctx.state[0] + 0.02));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'configure',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'protocolo':
        ctx.state[3] = Math.max(-0.999, Math.min(0.999, ctx.state[3] + 0.1));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'protocol',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'reforzar':
        ctx.state[5] = clamp01(ctx.state[5] + 0.05);
        ctx.state[3] = Math.max(-0.999, Math.min(0.999, ctx.state[3] + 0.05));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'reinforce',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'traducir':
        ctx.state[7] = clamp01(ctx.state[7] - 0.05);
        ctx.state[0] = Math.max(-0.999, Math.min(0.999, ctx.state[0] + 0.05));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'translate',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'olvidar':
        ctx.state[0] = Math.max(-0.999, Math.min(0.999, ctx.state[0] - 0.1));
        ctx.state[7] = clamp01(ctx.state[7] + 0.1);
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'forget',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'detener':
        ctx.state[1] = 0.0;
        ctx.state[5] = 0.0;
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'halt',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'decodificar':
        ctx.state[7] = clamp01(ctx.state[7] - 0.08);
        ctx.state[0] = Math.max(-0.999, Math.min(0.999, ctx.state[0] + 0.08));
        projectOntoDisk(ctx.state);
        value = { kind: 'Vector8', value: [...ctx.state] as Vector8 };
        break;
      case 'cobrar':
        ctx.state[5] = clamp01(ctx.state[5] - 0.02);
        ctx.state[3] = Math.max(-0.999, Math.min(0.999, ctx.state[3] - 0.05));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'charge',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'pagar':
        ctx.state[5] = clamp01(ctx.state[5] + 0.02);
        ctx.state[3] = Math.max(-0.999, Math.min(0.999, ctx.state[3] + 0.05));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'pay',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;

      // Lote 5: 10 verbos no-core
      case 'evolucionar':
        ctx.state[0] = Math.max(-0.999, Math.min(0.999, ctx.state[0] + 0.1));
        ctx.state[7] = clamp01(ctx.state[7] - 0.1);
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'evolve',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'hibernar':
        ctx.state[5] = clamp01(ctx.state[5] - 0.1);
        ctx.state[1] = Math.max(-0.999, Math.min(0.999, ctx.state[1] - 0.1));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'hibernate',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'orquestar':
        ctx.state[3] = Math.max(-0.999, Math.min(0.999, ctx.state[3] + 0.1));
        ctx.state[2] = Math.max(-0.999, Math.min(0.999, ctx.state[2] + 0.1));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'orchestrate',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'estimular':
        ctx.state[5] = clamp01(ctx.state[5] + 0.1);
        ctx.state[0] = Math.max(-0.999, Math.min(0.999, ctx.state[0] + 0.05));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'stimulate',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'simular':
        ctx.state[7] = clamp01(ctx.state[7] + 0.05);
        ctx.state[0] = Math.max(-0.999, Math.min(0.999, ctx.state[0] + 0.05));
        projectOntoDisk(ctx.state);
        value = { kind: 'Vector8', value: [...ctx.state] as Vector8 };
        break;
      case 'gobernar':
        ctx.state[4] = clamp01(ctx.state[4] + 0.05);
        ctx.state[3] = Math.max(-0.999, Math.min(0.999, ctx.state[3] + 0.05));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'govern',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'intercambiar':
        ctx.state[5] = clamp01(ctx.state[5] + 0.05);
        ctx.state[2] = Math.max(-0.999, Math.min(0.999, ctx.state[2] + 0.05));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'exchange',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'inocular':
        ctx.state[0] = Math.max(-0.999, Math.min(0.999, ctx.state[0] + 0.08));
        ctx.state[2] = Math.max(-0.999, Math.min(0.999, ctx.state[2] + 0.02));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'inoculate',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'cosechar':
        ctx.state[5] = clamp01(ctx.state[5] + 0.1);
        ctx.state[1] = Math.max(-0.999, Math.min(0.999, ctx.state[1] + 0.05));
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'harvest',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;
      case 'meditar':
        ctx.state[7] = clamp01(ctx.state[7] - 0.15);
        ctx.state[4] = clamp01(ctx.state[4] + 0.02);
        value = {
          kind: 'Effect',
          effectType: 'meditate',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;

      case 'ejecutar':
      case 'iterar':
      case 'esperar':
        value = { kind: 'Bool', value: true };
        break;

      // Lote 6: 73/73
      case 'cultivar':
        ctx.state[0] = Math.max(-0.999, Math.min(0.999, ctx.state[0] + 0.08));
        ctx.state[2] = Math.max(-0.999, Math.min(0.999, ctx.state[2] + 0.08));
        ctx.state[5] = clamp01(ctx.state[5] + 0.05);
        projectOntoDisk(ctx.state);
        value = {
          kind: 'Effect',
          effectType: 'cultivate',
          payload: `${cmd.verb.rawName} sobre ${cmd.subject.rawName}`,
        };
        break;

      default:
        if (verbDef) {
          value = { kind: 'Null' };
        } else {
          throw new EvalError({ kind: 'UnknownVerb', verb: cmd.verb.rawName });
        }
    }

    ctx.history.push(
      `exec: ${cmd.verb.rawName}:${cmd.subject.rawName}[${cmd.params.length}] → ${valueKindName(value)}`
    );
    return value;
  }

  // ---- Validación de invariantes ----

  private static validateInvariants(ctx: ExecutionContext): void {
    for (const inv of ctx.invariants) {
      const actual = invariantValue(ctx, inv);
      if (actual === null) continue;

      let passes = false;
      switch (inv.op) {
        case 'Gte':
          passes = actual >= inv.value;
          break;
        case 'Lte':
          passes = actual <= inv.value;
          break;
        case 'Gt':
          passes = actual > inv.value;
          break;
        case 'Lt':
          passes = actual < inv.value;
          break;
        case 'Eq':
          passes = Math.abs(actual - inv.value) < 1e-9;
          break;
        case 'Neq':
          passes = Math.abs(actual - inv.value) >= 1e-9;
          break;
      }

      if (!passes) {
        throw new EvalError({
          kind: 'InvariantViolation',
          name: inv.subject,
          expected: `${inv.op} ${inv.value}`,
          actual,
        });
      }
    }
  }
}

function invariantValue(ctx: ExecutionContext, inv: InvariantExpr): number | null {
  switch (inv.subject.toLowerCase()) {
    case 'etica':
    case 'ética':
    case 'η':
      return ctx.state[4];
    case 'incertidumbre':
    case 'υ':
      return ctx.state[7];
    case 'causalidad':
    case 'χ':
      return ctx.state[3];
    case 'energetica':
    case 'energética':
    case 'ε':
      return ctx.state[5];
    case 'resonancia':
    case 'ω':
      return ctx.state[6];
    default:
      return null;
  }
}

// ============================================================================
// FACADE
// ============================================================================

export function evaluate(rima: Rima): EvaluationResult {
  return Evaluator.evaluate(rima);
}
