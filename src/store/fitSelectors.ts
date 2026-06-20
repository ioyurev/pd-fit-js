/**
 * Derived state — selectors.
 * SSOT: production data вычисляется, а не хранится как отдельная истина.
 */

import { state } from '@/store/fitStore';
import { paramsToPhysical } from '@/lib/fitAdapter';
import { buildGlobalLiquidusProfile } from '@/lib/liquidusSolver';
import { buildIsomorphousProfile } from '@/lib/isomorphousSolver';

export interface LiquidusRow {
  xB: number;
  T_liq: number;
  phaseId: string;
}

/** Вычислить вес из sigma. SSOT — единственный источник этого знания. */
export function weightFromSigma(sigma: number): number {
  const s = Math.max(1e-9, sigma);
  return 1 / (s * s);
}

/** Ошибки параметров из ковариационной матрицы */
export function selectParamErrors(): Record<string, number> {
  const { covMatrix, parameters } = state;
  if (!covMatrix || covMatrix.length === 0) return {};

  const errors: Record<string, number> = {};
  const freeParams = parameters.filter(p => !p.fixed);
  freeParams.forEach((p, i) => {
    const row = covMatrix[i];
    const variance = row && row[i] !== undefined ? row[i] : 0;
    errors[p.name] = variance > 0 ? Math.sqrt(variance) : 0;
  });
  return errors;
}

/** Формат chiSq с дельтой от предыдущего запуска */
export function formatChiSqWithDelta(): string {
  const { chiSq, prevChiSq } = state;
  if (prevChiSq === null || prevChiSq === chiSq) return chiSq.toFixed(4);
  const d = chiSq - prevChiSq;
  return `${chiSq.toFixed(4)} (${d >= 0 ? '+' : ''}${d.toFixed(4)})`;
}

/** Формат Rwp с дельтой от предыдущего запуска */
export function formatRwpWithDelta(): string {
  const { rwpVal, prevRwpVal } = state;
  const r = rwpVal * 100;
  if (prevRwpVal === null || prevRwpVal === rwpVal) return `${r.toFixed(4)}%`;
  const d = r - (prevRwpVal * 100);
  return `${r.toFixed(4)}% (${d >= 0 ? '+' : ''}${d.toFixed(4)}%)`;
}

/** Таблица ликвидуса для экспорта */
export function getLiquidusTableData(steps = 200): LiquidusRow[] {
  const { parameters, systemType } = state;
  const { compA, compB, compounds, Lv_H, Lv_S, Lv_H_sol, Lv_S_sol } = paramsToPhysical(parameters);

  if (systemType === 'isomorphous') {
    const profile = buildIsomorphousProfile(compA, compB, Lv_H, Lv_S, Lv_H_sol, Lv_S_sol, steps);
    return profile.points.map(p => ({ xB: p.xB_liq, T_liq: p.T, phaseId: 'liq' }));
  }

  const profile = buildGlobalLiquidusProfile(compA, compB, compounds, Lv_H, Lv_S, steps);
  return profile.map(p => ({ xB: p.xB, T_liq: p.T, phaseId: p.phaseId }));
}
