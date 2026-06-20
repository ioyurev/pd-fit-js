/**
 * Модуль форматирования данных для экспорта в LLM.
 * SRP: только сериализация текущего состояния в Markdown.
 */

import type { FitParameter } from '@/lib/fitAdapter';
import type { BranchDef } from '@/lib/types';
import { formatBranchLabel } from '@/lib/branchCatalog';

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
| Parameter | Value | Status | Min | Max |
| :--- | :--- | :--- | :--- | :--- |
`;

  parameters.forEach(p => {
    const valStr = Number.isFinite(p.value) ? p.value.toFixed(6) : '—';
    const minStr = Number.isFinite(p.min) ? p.min.toFixed(2) : '—';
    const maxStr = Number.isFinite(p.max) ? p.max.toFixed(2) : '—';
    md += `| ${p.name} | ${valStr} | ${p.fixed ? 'FIXED' : 'FREE'} | ${minStr} | ${maxStr} |\n`;
  });

  md += `
### EXPERIMENTAL DATA POINTS (INPUTS)
| Point # | xB (Comp) | T_obs (K) | Sigma (σ) | Weight | Branch Type / Phase |
| :--- | :--- | :--- | :--- | :--- | :--- |
`;

  dataPoints.forEach((p, idx) => {
    const w = 1 / (p.sigma * p.sigma);
    md += `| ${idx + 1} | ${p.xB.toFixed(4)} | ${p.T.toFixed(2)} | ${p.sigma.toFixed(2)} | ${w.toFixed(4)} | ${formatBranchLabel(p.branch)} |\n`;
  });

  return md;
}
