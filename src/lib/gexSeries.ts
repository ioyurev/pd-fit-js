/**
 * Построитель dataset'ов для GExPlot.
 * SRP: только вычисление серий GEx, без рендера.
 */

import type { FitParameter } from '@/lib/fitAdapter';
import { paramsToPhysical } from '@/lib/fitAdapter';
import { gExcess, partialExcessA, partialExcessB } from '@/lib/redlichKister';
import { calculateErrorPropagation } from '@/lib/statistics';
import { R, schroederRHS } from '@/lib/thermodynamics';
import type { BranchDef } from '@/lib/types';

interface DataPoint {
  xB: number;
  T: number;
  sigma: number;
  branch: BranchDef;
}

export function buildGExDatasets(
  dataPoints: DataPoint[],
  parameters: FitParameter[],
  covMatrix: number[][],
) {
  const { compA, compB, Lv_H, Lv_S, Lv_H_sol, Lv_S_sol } = paramsToPhysical(parameters);

  const T_ref = (compA.Tfus + compB.Tfus) / 2;

  const steps = 100;
  const lineLiq: { x: number; y: number }[] = [];
  const lineSol: { x: number; y: number }[] = [];
  const bandLiqUpper: { x: number; y: number }[] = [];
  const bandLiqLower: { x: number; y: number }[] = [];
  const bandSolUpper: { x: number; y: number }[] = [];
  const bandSolLower: { x: number; y: number }[] = [];

  for (let i = 0; i <= steps; i++) {
    const xB = i / steps;
    const xA = 1 - xB;
    const gex_liq = gExcess(xA, Lv_H) - T_ref * gExcess(xA, Lv_S);
    const gex_sol = gExcess(xA, Lv_H_sol) - T_ref * gExcess(xA, Lv_S_sol);

    lineLiq.push({ x: xB, y: gex_liq });
    lineSol.push({ x: xB, y: gex_sol });

    const errLiq = calculateErrorPropagation(
      (ps: FitParameter[]) => {
        const pPhys = paramsToPhysical(ps);
        return gExcess(xA, pPhys.Lv_H) - T_ref * gExcess(xA, pPhys.Lv_S);
      },
      parameters, covMatrix,
    );
    bandLiqUpper.push({ x: xB, y: gex_liq + 2 * errLiq });
    bandLiqLower.push({ x: xB, y: gex_liq - 2 * errLiq });

    const errSol = calculateErrorPropagation(
      (ps: FitParameter[]) => {
        const pPhys = paramsToPhysical(ps);
        return gExcess(xA, pPhys.Lv_H_sol) - T_ref * gExcess(xA, pPhys.Lv_S_sol);
      },
      parameters, covMatrix,
    );
    bandSolUpper.push({ x: xB, y: gex_sol + 2 * errSol });
    bandSolLower.push({ x: xB, y: gex_sol - 2 * errSol });
  }

  // Экспериментальные точки
  const expLiq: { x: number; y: number }[] = [];
  const expSol: { x: number; y: number }[] = [];

  dataPoints.forEach(p => {
    if (p.branch.type === 'invariant' || p.branch.type === 'transition') return;

    const xA = 1 - p.xB;
    let isA = p.xB < 0.5;
    if (p.branch.type === 'pure') isA = p.branch.comp === 'A';

    const x_solv = isA ? xA : p.xB;
    const comp = isA ? compA : compB;
    const rhs = schroederRHS(p.T, comp);

    if (p.branch.type === 'pure' || (p.branch.type === 'lens' && p.branch.curve === 'liquidus')) {
      const g_part_exp = R * p.T * rhs - R * p.T * Math.log(x_solv);
      const g_part_mod = isA
        ? partialExcessA(xA, Lv_H) - T_ref * partialExcessA(xA, Lv_S)
        : partialExcessB(xA, Lv_H) - T_ref * partialExcessB(xA, Lv_S);
      const g_int_mod = gExcess(xA, Lv_H) - T_ref * gExcess(xA, Lv_S);

      let g_int_exp = g_int_mod;
      if (Math.abs(g_part_mod) > 1e-3) {
        g_int_exp = g_part_exp * (g_int_mod / g_part_mod);
      }
      expLiq.push({ x: p.xB, y: g_int_exp });

    } else if (p.branch.type === 'lens' && p.branch.curve === 'solidus') {
      const g_part_exp_sol = -(R * p.T * rhs) - R * p.T * Math.log(x_solv);
      const g_part_mod = isA
        ? partialExcessA(xA, Lv_H_sol) - T_ref * partialExcessA(xA, Lv_S_sol)
        : partialExcessB(xA, Lv_H_sol) - T_ref * partialExcessB(xA, Lv_S_sol);
      const g_int_mod = gExcess(xA, Lv_H_sol) - T_ref * gExcess(xA, Lv_S_sol);

      let g_int_exp = g_int_mod;
      if (Math.abs(g_part_mod) > 1e-3) {
        g_int_exp = g_part_exp_sol * (g_int_mod / g_part_mod);
      }
      expSol.push({ x: p.xB, y: g_int_exp });
    }
  });

  return {
    T_ref,
    datasets: [
      {
        label: 'Эксперимент (Ликвидус)', data: expLiq,
        backgroundColor: '#3498db', borderColor: '#3498db',
        type: 'scatter' as const, pointRadius: 5, order: 0,
      },
      {
        label: 'Эксперимент (Солидус)', data: expSol,
        backgroundColor: '#ff6384', borderColor: '#ff6384',
        pointStyle: 'triangle', type: 'scatter' as const, pointRadius: 6, order: 0,
      },
      {
        label: '+2σ Liq', data: bandLiqUpper,
        borderColor: 'transparent', pointRadius: 0, fill: false, type: 'line' as const,
      },
      {
        label: '-2σ Liq', data: bandLiqLower,
        borderColor: 'transparent', pointRadius: 0,
        backgroundColor: 'rgba(54, 162, 235, 0.15)', fill: '-1', type: 'line' as const,
      },
      {
        label: '+2σ Sol', data: bandSolUpper,
        borderColor: 'transparent', pointRadius: 0, fill: false, type: 'line' as const,
      },
      {
        label: '-2σ Sol', data: bandSolLower,
        borderColor: 'transparent', pointRadius: 0,
        backgroundColor: 'rgba(255, 99, 132, 0.15)', fill: '-1', type: 'line' as const,
      },
      {
        label: 'Gex Liquid', data: lineLiq,
        borderColor: 'rgba(54, 162, 235, 0.8)', borderWidth: 2,
        pointRadius: 0, tension: 0.15, fill: false, type: 'line' as const, order: 1,
      },
      {
        label: 'Gex Solid', data: lineSol,
        borderColor: 'rgba(255, 99, 132, 0.8)', borderWidth: 2,
        pointRadius: 0, tension: 0.15, fill: false, type: 'line' as const, order: 1,
      },
    ],
  };
}
