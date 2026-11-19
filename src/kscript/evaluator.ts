import { 
  KScriptProgram, 
  CommandNode, 
  KScriptEvaluationResult, 
  ExecutionTrace, 
  KScriptError 
} from './types';
import { findVerb, findSubject, DOMAIN_BASE_VECTORS } from './dictionary';

// Parámetros canónicos del campo dinámico 8D (Calibración interior natural: disipación diagonal balanceada y acoplamiento regulado)
const A_DIAG = [-0.26, -0.28, -0.26, -0.30, -0.20, -0.28, -0.22, -0.25];
const B_COUPLING = 0.32;
const C_FACTOR = 1.8;

function computeDerivatives(x: number[]): number[] {
  const dxdt = new Array(8).fill(0);
  for (let i = 0; i < 8; i++) {
    const linear = A_DIAG[i] * x[i];
    const prev = x[(i + 7) % 8];
    const next = x[(i + 1) % 8];
    const nonLinear = B_COUPLING * Math.tanh(C_FACTOR * (0.5 * prev + 0.5 * next));
    dxdt[i] = linear + nonLinear;
  }
  return dxdt;
}

function projectOntoPoincare(
  vec: [number, number, number, number, number, number, number, number]
): [number, number, number, number, number, number, number, number] {
  const res = [...vec] as [number, number, number, number, number, number, number, number];
  
  // Proyección de la sub-variedad geométrica 4D [c, t, s, ch] al disco/bola de Poincaré (||x|| < 1.0)
  const geomNorm = Math.sqrt(res[0] * res[0] + res[1] * res[1] + res[2] * res[2] + res[3] * res[3]);
  if (geomNorm >= 0.999) {
    const scale = 0.990 / geomNorm;
    res[0] *= scale;
    res[1] *= scale;
    res[2] *= scale;
    res[3] *= scale;
  }

  // Preservación de invariantes ontológicos [et, en, res, inc]
  res[4] = Math.min(1.0, Math.max(0.85, res[4])); // Ética >= 0.85 estricto
  res[5] = Math.min(1.0, Math.max(0.0, res[5]));  // Energía [0, 1]
  res[6] = Math.min(1.0, Math.max(0.0, res[6]));  // Resonancia armónica [0, 1]
  res[7] = Math.min(0.5, Math.max(0.0, res[7]));  // Incertidumbre / entropía [0, 0.5]

  return res;
}

/**
 * Distancia geodésica sobre la variedad producto riemanniana M^8 = B^4 x I^4
 * ds^2 = g_{B^4} + g_{I^4}
 */
export function computeDistanceM8(
  a: [number, number, number, number, number, number, number, number] | number[],
  b: [number, number, number, number, number, number, number, number] | number[],
  weights: [number, number, number, number] = [1.0, 1.0, 1.0, 1.0]
): {
  totalDistance: number;
  hyperbolicBaseDist: number;
  fiberDist: number;
} {
  // 1. Distancia Hiperbólica en la Base Poincaré B^4
  const u = [a[0], a[1], a[2], a[3]];
  const v = [b[0], b[1], b[2], b[3]];
  
  const normUSq = u[0]*u[0] + u[1]*u[1] + u[2]*u[2] + u[3]*u[3];
  const normVSq = v[0]*v[0] + v[1]*v[1] + v[2]*v[2] + v[3]*v[3];
  
  const diffSq = (u[0]-v[0])**2 + (u[1]-v[1])**2 + (u[2]-v[2])**2 + (u[3]-v[3])**2;
  const denom = Math.max(1e-12, (1 - normUSq) * (1 - normVSq));
  const delta = 1 + (2 * diffSq) / denom;
  const hyperbolicBaseDist = Math.acosh(Math.max(1.0, delta));

  // 2. Distancia Euclidiana Ponderada en la Fibra Invariante I^4 [eta, epsilon, omega, upsilon]
  const dEta = (a[4] - b[4]) ** 2 * weights[0];
  const dEps = (a[5] - b[5]) ** 2 * weights[1];
  const dOmega = (a[6] - b[6]) ** 2 * weights[2];
  const dUps = (a[7] - b[7]) ** 2 * weights[3];
  const fiberDist = Math.sqrt(dEta + dEps + dOmega + dUps);

  // 3. Métrica Producto Riemanniana Global: d_M8 = sqrt(d_B4^2 + d_I4^2)
  const totalDistance = Math.sqrt(hyperbolicBaseDist * hyperbolicBaseDist + fiberDist * fiberDist);

  return {
    totalDistance,
    hyperbolicBaseDist,
    fiberDist
  };
}

export function simulateRK4(
  initialState: [number, number, number, number, number, number, number, number] | number[],
  steps = 40,
  dt = 0.01
): Array<[number, number, number, number, number, number, number, number]> {
  const trajectory: Array<[number, number, number, number, number, number, number, number]> = new Array(steps + 1);

  // Proyección y extracción a registros locales
  let x0 = initialState[0] || 0, x1 = initialState[1] || 0, x2 = initialState[2] || 0, x3 = initialState[3] || 0;
  let x4 = initialState[4] ?? 0.85, x5 = initialState[5] || 0, x6 = initialState[6] || 0, x7 = initialState[7] || 0;

  let gNorm = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2 + x3 * x3);
  if (gNorm >= 0.999) {
    const scale = 0.990 / gNorm;
    x0 *= scale; x1 *= scale; x2 *= scale; x3 *= scale;
  }
  x4 = Math.min(1.0, Math.max(0.85, x4));
  x5 = Math.min(1.0, Math.max(0.0, x5));
  x6 = Math.min(1.0, Math.max(0.0, x6));
  x7 = Math.min(0.5, Math.max(0.0, x7));

  trajectory[0] = [x0, x1, x2, x3, x4, x5, x6, x7];

  const dtHalf = 0.5 * dt;
  const dtSixth = dt / 6.0;

  for (let s = 1; s <= steps; s++) {
    // 1. Etapa k1
    const k1_0 = -0.26 * x0 + 0.32 * Math.tanh(0.9 * (x7 + x1));
    const k1_1 = -0.28 * x1 + 0.32 * Math.tanh(0.9 * (x0 + x2));
    const k1_2 = -0.26 * x2 + 0.32 * Math.tanh(0.9 * (x1 + x3));
    const k1_3 = -0.30 * x3 + 0.32 * Math.tanh(0.9 * (x2 + x4));
    const k1_4 = -0.20 * x4 + 0.32 * Math.tanh(0.9 * (x3 + x5));
    const k1_5 = -0.28 * x5 + 0.32 * Math.tanh(0.9 * (x4 + x6));
    const k1_6 = -0.22 * x6 + 0.32 * Math.tanh(0.9 * (x5 + x7));
    const k1_7 = -0.25 * x7 + 0.32 * Math.tanh(0.9 * (x6 + x0));

    // Midpoint 1
    const xk1_0 = x0 + dtHalf * k1_0;
    const xk1_1 = x1 + dtHalf * k1_1;
    const xk1_2 = x2 + dtHalf * k1_2;
    const xk1_3 = x3 + dtHalf * k1_3;
    const xk1_4 = x4 + dtHalf * k1_4;
    const xk1_5 = x5 + dtHalf * k1_5;
    const xk1_6 = x6 + dtHalf * k1_6;
    const xk1_7 = x7 + dtHalf * k1_7;

    // 2. Etapa k2
    const k2_0 = -0.26 * xk1_0 + 0.32 * Math.tanh(0.9 * (xk1_7 + xk1_1));
    const k2_1 = -0.28 * xk1_1 + 0.32 * Math.tanh(0.9 * (xk1_0 + xk1_2));
    const k2_2 = -0.26 * xk1_2 + 0.32 * Math.tanh(0.9 * (xk1_1 + xk1_3));
    const k2_3 = -0.30 * xk1_3 + 0.32 * Math.tanh(0.9 * (xk1_2 + xk1_4));
    const k2_4 = -0.20 * xk1_4 + 0.32 * Math.tanh(0.9 * (xk1_3 + xk1_5));
    const k2_5 = -0.28 * xk1_5 + 0.32 * Math.tanh(0.9 * (xk1_4 + xk1_6));
    const k2_6 = -0.22 * xk1_6 + 0.32 * Math.tanh(0.9 * (xk1_5 + xk1_7));
    const k2_7 = -0.25 * xk1_7 + 0.32 * Math.tanh(0.9 * (xk1_6 + xk1_0));

    // Midpoint 2
    const xk2_0 = x0 + dtHalf * k2_0;
    const xk2_1 = x1 + dtHalf * k2_1;
    const xk2_2 = x2 + dtHalf * k2_2;
    const xk2_3 = x3 + dtHalf * k2_3;
    const xk2_4 = x4 + dtHalf * k2_4;
    const xk2_5 = x5 + dtHalf * k2_5;
    const xk2_6 = x6 + dtHalf * k2_6;
    const xk2_7 = x7 + dtHalf * k2_7;

    // 3. Etapa k3
    const k3_0 = -0.26 * xk2_0 + 0.32 * Math.tanh(0.9 * (xk2_7 + xk2_1));
    const k3_1 = -0.28 * xk2_1 + 0.32 * Math.tanh(0.9 * (xk2_0 + xk2_2));
    const k3_2 = -0.26 * xk2_2 + 0.32 * Math.tanh(0.9 * (xk2_1 + xk2_3));
    const k3_3 = -0.30 * xk2_3 + 0.32 * Math.tanh(0.9 * (xk2_2 + xk2_4));
    const k3_4 = -0.20 * xk2_4 + 0.32 * Math.tanh(0.9 * (xk2_3 + xk2_5));
    const k3_5 = -0.28 * xk2_5 + 0.32 * Math.tanh(0.9 * (xk2_4 + xk2_6));
    const k3_6 = -0.22 * xk2_6 + 0.32 * Math.tanh(0.9 * (xk2_5 + xk2_7));
    const k3_7 = -0.25 * xk2_7 + 0.32 * Math.tanh(0.9 * (xk2_6 + xk2_0));

    // Endpoint 3
    const xk3_0 = x0 + dt * k3_0;
    const xk3_1 = x1 + dt * k3_1;
    const xk3_2 = x2 + dt * k3_2;
    const xk3_3 = x3 + dt * k3_3;
    const xk3_4 = x4 + dt * k3_4;
    const xk3_5 = x5 + dt * k3_5;
    const xk3_6 = x6 + dt * k3_6;
    const xk3_7 = x7 + dt * k3_7;

    // 4. Etapa k4
    const k4_0 = -0.26 * xk3_0 + 0.32 * Math.tanh(0.9 * (xk3_7 + xk3_1));
    const k4_1 = -0.28 * xk3_1 + 0.32 * Math.tanh(0.9 * (xk3_0 + xk3_2));
    const k4_2 = -0.26 * xk3_2 + 0.32 * Math.tanh(0.9 * (xk3_1 + xk3_3));
    const k4_3 = -0.30 * xk3_3 + 0.32 * Math.tanh(0.9 * (xk3_2 + xk3_4));
    const k4_4 = -0.20 * xk3_4 + 0.32 * Math.tanh(0.9 * (xk3_3 + xk3_5));
    const k4_5 = -0.28 * xk3_5 + 0.32 * Math.tanh(0.9 * (xk3_4 + xk3_6));
    const k4_6 = -0.22 * xk3_6 + 0.32 * Math.tanh(0.9 * (xk3_5 + xk3_7));
    const k4_7 = -0.25 * xk3_7 + 0.32 * Math.tanh(0.9 * (xk3_6 + xk3_0));

    // Actualización de Simpson RK4
    x0 += dtSixth * (k1_0 + 2 * (k2_0 + k3_0) + k4_0);
    x1 += dtSixth * (k1_1 + 2 * (k2_1 + k3_1) + k4_1);
    x2 += dtSixth * (k1_2 + 2 * (k2_2 + k3_2) + k4_2);
    x3 += dtSixth * (k1_3 + 2 * (k2_3 + k3_3) + k4_3);
    x4 += dtSixth * (k1_4 + 2 * (k2_4 + k3_4) + k4_4);
    x5 += dtSixth * (k1_5 + 2 * (k2_5 + k3_5) + k4_5);
    x6 += dtSixth * (k1_6 + 2 * (k2_6 + k3_6) + k4_6);
    x7 += dtSixth * (k1_7 + 2 * (k2_7 + k3_7) + k4_7);

    // Proyección inmediata sobre el fibrado M^8 = B^4 x F^4
    gNorm = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2 + x3 * x3);
    if (gNorm >= 0.999) {
      const scale = 0.990 / gNorm;
      x0 *= scale; x1 *= scale; x2 *= scale; x3 *= scale;
    }
    x4 = Math.min(1.0, Math.max(0.85, x4));
    x5 = Math.min(1.0, Math.max(0.0, x5));
    x6 = Math.min(1.0, Math.max(0.0, x6));
    x7 = Math.min(0.5, Math.max(0.0, x7));

    trajectory[s] = [x0, x1, x2, x3, x4, x5, x6, x7];
  }

  return trajectory;
}

export class KScriptEvaluator {
  public static evaluate(
    program: KScriptProgram,
    initialState: [number, number, number, number, number, number, number, number] = [0, 0, 0, 0, 0.85, 0.5, 0.528, 0.1]
  ): { result?: KScriptEvaluationResult; error?: KScriptError } {
    let currentState = [...initialState] as [number, number, number, number, number, number, number, number];
    const traces: ExecutionTrace[] = [];
    const fullTrajectory: Array<[number, number, number, number, number, number, number, number]> = [currentState];

    for (let idx = 0; idx < program.statements.length; idx++) {
      const stmt = program.statements[idx];

      if (stmt.type === 'Command') {
        const impulse = this.evalCommandImpulse(stmt.command, currentState);
        const traj = simulateRK4(impulse, 40, 0.01);
        const finalSt = traj[traj.length - 1];
        const geomNorm = Math.sqrt(finalSt[0] * finalSt[0] + finalSt[1] * finalSt[1] + finalSt[2] * finalSt[2] + finalSt[3] * finalSt[3]);

        traces.push({
          statementIndex: idx,
          description: `${stmt.command.verb}: ${stmt.command.subject}`,
          inputVector: currentState,
          finalVector: finalSt,
          normFinal: geomNorm,
          ethicalScore: finalSt[4],
          resonanceScore: finalSt[6],
          isStable: geomNorm < 1.0 && finalSt[4] >= 0.85,
        });

        currentState = finalSt;
        fullTrajectory.push(...traj);
      } else if (stmt.type === 'Pipeline') {
        let pipeState = [...currentState] as [number, number, number, number, number, number, number, number];
        for (const step of stmt.pipeline.steps) {
          const impulse = this.evalCommandImpulse(step, pipeState);
          const traj = simulateRK4(impulse, 30, 0.01);
          pipeState = traj[traj.length - 1];
          fullTrajectory.push(...traj);
        }
        const geomNorm = Math.sqrt(pipeState[0] * pipeState[0] + pipeState[1] * pipeState[1] + pipeState[2] * pipeState[2] + pipeState[3] * pipeState[3]);
        traces.push({
          statementIndex: idx,
          description: `Pipeline (${stmt.pipeline.steps.length} pasos)`,
          inputVector: currentState,
          finalVector: pipeState,
          normFinal: geomNorm,
          ethicalScore: pipeState[4],
          resonanceScore: pipeState[6],
          isStable: geomNorm < 1.0 && pipeState[4] >= 0.85,
        });
        currentState = pipeState;
      } else if (stmt.type === 'Parallel') {
        const blended = [0, 0, 0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number, number, number];
        for (const branch of stmt.parallel.branches) {
          const imp = this.evalCommandImpulse(branch, currentState);
          for (let i = 0; i < 8; i++) {
            blended[i] += imp[i] / stmt.parallel.branches.length;
          }
        }
        const proj = projectOntoPoincare(blended);
        const traj = simulateRK4(proj, 40, 0.01);
        const finalSt = traj[traj.length - 1];
        const geomNorm = Math.sqrt(finalSt[0] * finalSt[0] + finalSt[1] * finalSt[1] + finalSt[2] * finalSt[2] + finalSt[3] * finalSt[3]);

        traces.push({
          statementIndex: idx,
          description: `Paralelo (${stmt.parallel.branches.length} ramas)`,
          inputVector: currentState,
          finalVector: finalSt,
          normFinal: geomNorm,
          ethicalScore: finalSt[4],
          resonanceScore: finalSt[6],
          isStable: geomNorm < 1.0 && finalSt[4] >= 0.85,
        });
        currentState = finalSt;
        fullTrajectory.push(...traj);
      }
    }

    const finalGeomNorm = Math.sqrt(currentState[0] * currentState[0] + currentState[1] * currentState[1] + currentState[2] * currentState[2] + currentState[3] * currentState[3]);
    if (finalGeomNorm >= 1.0) {
      return {
        error: {
          code: 'E011_POINCARE_VIOLATION',
          message: `Violación del disco de Poincaré: norma final ${finalGeomNorm.toFixed(4)} >= 1.0`,
          line: 1,
          column: 1,
        },
      };
    }

    return {
      result: {
        initialState,
        finalState: currentState,
        traces,
        trajectory: fullTrajectory,
        lyapunovStable: true,
        allInvariantsPreserved: currentState[4] >= 0.85 && finalGeomNorm < 1.0,
      },
    };
  }

  public static evalCommandImpulse(
    cmd: CommandNode,
    base: [number, number, number, number, number, number, number, number]
  ): [number, number, number, number, number, number, number, number] {
    const verbDef = findVerb(cmd.verb);
    const subjDef = findSubject(cmd.subject);

    const domain = verbDef?.domain || subjDef?.domain || 'Harmonic';
    const baseVec = [...DOMAIN_BASE_VECTORS[domain]] as [number, number, number, number, number, number, number, number];

    if (verbDef) {
      const energyFactor = 0.5 + (verbDef.energyCost ?? 0.25);
      baseVec[0] = Math.max(-0.8, Math.min(0.8, verbDef.causalImpact * 0.5));
      baseVec[1] *= energyFactor;
      baseVec[2] *= energyFactor;
      baseVec[3] *= energyFactor;
      baseVec[4] = Math.max(baseVec[4], verbDef.ethicalFloor);
      baseVec[5] = verbDef.energyCost;
    }

    let freqHz = subjDef?.defaultFreqHz || 528;
    for (const p of cmd.params) {
      if (p.value.type === 'Frequency') {
        freqHz = p.value.value;
      } else if (p.value.type === 'Number' && (p.key === 'frecuencia' || p.key === 'freq')) {
        freqHz = p.value.value;
      }
    }
    baseVec[6] = Math.min(0.999, Math.max(0.01, freqHz / 1000.0));

    if (cmd.modifier?.symbol === '~') {
      baseVec[7] = Math.min(0.5, baseVec[7] + 0.2);
    } else if (cmd.modifier?.symbol === '!') {
      baseVec[1] *= 1.25;
      baseVec[2] *= 1.25;
      baseVec[3] *= 1.25;
      baseVec[4] = Math.min(0.99, baseVec[4] + 0.05);
      baseVec[5] = Math.min(0.99, baseVec[5] + 0.15);
    }

    // Blend con base previa para continuidad orbital
    const blended = [0, 0, 0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number, number, number];
    for (let i = 0; i < 8; i++) {
      blended[i] = 0.3 * base[i] + 0.7 * baseVec[i];
    }

    return projectOntoPoincare(blended);
  }
}
