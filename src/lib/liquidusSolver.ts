import { R } from '@/lib/thermodynamics';
import type { PureComponent } from '@/lib/thermodynamics';
import type { BranchDef, Compound } from '@/lib/types';
import {
  partialExcessA,
  partialExcessB,
  gExcess,
} from '@/lib/redlichKister';
import { buildIsomorphousProfile } from '@/lib/isomorphousSolver';
import type { IsomorphousProfile } from '@/lib/isomorphousSolver';

// ─── Чистые компоненты ───────────────────────────────────────────────────────

function getTAnalytical(
  xSolvent: number,
  comp: PureComponent,
  GexH: number,
  GexS: number,
): number {
  if (xSolvent <= 0) return 0;
  if (xSolvent >= 1) return comp.Tfus;

  const sortedTrans = [...comp.transitions].sort((a, b) => b.T - a.T);

  const solveT = () => {
    const den = dSeff - R * Math.log(xSolvent) + GexS;
    if (!Number.isFinite(den) || Math.abs(den) < 1e-12) return NaN;

    const T = (dHeff + GexH) / den;
    return Number.isFinite(T) && T > 0 ? T : NaN;
  };

  let dHeff = comp.dHfus;
  let dSeff = comp.dHfus / comp.Tfus;

  let T = solveT();

  for (const trans of sortedTrans) {
    if (trans.T > 0 && Number.isFinite(T) && T <= trans.T) {
      dHeff += trans.dH;
      dSeff += trans.dH / trans.T;
      T = solveT();
    }
  }

  return T;
}

// ─── Соединение ──────────────────────────────────────────────────────────────

/**
 * Аналитическая температура ликвидуса соединения A_{1-xc}B_{xc}.
 *
 * Вывод:
 *   Условие равновесия: ΔG_fus,c(T) = 0 при xB ≠ xc,
 *   что после разделения избыточных функций на H- и S-части даёт:
 *
 *     T = num / den
 *
 *   где нормировка выполнена в точке xc, чтобы кривая
 *   гарантированно проходила через (xc, Tc) при любых Lv.
 *
 * Проверка: при xB = xc логарифм = ln(1) = 0,
 *   парциальные функции свёртываются в интегральные,
 *   и T = dHc / (dHc/Tc) = Tc ✓
 */
export function getTAnalyticalCompound(
  xB: number,
  compound: Compound,
  Lv_H: number[],
  Lv_S: number[],
): number {
  const { stoichB: xc, Tfus: Tc, dHfus: dHc } = compound;

  if (xB <= 0 || xB >= 1) return 0;
  // Защита от вырожденных стехиометрий
  if (xc <= 0 || xc >= 1) return 0;

  const xA  = 1 - xB;
  const xAc = 1 - xc;

  // ── Нормировочные величины в точке стехиометрии xc ──────────────────────
  // Интегральные избыточные функции (через gExcess, первый аргумент — xA компонента)
  const Hex_c = gExcess(xAc, Lv_H);
  const Sex_c = gExcess(xAc, Lv_S);

  // ── Парциальные вклады в текущей точке xB ───────────────────────────────
  const Hex_A = partialExcessA(xA, Lv_H);
  const Hex_B = partialExcessB(xA, Lv_H);
  const Sex_A = partialExcessA(xA, Lv_S);
  const Sex_B = partialExcessB(xA, Lv_S);

  // Логарифмический член: ln[ xA^{xAc} · xB^{xc} / (xAc^{xAc} · xc^{xc}) ]
  // = (xAc)·ln(xA/xAc) + (xc)·ln(xB/xc)
  // Форма через разности устойчивее численно при xB → xc
  const logTerm =
    xAc * Math.log(xA / xAc) + xc * Math.log(xB / xc);

  const num = dHc - Hex_c + xAc * Hex_A + xc * Hex_B;
  const den = dHc / Tc - Sex_c + R * logTerm + xAc * Sex_A + xc * Sex_B;

  if (!Number.isFinite(num) || !Number.isFinite(den) || Math.abs(den) < 1e-12) {
    return NaN;
  }

  const T = num / den;
  return Number.isFinite(T) && T > 0 ? T : NaN;
}

// ─── Диспетчер ───────────────────────────────────────────────────────────────

export function calcTForBranch(
  xB: number,
  branch: BranchDef,
  compA: PureComponent,
  compB: PureComponent,
  compounds: Compound[],
  Lv_H: number[],
  Lv_S: number[],
  Lv_H_sol: number[] = [],
  Lv_S_sol: number[] = [],
  cachedProfile?: IsomorphousProfile
): number {
  switch (branch.type) {
    case 'pure': {
      if (branch.comp === 'A') {
        const GexH = partialExcessA(1 - xB, Lv_H);
        const GexS = partialExcessA(1 - xB, Lv_S);
        return getTAnalytical(1 - xB, compA, GexH, GexS);
      } else {
        const GexH = partialExcessB(1 - xB, Lv_H);
        const GexS = partialExcessB(1 - xB, Lv_S);
        return getTAnalytical(xB, compB, GexH, GexS);
      }
    }

    case 'compound': {
      const c = compounds.find(x => x.id === branch.id);
      if (!c) return 0;
      return getTAnalyticalCompound(xB, c, Lv_H, Lv_S);
    }

    case 'transition': {
      const comp = branch.comp === 'A' ? compA : compB;
      const trans = comp.transitions.find(t => t.id === `Ttrans_${branch.comp}_${branch.index}`);
      return trans ? trans.T : 0;
    }

    case 'invariant': {
      return findInvariantPoint(branch.phases, compA, compB, compounds, Lv_H, Lv_S).T;
    }

    case 'lens': {
      const profile = cachedProfile || buildIsomorphousProfile(compA, compB, Lv_H, Lv_S, Lv_H_sol, Lv_S_sol);
      const spline = branch.curve === 'liquidus' ? profile.liquidusSpline : profile.solidusSpline;
      return spline.interpolate(xB);
    }
  }
}

// ─── Глобальный профиль ликвидуса ────────────────────────────────────────────

export interface LiquidusProfilePoint {
  xB: number;
  T: number;
  phaseId: string; // 'A' | 'B' | 'C1' | …
}

/**
 * Строит глобальный профиль ликвидуса за ОДИН проход O(steps).
 * Стабильная фаза = фаза с максимальной температурой ликвидуса.
 * Из профиля извлекаются все инвариантные точки (смена phaseId).
 */
export function buildGlobalLiquidusProfile(
  compA: PureComponent,
  compB: PureComponent,
  compounds: Compound[],
  Lv_H: number[],
  Lv_S: number[],
  steps = 2000,
): LiquidusProfilePoint[] {
  const profile: LiquidusProfilePoint[] = [];

  for (let i = 0; i <= steps; i++) {
    const xB = i / steps;
    const xA = 1 - xB;

    const candidates: { id: string; T: number }[] = [
      {
        id: 'A',
        T: getTAnalytical(
          xA,
          compA,
          partialExcessA(xA, Lv_H),
          partialExcessA(xA, Lv_S),
        ),
      },
      {
        id: 'B',
        T: getTAnalytical(
          xB,
          compB,
          partialExcessB(xA, Lv_H),
          partialExcessB(xA, Lv_S),
        ),
      },
      ...compounds.map(c => ({
        id: c.id,
        T: getTAnalyticalCompound(xB, c, Lv_H, Lv_S),
      })),
    ];

    // Стабильная фаза — максимум температуры ликвидуса
    const stable = candidates.reduce((best, cur) =>
      isFinite(cur.T) && cur.T > best.T ? cur : best,
    );

    profile.push({ xB, T: stable.T, phaseId: stable.id });
  }

  return profile;
}

/**
 * Находит инвариантную точку (эвтектику / перитектику)
 * пересечения набора фаз `phaseIds` — как минимум T на огибающей
 * именно этих фаз. O(steps).
 */
export function findInvariantPoint(
  phaseIds: string[],
  compA: PureComponent,
  compB: PureComponent,
  compounds: Compound[],
  Lv_H: number[],
  Lv_S: number[],
  steps = 2000,
): { xB: number; T: number } {
  let minT = Infinity;
  let bestX = 0.5;

  for (let i = 0; i <= steps; i++) {
    const xB = i / steps;
    const xA = 1 - xB;

    let maxT = -Infinity;
    for (const id of phaseIds) {
      let T: number;
      if (id === 'A') {
        T = getTAnalytical(xA, compA, partialExcessA(xA, Lv_H), partialExcessA(xA, Lv_S));
      } else if (id === 'B') {
        T = getTAnalytical(xB, compB, partialExcessB(xA, Lv_H), partialExcessB(xA, Lv_S));
      } else {
        const c = compounds.find(x => x.id === id);
        T = c ? getTAnalyticalCompound(xB, c, Lv_H, Lv_S) : -Infinity;
      }
      if (isFinite(T) && T > maxT) maxT = T;
    }

    if (maxT < minT) {
      minT = maxT;
      bestX = xB;
    }
  }

  return { xB: bestX, T: minT };
}

// ─── Совместимость с fitAdapter ───────────────────────────────────────────────

/**
 * Обёртка для использования в fitAdapter.
 * Принимает BranchDef вместо строки.
 */
export function calcAllTLiquidus(
  points: Array<{ xB: number; branch: BranchDef }>,
  compA: PureComponent,
  compB: PureComponent,
  compounds: Compound[],
  Lv_H: number[],
  Lv_S: number[],
  Lv_H_sol: number[] = [],
  Lv_S_sol: number[] = []
): number[] {
  let cachedProfile: IsomorphousProfile | undefined = undefined;
  if (points.some(p => p.branch.type === 'lens')) {
    cachedProfile = buildIsomorphousProfile(compA, compB, Lv_H, Lv_S, Lv_H_sol, Lv_S_sol);
  }
  return points.map(p =>
    calcTForBranch(p.xB, p.branch, compA, compB, compounds, Lv_H, Lv_S, Lv_H_sol, Lv_S_sol, cachedProfile),
  );
}

// Обратная совместимость для DiagramPlot (вызывает findEutectic)
export function findEutectic(
  compA: PureComponent,
  compB: PureComponent,
  compounds: Compound[],
  Lv_H: number[],
  Lv_S: number[],
): { xB: number; T: number } {
  return findInvariantPoint(['A', 'B'], compA, compB, compounds, Lv_H, Lv_S);
}
