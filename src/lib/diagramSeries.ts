/**
 * Построитель dataset'ов для DiagramPlot.
 * SRP: только подготовка данных для Chart.js, без рендера.
 */

import type { FitParameter } from '@/lib/fitAdapter';
import { paramsToPhysical } from '@/lib/fitAdapter';
import { buildGlobalLiquidusProfile, findInvariantPoint } from '@/lib/liquidusSolver';
import { buildIsomorphousProfile } from '@/lib/isomorphousSolver';
import { encodeBranch } from '@/lib/types';
import type { BranchDef } from '@/lib/types';
import { phaseColor } from '@/lib/chartTheme';
import { getCompoundIds } from '@/lib/parameterSchema';

interface DataPoint {
  xB: number;
  T: number;
  sigma: number;
  branch: BranchDef;
}

export function buildDiagramDatasets(
  dataPoints: DataPoint[],
  parameters: FitParameter[],
  systemType: 'eutectic' | 'isomorphous',
  compAName: string,
  compBName: string,
) {
  const { compA, compB, compounds, Lv_H, Lv_S, Lv_H_sol, Lv_S_sol } = paramsToPhysical(parameters);
  const compoundIds = getCompoundIds(parameters);

  if (systemType === 'isomorphous') {
    const isoProfile = buildIsomorphousProfile(compA, compB, Lv_H, Lv_S, Lv_H_sol, Lv_S_sol, 150);

    const liquidusPoints = isoProfile.points.map(p => ({ x: p.xB_liq, y: p.T }));
    const solidusPoints = isoProfile.points.map(p => ({ x: p.xB_sol, y: p.T }));

    const expPointsLiq = dataPoints
      .filter(p => p.branch.type === 'lens' && p.branch.curve === 'liquidus')
      .map(p => ({ x: p.xB, y: p.T }));
    const expPointsSol = dataPoints
      .filter(p => p.branch.type === 'lens' && p.branch.curve === 'solidus')
      .map(p => ({ x: p.xB, y: p.T }));

    return {
      datasets: [
        {
          label: 'Эксперимент (Ликвидус)', data: expPointsLiq,
          backgroundColor: 'rgba(54, 162, 235, 1)', borderColor: 'rgba(54, 162, 235, 1)',
          pointRadius: 5, type: 'scatter' as const, order: 0,
        },
        {
          label: 'Эксперимент (Солидус)', data: expPointsSol,
          backgroundColor: 'rgba(255, 99, 132, 1)', borderColor: 'rgba(255, 99, 132, 1)',
          pointStyle: 'triangle', pointRadius: 6, type: 'scatter' as const, order: 0,
        },
        {
          label: 'Ликвидус (расчет)', data: liquidusPoints,
          borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 2,
          pointRadius: 0, fill: false, type: 'line' as const,
        },
        {
          label: 'Солидус (расчет)', data: solidusPoints,
          borderColor: 'rgba(255, 99, 132, 1)', borderWidth: 2,
          pointRadius: 0, fill: false, type: 'line' as const,
        },
      ],
    };
  }

  // ── Эвтектика ──
  const profile = buildGlobalLiquidusProfile(compA, compB, compounds, Lv_H, Lv_S, 500);

  type Segment = { phaseId: string; pts: { x: number; y: number }[] };
  const segments: Segment[] = [];

  for (const pt of profile) {
    if (!isFinite(pt.T) || pt.T <= 0) continue;
    const last = segments[segments.length - 1];
    if (last && last.phaseId === pt.phaseId) {
      last.pts.push({ x: pt.xB, y: pt.T });
    } else {
      if (last && last.pts.length > 0) {
        last.pts.push({ x: pt.xB, y: pt.T });
      }
      segments.push({ phaseId: pt.phaseId, pts: [{ x: pt.xB, y: pt.T }] });
    }
  }

  const phaseLabel = (id: string) => {
    if (id === 'A') return compAName;
    if (id === 'B') return compBName;
    return id;
  };

  const liquidusDatasets = segments.map(seg => ({
    label: `Ликвидус ${phaseLabel(seg.phaseId)}`,
    data: seg.pts,
    borderColor: phaseColor(seg.phaseId, compoundIds),
    borderWidth: 2, pointRadius: 0, fill: false, type: 'line' as const,
  }));

  const expPoints = dataPoints.map(p => ({ x: p.xB, y: p.T }));

  const invariantDatasets: any[] = [];
  const seenInv = new Set<string>();

  for (const p of dataPoints) {
    if (p.branch.type !== 'invariant') continue;
    const key = encodeBranch(p.branch);
    if (seenInv.has(key)) continue;
    seenInv.add(key);

    const inv = findInvariantPoint(p.branch.phases, compA, compB, compounds, Lv_H, Lv_S);
    if (!isFinite(inv.T)) continue;

    const phaseXs = p.branch.phases.map(id => {
      if (id === 'A') return 0;
      if (id === 'B') return 1;
      return compounds.find(c => c.id === id)?.stoichB ?? inv.xB;
    });
    const xLeft  = Math.min(...phaseXs);
    const xRight = Math.max(...phaseXs);

    invariantDatasets.push({
      label: `Инв. ${p.branch.phases.join('–')} (${inv.T.toFixed(1)} K)`,
      data: [{ x: xLeft, y: inv.T }, { x: xRight, y: inv.T }],
      borderColor: 'rgba(231, 76, 60, 0.7)', borderWidth: 1.5,
      borderDash: [5, 4], pointRadius: 0, fill: false, type: 'line' as const,
    });
  }

  const transitionDatasets: any[] = [];

  for (const trans of compA.transitions) {
    if (trans.T <= 0) continue;
    transitionDatasets.push({
      label: `Переход ${compAName} (${trans.T.toFixed(0)} K)`,
      data: [{ x: 0, y: trans.T }, { x: 0.5, y: trans.T }],
      borderColor: 'rgba(54, 162, 235, 0.5)', borderWidth: 1,
      borderDash: [3, 3], pointRadius: 0, fill: false, type: 'line' as const,
    });
  }

  for (const trans of compB.transitions) {
    if (trans.T <= 0) continue;
    transitionDatasets.push({
      label: `Переход ${compBName} (${trans.T.toFixed(0)} K)`,
      data: [{ x: 0.5, y: trans.T }, { x: 1, y: trans.T }],
      borderColor: 'rgba(75, 192, 192, 0.5)', borderWidth: 1,
      borderDash: [3, 3], pointRadius: 0, fill: false, type: 'line' as const,
    });
  }

  return {
    datasets: [
      {
        label: 'Эксперимент', data: expPoints,
        backgroundColor: 'rgba(255, 99, 132, 1)', type: 'scatter' as const, order: 0,
      },
      ...liquidusDatasets,
      ...invariantDatasets,
      ...transitionDatasets,
    ],
  };
}
