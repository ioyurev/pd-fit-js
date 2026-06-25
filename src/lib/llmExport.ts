/**
 * Модуль форматирования данных для экспорта в LLM.
 * SRP: только сериализация текущего состояния в Markdown.
 */

import type { FitParameter } from '@/lib/fitAdapter';
import type { BranchDef } from '@/lib/types';
import { formatBranchLabel } from '@/lib/branchCatalog';
import type { TempUnit } from '@/lib/temperatureUnits';
import { toDisplay, unitLabel } from '@/lib/temperatureUnits';

export interface LLMDataPoint {
  xB: number;
  T: number;
  sigma: number;
  branch: BranchDef;
}

export function formatLLMText(
  dataPoints: LLMDataPoint[],
  parameters: FitParameter[],
  chiSq: number,
  rwpVal: number,
  corrWarnings: string[],
  unit: TempUnit = 'K',
  residuals: number[] = [],
): string {
  let md = `### CURRENT FIT METRICS
- Chi-Squared (chiSq): ${chiSq.toFixed(6)}
- Rwp (Weighted Profile R-factor): ${(rwpVal * 100).toFixed(4)}%
- Active High Correlations Warning Count: ${corrWarnings.length}
`;

  if (corrWarnings.length > 0) {
    corrWarnings.forEach(w => { md += `  - ${w}\n`; });
  }

  md += `\n\n### THERMODYNAMIC PARAMETERS
| Parameter | Value | Status | Bounds | Min | Max |
| :--- | :--- | :--- | :--- | :--- | :--- |
`;

  parameters.forEach(p => {
    const valStr = Number.isFinite(p.value) ? p.value.toFixed(6) : '—';
    const boundsStr = p.fixed ? '—' : (p.boundsEnabled ? 'ON' : 'OFF');
    const minStr = Number.isFinite(p.min) ? p.min.toFixed(2) : '—';
    const maxStr = Number.isFinite(p.max) ? p.max.toFixed(2) : '—';
    md += `| ${p.name} | ${valStr} | ${p.fixed ? 'FIXED' : 'FREE'} | ${boundsStr} | ${minStr} | ${maxStr} |\n`;
  });

  md += `
### EXPERIMENTAL DATA POINTS
| # | xB | T_obs (${unitLabel(unit)}) | σ | w | ΔT | Branch |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
`;

  dataPoints.forEach((p, idx) => {
    const w = 1 / (p.sigma * p.sigma);
    const r = residuals[idx];
    const rStr = Number.isFinite(r) ? r.toFixed(2) : '—';
    md += `| ${idx + 1} | ${p.xB.toFixed(4)} | ${toDisplay(p.T, unit).toFixed(2)} | ${p.sigma.toFixed(2)} | ${w.toFixed(4)} | ${rStr} | ${formatBranchLabel(p.branch)} |\n`;
  });

  return md;
}
