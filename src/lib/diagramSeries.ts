/**
 * Построитель dataset'ов для DiagramPlot.
 * SRP: только подготовка данных для Chart.js, без рендера.
 */

import type { FitParameter } from '@/lib/fitAdapter';
import { paramsToPhysical } from '@/lib/fitAdapter';
import {
  buildGlobalLiquidusProfile,
  determineInvariantType,
  getInvariantDisplaySpan,
  getPhaseCompositionX,
  evaluatePhaseLiquidusT,
  findInvariantPointDetailed,
} from '@/lib/liquidusSolver';
import type { LiquidusProfilePoint } from '@/lib/liquidusSolver';
import { buildIsomorphousProfile } from '@/lib/isomorphousSolver';
import type { BranchDef } from '@/lib/types';
import { phaseColor } from '@/lib/chartTheme';
import { getCompoundIds, resolvePhaseDisplayName } from '@/lib/parameterSchema';

interface DataPoint {
  xB: number;
  T: number;
  sigma: number;
  branch: BranchDef;
}

/**
 * Находит состав xB, при котором ликвидус фазы phaseId пересекает температуру T_target.
 * Использует линейную интерполяцию между соседними точками профиля.
 *
 * Для компонента A: ищем слева направо, ликвидус падает → ищем переход T >= T_target → T < T_target.
 * Для компонента B: ищем справа налево, ликвидус падает → ищем переход T >= T_target → T < T_target.
 *
 * Возвращает null если пересечение не найдено (переход выше или ниже всей ветви).
 */
function findTransitionIntersection(
  profile: LiquidusProfilePoint[],
  phaseId: string,
  T_target: number,
  fromRight: boolean,
): number | null {
  if (fromRight) {
    for (let i = profile.length - 1; i > 0; i--) {
      const cur = profile[i];
      const prev = profile[i - 1];

      if (cur.phaseId !== phaseId && prev.phaseId !== phaseId) continue;

      if (cur.T >= T_target && prev.T < T_target) {
        const t1 = cur.T, x1 = cur.xB;
        const t2 = prev.T, x2 = prev.xB;
        return x1 + (T_target - t1) * (x2 - x1) / (t2 - t1);
      }
      if (prev.T >= T_target && cur.T < T_target) {
        const t1 = prev.T, x1 = prev.xB;
        const t2 = cur.T, x2 = cur.xB;
        return x1 + (T_target - t1) * (x2 - x1) / (t2 - t1);
      }
    }
  } else {
    for (let i = 0; i < profile.length - 1; i++) {
      const cur = profile[i];
      const next = profile[i + 1];

      if (cur.phaseId !== phaseId && next.phaseId !== phaseId) continue;

      if (cur.T >= T_target && next.T < T_target) {
        const t1 = cur.T, x1 = cur.xB;
        const t2 = next.T, x2 = next.xB;
        return x1 + (T_target - t1) * (x2 - x1) / (t2 - t1);
      }
      if (next.T >= T_target && cur.T < T_target) {
        const t1 = next.T, x1 = next.xB;
        const t2 = cur.T, x2 = cur.xB;
        return x1 + (T_target - t1) * (x2 - x1) / (t2 - t1);
      }
    }
  }

  return null;
}

const PROFILE_STEPS_DIAGRAM = 2000;
const FULL_BRANCH_STEPS = 200;

function interpolateProfileTemperature(
  profile: LiquidusProfilePoint[],
  xTarget: number,
): number {
  if (profile.length === 0) return NaN;

  if (xTarget <= profile[0].xB) return profile[0].T;
  if (xTarget >= profile[profile.length - 1].xB) return profile[profile.length - 1].T;

  for (let i = 0; i < profile.length - 1; i++) {
    const left = profile[i];
    const right = profile[i + 1];

    if (xTarget < left.xB || xTarget > right.xB) continue;
    if (!Number.isFinite(left.T) || !Number.isFinite(right.T)) return NaN;

    const dx = right.xB - left.xB;
    if (Math.abs(dx) < 1e-12) {
      return Math.max(left.T, right.T);
    }

    const t = (xTarget - left.xB) / dx;
    return left.T + t * (right.T - left.T);
  }

  return NaN;
}

function segmentSpansX(
  seg: { pts: { x: number; y: number }[] },
  x: number,
  tol = 1e-6,
): boolean {
  const firstX = seg.pts[0]?.x;
  const lastX = seg.pts[seg.pts.length - 1]?.x;

  if (!Number.isFinite(firstX) || !Number.isFinite(lastX)) return false;

  const minX = Math.min(firstX, lastX);
  const maxX = Math.max(firstX, lastX);

  return x >= minX - tol && x <= maxX + tol;
}

function buildOrderedSolidPhaseIds(
  compounds: Array<{ id: string; stoichB: number }>,
): string[] {
  const orderedCompounds = [...compounds]
    .sort((a, b) => a.stoichB - b.stoichB)
    .map(c => c.id);

  return ['A', ...orderedCompounds, 'B'];
}

function getNeighborPhaseIds(
  phaseId: string,
  orderedPhaseIds: string[],
): string[] {
  const idx = orderedPhaseIds.indexOf(phaseId);
  if (idx < 0) return [];

  const neighbors: string[] = [];
  if (idx > 0) neighbors.push(orderedPhaseIds[idx - 1]);
  if (idx < orderedPhaseIds.length - 1) neighbors.push(orderedPhaseIds[idx + 1]);

  return neighbors;
}

function deriveVisibleTemperatureFloor(
  profile: LiquidusProfilePoint[],
  dataPoints: DataPoint[],
): number {
  const temps = [
    ...profile.map(p => p.T),
    ...dataPoints.map(p => p.T),
  ].filter((t): t is number => Number.isFinite(t) && t > 0);

  if (temps.length === 0) return 0;

  const minT = Math.min(...temps);
  const maxT = Math.max(...temps);
  const range = Math.max(1, maxT - minT);

  const pad = Math.min(120, Math.max(20, range * 0.08));

  return Math.max(0, minT - pad);
}

export function buildDiagramDatasets(
  dataPoints: DataPoint[],
  parameters: FitParameter[],
  systemType: 'eutectic' | 'isomorphous',
  compAName: string,
  compBName: string,
  compoundNames: Record<string, string> = {},
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
  const profile = buildGlobalLiquidusProfile(
    compA,
    compB,
    compounds,
    Lv_H,
    Lv_S,
    PROFILE_STEPS_DIAGRAM,
  );

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

  const visibleTempFloor = deriveVisibleTemperatureFloor(profile, dataPoints);

  const phaseLabel = (id: string) =>
    resolvePhaseDisplayName(id, compAName, compBName, compoundNames);

  // ── Полные ветви каждой фазы (пунктирные, на всём [0, 1]) ──
  const allPhaseIds = ['A', 'B', ...compoundIds];

  const fullBranchDatasets = allPhaseIds
    .map(phaseId => {
      const pts: { x: number; y: number }[] = [];

      for (let i = 1; i < FULL_BRANCH_STEPS; i++) {
        const xB = i / FULL_BRANCH_STEPS;
        const T = evaluatePhaseLiquidusT(
          xB, phaseId, compA, compB, compounds, Lv_H, Lv_S,
        );
        if (Number.isFinite(T) && T > 0) {
          pts.push({ x: xB, y: T });
        }
      }

      return {
        label: `${phaseLabel(phaseId)} (метастаб.)`,
        data: pts,
        borderColor: phaseColor(phaseId, compoundIds, 0.3),
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
        type: 'line' as const,
        pdLegend: false,
      };
    })
    .filter(ds => ds.data.length > 1);

  const liquidusDatasets = segments.map(seg => ({
    label: `Liq ${phaseLabel(seg.phaseId)}`,
    data: seg.pts,
    borderColor: phaseColor(seg.phaseId, compoundIds),
    borderWidth: 2,
    pointRadius: 0,
    fill: false,
    type: 'line' as const,
  }));

  const invariantDatasets: any[] = [];
  const seenInvariantKeys = new Set<string>();
  const validInvariants: Array<{ phases: [string, string]; T: number }> = [];

  for (let i = 0; i < segments.length - 1; i++) {
    const left = segments[i];
    const right = segments[i + 1];

    const breakPoint =
      right.pts[0] ??
      left.pts[left.pts.length - 1];

    if (!breakPoint || !Number.isFinite(breakPoint.x) || !Number.isFinite(breakPoint.y)) {
      continue;
    }

    const key = `${left.phaseId}|${right.phaseId}|${breakPoint.x.toFixed(4)}|${breakPoint.y.toFixed(3)}`;
    if (seenInvariantKeys.has(key)) continue;
    seenInvariantKeys.add(key);

    const phases: [string, string] = [left.phaseId, right.phaseId];

    validInvariants.push({
      phases,
      T: breakPoint.y,
    });

    const invType = determineInvariantType(
      breakPoint.x,
      phases,
      compounds,
    );
    const labelPrefix = invType === 'peritectic' ? 'Перитектика' : 'Эвтектика';
    const { xLeft, xRight } = getInvariantDisplaySpan(
      breakPoint.x,
      phases,
      compounds,
    );

    invariantDatasets.push({
      label: `${labelPrefix} ${phaseLabel(left.phaseId)}–${phaseLabel(right.phaseId)}`,
      data: [{ x: xLeft, y: breakPoint.y }, { x: xRight, y: breakPoint.y }],
      borderColor:
        invType === 'peritectic'
          ? 'rgba(230, 126, 34, 0.8)'
          : 'rgba(231, 76, 60, 0.7)',
      borderWidth: 1.5,
      borderDash: [],
      pointRadius: 0,
      fill: false,
      type: 'line' as const,
      pdLegend: false,
    });
  }

  const orderedSolidPhaseIds = buildOrderedSolidPhaseIds(compounds);

  const exactPairInvariantTopByCompound = new Map<string, number>();

  for (const c of compounds) {
    const neighborIds = getNeighborPhaseIds(c.id, orderedSolidPhaseIds);

    const exactTemps = neighborIds
      .map(neighborId =>
        findInvariantPointDetailed(
          [c.id, neighborId],
          compA,
          compB,
          compounds,
          Lv_H,
          Lv_S,
        ),
      )
      .filter(inv => inv.kind === 'intersection' && Number.isFinite(inv.T) && inv.T > 0)
      .map(inv => inv.T);

    if (exactTemps.length > 0) {
      exactPairInvariantTopByCompound.set(c.id, Math.max(...exactTemps));
    }
  }

  const compoundDatasets: any[] = [];

  for (const c of compounds) {
    const x = getPhaseCompositionX(c.id, compounds, c.stoichB);

    const ownSegments = segments.filter(seg => seg.phaseId === c.id);
    const isCongruent = ownSegments.some(seg => segmentSpansX(seg, x));

    let topT = NaN;

    if (isCongruent) {
      topT = interpolateProfileTemperature(profile, x);
    } else {
      topT = exactPairInvariantTopByCompound.get(c.id) ?? NaN;
    }

    if (!Number.isFinite(topT) || topT <= visibleTempFloor) {
      continue;
    }

    compoundDatasets.push({
      label: `Стехиометрия ${phaseLabel(c.id)}`,
      data: [{ x, y: visibleTempFloor }, { x, y: topT }],
      borderColor: phaseColor(c.id, compoundIds, 0.8),
      borderWidth: 1.5,
      borderDash: [],
      pointRadius: 0,
      fill: false,
      type: 'line' as const,
      pdLegend: false,
    });
  }

  const transitionDatasets: any[] = [];

  for (const [idx, trans] of compA.transitions.entries()) {
    if (trans.T <= 0) continue;

    const xIntersect = findTransitionIntersection(profile, 'A', trans.T, false);
    const xEnd = xIntersect ?? 0.5;

    transitionDatasets.push({
      label: `Переход ${compAName} (${idx + 1})`,
      data: [{ x: 0, y: trans.T }, { x: xEnd, y: trans.T }],
      borderColor: 'rgba(54, 162, 235, 0.5)', borderWidth: 1.5,
      borderDash: [5, 3], pointRadius: 0, fill: false, type: 'line' as const,
      pdLegend: false,
    });
  }

  for (const [idx, trans] of compB.transitions.entries()) {
    if (trans.T <= 0) continue;

    const xIntersect = findTransitionIntersection(profile, 'B', trans.T, true);
    const xStart = xIntersect ?? 0.5;

    transitionDatasets.push({
      label: `Переход ${compBName} (${idx + 1})`,
      data: [{ x: xStart, y: trans.T }, { x: 1, y: trans.T }],
      borderColor: 'rgba(75, 192, 192, 0.5)', borderWidth: 1.5,
      borderDash: [5, 3], pointRadius: 0, fill: false, type: 'line' as const,
      pdLegend: false,
    });
  }

  const expPointsLiq = dataPoints
    .filter(p => p.branch.type !== 'invariant')
    .map(p => ({ x: p.xB, y: p.T }));

  const expPointsInv = dataPoints
    .filter(p => p.branch.type === 'invariant')
    .map(p => ({ x: p.xB, y: p.T }));

  // yMin: 10% ниже диапазона стабильного ликвидуса + эксперимента
  const stableTemps = [
    ...profile.filter(p => Number.isFinite(p.T) && p.T > 0).map(p => p.T),
    ...dataPoints.map(p => p.T),
  ].filter(Number.isFinite);

  let yMin: number | undefined;
  if (stableTemps.length > 0) {
    const minT = Math.min(...stableTemps);
    const maxT = Math.max(...stableTemps);
    const range = Math.max(1, maxT - minT);
    yMin = Math.max(0, minT - range * 0.1);
  }

  return {
    yMin,
    datasets: [
      ...fullBranchDatasets,
      ...compoundDatasets,
      ...liquidusDatasets,
      ...invariantDatasets,
      ...transitionDatasets,
      {
        label: 'Эксперимент (Ликвидус)',
        data: expPointsLiq,
        backgroundColor: 'rgba(255, 99, 132, 1)',
        type: 'scatter' as const,
        order: 0,
      },
      {
        label: 'Эксперимент (Инварианты)',
        data: expPointsInv,
        backgroundColor: 'rgba(46, 204, 113, 1)',
        pointStyle: 'rectRot',
        pointRadius: 6,
        type: 'scatter' as const,
        order: 0,
      },
    ],
  };
}
