import { Matrix, inverse } from 'ml-matrix';

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
  const p = jacobian[0].length;
  const sigma2 = residuals.reduce((s, r, i) => s + weights[i] * r * r, 0) / (n - p);
  // Using inverse function from ml-matrix as standalone method
  try {
    return inverse(JtWJ).mul(sigma2);
  } catch (e) {
    // If matrix is singular, fallback to SVD based pseudo-inverse
    return inverse(JtWJ, true).mul(sigma2);
  }
}

export function correlationMatrix(cov: Matrix): Matrix {
  const n = cov.rows;
  const corr = Matrix.zeros(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      corr.set(i, j, cov.get(i, j) / Math.sqrt(cov.get(i, i) * cov.get(j, j)));
    }
  }
  return corr;
}

export function chiSquared(residuals: number[], weights: number[]): number {
  return residuals.reduce((s, r, i) => s + weights[i] * r * r, 0);
}

export function rwp(residuals: number[], weights: number[], observed: number[]): number {
  const num = chiSquared(residuals, weights);
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