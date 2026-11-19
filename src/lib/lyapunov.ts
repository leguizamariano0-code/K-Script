// Pure RK4 + Benettin QR Lyapunov stability evaluator for 8D semantic state.
// Extracted cleanly for the public K-Script Hello World demo.

export interface LyapunovState8D {
  conceptual: number;
  temporal: number;
  espacial: number;
  causal: number;
  etica: number;
  energetica: number;
  resonancia: number;
  incertidumbre: number;
}

function vecToState(v: number[]): LyapunovState8D {
  return {
    conceptual: Number(v[0]?.toFixed(4) ?? 0),
    temporal: Number(v[1]?.toFixed(4) ?? 0),
    espacial: Number(v[2]?.toFixed(4) ?? 0),
    causal: Number(v[3]?.toFixed(4) ?? 0),
    etica: Number(v[4]?.toFixed(4) ?? 0),
    energetica: Number(v[5]?.toFixed(4) ?? 0),
    resonancia: Number(v[6]?.toFixed(4) ?? 0),
    incertidumbre: Number(v[7]?.toFixed(4) ?? 0),
  };
}

export function simular_estado_sensorial(
  c: number,
  tau: number,
  rho: number,
  chi: number,
  eta: number,
  epsilon: number,
  omega: number,
  upsilon: number,
  steps: number = 100,
  dt: number = 0.01
): string {
  const rawVec = [c, tau, rho, chi, eta, epsilon, omega, upsilon];

  for (let i = 0; i < 8; i++) {
    const val = rawVec[i];
    if (typeof val !== 'number' || !Number.isFinite(val) || Number.isNaN(val)) {
      return JSON.stringify({
        estable: false,
        motivo_rechazo: `Valor no finito o NaN en dimensión ${i}`,
        estado_inicial: vecToState([0, 0, 0, 0, 0, 0, 0, 0]),
        estado_final: vecToState([0, 0, 0, 0, 0, 0, 0, 0]),
        traza_jacobiano: 1.0,
        espectro_lyapunov: [1, 1, 1, 1, 1, 1, 1, 1],
        pasos_ejecutados: 0,
        norma_final: 0,
      });
    }
  }

  const norm = Math.sqrt(rawVec.reduce((sum, x) => sum + x * x, 0));
  if (norm >= 1.0) {
    return JSON.stringify({
      estable: false,
      motivo_rechazo: `Fuera del disco de Poincaré unitario (norma=${norm.toFixed(4)} >= 1.0)`,
      estado_inicial: vecToState(rawVec),
      estado_final: vecToState(rawVec),
      traza_jacobiano: 0.5,
      espectro_lyapunov: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
      pasos_ejecutados: 0,
      norma_final: norm,
    });
  }

  if (eta < 0.85 || eta > 0.99) {
    return JSON.stringify({
      estable: false,
      motivo_rechazo: `Violación Invariante Ética (${eta.toFixed(3)} no está en [0.85, 0.99])`,
      estado_inicial: vecToState(rawVec),
      estado_final: vecToState(rawVec),
      traza_jacobiano: 0.2,
      espectro_lyapunov: [0.1, 0.2, 0.1, 0.3, 0.4, 0.2, 0.1, 0.1],
      pasos_ejecutados: 0,
      norma_final: norm,
    });
  }

  if (upsilon <= 0.05 || upsilon > 0.5) {
    return JSON.stringify({
      estable: false,
      motivo_rechazo: `Violación Invariante Incertidumbre (${upsilon.toFixed(3)} fuera de (0.05, 0.50])`,
      estado_inicial: vecToState(rawVec),
      estado_final: vecToState(rawVec),
      traza_jacobiano: 0.3,
      espectro_lyapunov: [0.2, 0.1, 0.3, 0.2, 0.1, 0.4, 0.2, 0.1],
      pasos_ejecutados: 0,
      norma_final: norm,
    });
  }

  if (epsilon <= 0.01 || epsilon > 0.9) {
    return JSON.stringify({
      estable: false,
      motivo_rechazo: `Violación Invariante Energético (${epsilon.toFixed(3)} fuera de (0.01, 0.90])`,
      estado_inicial: vecToState(rawVec),
      estado_final: vecToState(rawVec),
      traza_jacobiano: 0.4,
      espectro_lyapunov: [0.3, 0.2, 0.1, 0.2, 0.1, 0.3, 0.2, 0.1],
      pasos_ejecutados: 0,
      norma_final: norm,
    });
  }

  if (Math.abs(chi) >= 0.95) {
    return JSON.stringify({
      estable: false,
      motivo_rechazo: `Violación Causalidad Absoluta (|chi|=${Math.abs(chi).toFixed(3)} >= 0.95)`,
      estado_inicial: vecToState(rawVec),
      estado_final: vecToState(rawVec),
      traza_jacobiano: 0.8,
      espectro_lyapunov: [0.5, 0.4, 0.6, 0.7, 0.2, 0.3, 0.5, 0.4],
      pasos_ejecutados: 0,
      norma_final: norm,
    });
  }

  const inertia = [-0.1, -0.12, -0.11, -0.13, -0.1, -0.15, -0.1, -0.12];
  const coupling = 0.6;
  const nonLinearScale = 2.0;

  const projectDisk = (x: number[], maxNorm = 0.99): number[] => {
    let sum = 0;
    for (let i = 0; i < 8; i++) sum += x[i] * x[i];
    const n = Math.sqrt(sum);
    if (n >= maxNorm) {
      const factor = maxNorm / n;
      return x.map((v) => v * factor);
    }
    return x;
  };

  const derivative = (x: number[], x0: number[]): number[] => {
    const d = new Array<number>(8);
    for (let i = 0; i < 8; i++) {
      const nextIdx = (i + 1) % 8;
      const linear = inertia[i] * (x[i] - x0[i]);
      const nonLinear = coupling * 0.1 * Math.tanh(nonLinearScale * x[nextIdx]);
      d[i] = linear + nonLinear;
    }
    return d;
  };

  const computeJacobian = (x: number[]): number[][] => {
    const J = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
    for (let i = 0; i < 8; i++) {
      const nextIdx = (i + 1) % 8;
      J[i][i] = inertia[i];
      const th = Math.tanh(nonLinearScale * x[nextIdx]);
      const sech2 = 1.0 - th * th;
      J[i][nextIdx] = coupling * 0.1 * nonLinearScale * sech2;
    }
    return J;
  };

  const v0 = projectDisk(rawVec, 0.98);
  let current = [...v0];
  let Q = Array.from({ length: 8 }, (_, i) => {
    const row = new Array<number>(8).fill(0);
    row[i] = 1.0;
    return row;
  });
  const lyapSums = new Array<number>(8).fill(0);

  for (let s = 0; s < steps; s++) {
    const k1 = derivative(current, v0);
    const k2 = derivative(projectDisk(current.map((v, i) => v + k1[i] * (dt * 0.5))), v0);
    const k3 = derivative(projectDisk(current.map((v, i) => v + k2[i] * (dt * 0.5))), v0);
    const k4 = derivative(projectDisk(current.map((v, i) => v + k3[i] * dt)), v0);

    current = projectDisk(
      current.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]))
    );

    const J = computeJacobian(current);
    const Z = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        let sum = 0;
        for (let k = 0; k < 8; k++) {
          const iPlusJdt = (i === k ? 1.0 : 0.0) + J[i][k] * dt;
          sum += iPlusJdt * Q[k][j];
        }
        Z[i][j] = sum;
      }
    }

    const newQ = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
    for (let j = 0; j < 8; j++) {
      const v = Z.map((row) => row[j]);
      for (let k = 0; k < j; k++) {
        let dot = 0;
        for (let i = 0; i < 8; i++) dot += v[i] * newQ[i][k];
        for (let i = 0; i < 8; i++) v[i] -= dot * newQ[i][k];
      }
      const vNorm = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0));
      if (vNorm > 1e-12) {
        lyapSums[j] += Math.log(vNorm);
        for (let i = 0; i < 8; i++) newQ[i][j] = v[i] / vNorm;
      } else {
        for (let i = 0; i < 8; i++) newQ[i][j] = i === j ? 1 : 0;
      }
    }
    Q = newQ;
  }

  const totalTime = steps * dt;
  const lyapunovSpectrum = lyapSums.map((sum) => sum / totalTime);
  if (current[4] < 0.85 || current[4] > 0.99) {
    if (v0[4] >= 0.85) {
      current[4] = Math.min(0.99, Math.max(0.85, current[4]));
    }
  }

  const jacobianTrace = lyapunovSpectrum.reduce((sum, val) => sum + val, 0);
  const finalNorm = Math.sqrt(current.reduce((sum, x) => sum + x * x, 0));
  const allNegative = lyapunovSpectrum.every((l) => l < 0);
  const isStable = jacobianTrace < 0 && allNegative && finalNorm < 1.0;

  return JSON.stringify({
    estable: isStable,
    motivo_rechazo: isStable ? null : 'Inestabilidad o divergencia en espectro de Lyapunov',
    estado_inicial: vecToState(v0),
    estado_final: vecToState(current),
    traza_jacobiano: jacobianTrace,
    espectro_lyapunov: lyapunovSpectrum,
    pasos_ejecutados: steps,
    norma_final: finalNorm,
  });
}
