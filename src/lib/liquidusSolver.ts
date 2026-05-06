import { R } from './thermodynamics';
import type { PureComponent } from './thermodynamics';
import { partialExcessA, partialExcessB } from './redlichKister';

export type Branch = string;

// АНАЛИТИЧЕСКОЕ РЕШЕНИЕ
function getTAnalytical(xSolvent: number, comp: PureComponent, GexH: number, GexS: number): number {
  if (xSolvent <= 0) return 0;
  if (xSolvent >= 1) return comp.Tfus;

  const sortedTrans = [...comp.transitions].sort((a, b) => b.T - a.T);
  
  let dHeff = comp.dHfus;
  let dSeff = comp.dHfus / comp.Tfus;

  // Формула: T = (dH + GexH) / (dS - R*ln(x) + GexS)
  let T = (dHeff + GexH) / (dSeff - R * Math.log(xSolvent) + GexS);

  // Учет полиморфных переходов по закону Гесса
  for (const trans of sortedTrans) {
    if (trans.T > 0 && T <= trans.T) {
      dHeff += trans.dH;
      dSeff += trans.dH / trans.T;
      T = (dHeff + GexH) / (dSeff - R * Math.log(xSolvent) + GexS);
    }
  }
  
  return T;
}

export function calcTLiquidus(
  xB: number,
  branch: Branch,
  compA: PureComponent,
  compB: PureComponent,
  Lv_H: number[],
  Lv_S: number[]
): number {
  if (branch === 'eutectic') {
    return findEutectic(compA, compB, Lv_H, Lv_S).T;
  }
  if (branch.startsWith('Ttrans_A_')) {
    const t = compA.transitions.find(trans => trans.id === branch);
    return t ? t.T : 0;
  }
  if (branch.startsWith('Ttrans_B_')) {
    const t = compB.transitions.find(trans => trans.id === branch);
    return t ? t.T : 0;
  }

  const xA = 1 - xB;

  if (branch === 'A') {
    const GexH = partialExcessA(xA, Lv_H);
    const GexS = partialExcessA(xA, Lv_S);
    return getTAnalytical(xA, compA, GexH, GexS);
  } else {
    const GexH = partialExcessB(xA, Lv_H);
    const GexS = partialExcessB(xA, Lv_S);
    return getTAnalytical(xB, compB, GexH, GexS);
  }
}

// Универсальный поиск эвтектики сканированием сетки (надежно при расслаивании)
export function findEutectic(compA: PureComponent, compB: PureComponent, Lv_H: number[], Lv_S: number[]): { xB: number, T: number } {
  let minT = Infinity;
  let bestX = 0.5;
  
  // 2000 точек гарантируют точность до 0.0005. Работает за доли миллисекунды.
  for (let i = 0; i <= 2000; i++) {
    const xB = i / 2000;
    const Ta = calcTLiquidus(xB, 'A', compA, compB, Lv_H, Lv_S);
    const Tb = calcTLiquidus(xB, 'B', compA, compB, Lv_H, Lv_S);
    
    const Tsys = Math.max(Ta, Tb);
    if (Tsys < minT) {
      minT = Tsys;
      bestX = xB;
    }
  }
  return { xB: bestX, T: minT };
}

export function calcAllTLiquidus(
  points: Array<{ xB: number; branch: Branch }>,
  compA: PureComponent,
  compB: PureComponent,
  Lv_H: number[],
  Lv_S: number[],
): number[] {
  return points.map(p => calcTLiquidus(p.xB, p.branch, compA, compB, Lv_H, Lv_S));
}