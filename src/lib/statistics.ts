import { Matrix, inverse } from 'ml-matrix';
import { weightedLossSum } from '@/lib/numerics';
import type { LossType } from '@/lib/numerics';

export function buildCovarianceMatrix(
  jacobian: number[][],
  residuals: number[],
  weights: number[],
): Matrix {
  const J = new Matrix(jacobian);
  const W = Matrix.diagonal(weights);
  // C = (J^T W J)^{-1} · σ²
  const JtW = J.transpose().mmul(W);
  const JtWJ = JtW.mmul(J);
  const n = residuals.length;
  const p = jacobian[0]?.length ?? 0;
  const dof = n - p;

  if (n === 0 || p === 0 || dof <= 0) {
    return Matrix.zeros(p, p);
  }

  const sigma2 = residuals.reduce((s, r, i) => s + weights[i] * r * r, 0) / dof;
  // Using inverse function from ml-matrix as standalone method
  try {
    return inverse(JtWJ).mul(sigma2);
  } catch {
    // If matrix is singular, fallback to SVD based pseudo-inverse
    return inverse(JtWJ, true).mul(sigma2);
  }
}

export function correlationMatrix(cov: Matrix): Matrix {
  const n = cov.rows;
  const corr = Matrix.zeros(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const vI = cov.get(i, i);
      const vJ = cov.get(j, j);

      if (!Number.isFinite(vI) || !Number.isFinite(vJ) || vI <= 0 || vJ <= 0) {
        corr.set(i, j, i === j ? 1 : 0);
      } else {
        corr.set(i, j, cov.get(i, j) / Math.sqrt(vI * vJ));
      }
    }
  }
  return corr;
}

export function chiSquared(
  residuals: number[],
  weights: number[],
  lossType: LossType = 'L2',
  huberBeta = 10,
): number {
  return weightedLossSum(residuals, weights, lossType, huberBeta);
}

export function rwp(
  residuals: number[],
  weights: number[],
  observed: number[],
  lossType: LossType = 'L2',
  huberBeta = 10,
): number {
  const num = chiSquared(residuals, weights, lossType, huberBeta);
  const den = observed.reduce((s, y, i) => s + weights[i] * y * y, 0);
  return Math.sqrt(num / den);
}

export function rBranch(
  residuals: number[],
  observed: number[],
  indices: number[],
): number {
  const num = indices.reduce((s, i) => s + Math.abs(residuals[i]), 0);
  const den = indices.reduce((s, i) => s + Math.abs(observed[i]), 0);
  return num / den;
}

import type { FitParameter } from '@/lib/fitAdapter';

export function calculateErrorPropagation(
  evalFn: (params: FitParameter[]) => number,
  params: FitParameter[],
  covMatrix: number[][]
): number {
  if (!covMatrix || covMatrix.length === 0 || !covMatrix[0] || covMatrix[0].length === 0) {
    return 0;
  }

  const freeParams = params.filter(p => !p.fixed);
  if (freeParams.length === 0) return 0;

  if (covMatrix.length !== freeParams.length || covMatrix[0].length !== freeParams.length) {
    return 0;
  }

  const grad: number[] = [];
  for (const fp of freeParams) {
    const h = Math.max(1e-5, Math.abs(fp.value) * 1e-5);
    const pPlus = params.map(p => p.name === fp.name ? { ...p, value: p.value + h } : p);
    const pMinus = params.map(p => p.name === fp.name ? { ...p, value: p.value - h } : p);

    const vPlus = evalFn(pPlus);
    const vMinus = evalFn(pMinus);
    grad.push((vPlus - vMinus) / (2 * h));
  }

  let variance = 0;
  for (let i = 0; i < grad.length; i++) {
    for (let j = 0; j < grad.length; j++) {
      const covVal = covMatrix[i][j];
      if (covVal !== undefined && !isNaN(covVal) && !isNaN(grad[i]) && !isNaN(grad[j])) {
        variance += grad[i] * covVal * grad[j];
      }
    }
  }

  return variance > 0 ? Math.sqrt(variance) : 0;
}

// Предупреждение о высоких корреляциях
export function highCorrelationWarnings(
  corr: Matrix,
  paramNames: string[],
  threshold = 0.95,
): string[] {
  const warnings: string[] = [];
  for (let i = 0; i < corr.rows; i++) {
    for (let j = i + 1; j < corr.columns; j++) {
      if (Math.abs(corr.get(i, j)) > threshold) {
        warnings.push(
          `Высокая корреляция (${corr.get(i, j).toFixed(3)}): ${paramNames[i]} ↔ ${paramNames[j]}`
        );
      }
    }
  }
  return warnings;
}