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
import { bisectBracketed } from '@/lib/numerics';

// ─── Чистые компоненты ───────────────────────────────────────────────────────

function getTAnalytical(
  xSolvent: number,
  comp: PureComponent,
  GexH: number,
  GexS: number,
): number {
  if (xSolvent <= 0) return NaN;
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

  if (xB <= 0 || xB >= 1) return NaN;
  // Защита от вырожденных стехиометрий
  if (xc <= 0 || xc >= 1) return NaN;

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
  // ВНИМАНИЕ: logTerm всегда <= 0. Энтропия смешения увеличивает знаменатель, 
  // поэтому перед R * logTerm должен стоять минус.
  const logTerm =
    xAc * Math.log(xA / xAc) + xc * Math.log(xB / xc);

  const num = dHc - Hex_c + xAc * Hex_A + xc * Hex_B;
  const den = dHc / Tc - Sex_c - R * logTerm + xAc * Sex_A + xc * Sex_B;

  if (!Number.isFinite(num) || !Number.isFinite(den) || Math.abs(den) < 1e-12) {
    return NaN;
  }

  const T = num / den;
  return Number.isFinite(T) && T > 0 ? T : NaN;
}

// ─── Единый helper вычисления T ликвидуса по phaseId ──────────────────────────

export function evaluatePhaseLiquidusT(
  xB: number,
  phaseId: string,
  compA: PureComponent,
  compB: PureComponent,
  compounds: Compound[],
  Lv_H: number[],
  Lv_S: number[],
): number {
  const xA = 1 - xB;

  if (phaseId === 'A') {
    return getTAnalytical(
      xA,
      compA,
      partialExcessA(xA, Lv_H),
      partialExcessA(xA, Lv_S),
    );
  }

  if (phaseId === 'B') {
    return getTAnalytical(
      xB,
      compB,
      partialExcessB(xA, Lv_H),
      partialExcessB(xA, Lv_S),
    );
  }

  const compound = compounds.find(c => c.id === phaseId);
  return compound ? getTAnalyticalCompound(xB, compound, Lv_H, Lv_S) : NaN;
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
      const inv = findInvariantPoint(branch.phases, compA, compB, compounds, Lv_H, Lv_S);
      return Number.isFinite(inv.T) ? inv.T : 0;
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

    const candidates: { id: string; T: number }[] = [
      { id: 'A', T: evaluatePhaseLiquidusT(xB, 'A', compA, compB, compounds, Lv_H, Lv_S) },
      { id: 'B', T: evaluatePhaseLiquidusT(xB, 'B', compA, compB, compounds, Lv_H, Lv_S) },
      ...compounds.map(c => ({
        id: c.id,
        T: evaluatePhaseLiquidusT(xB, c.id, compA, compB, compounds, Lv_H, Lv_S),
      })),
    ];

    // Стабильная фаза — максимум температуры ликвидуса, устойчивый к NaN значениям
    const stable = candidates.reduce((best, cur) => {
      if (!Number.isFinite(best.T)) return cur;
      if (!Number.isFinite(cur.T)) return best;
      return cur.T > best.T ? cur : best;
    });

    profile.push({ xB, T: stable.T, phaseId: stable.id });
  }

  return profile;
}

export interface InvariantPointResult {
  xB: number;
  T: number;
  kind: 'intersection' | 'closest' | 'invalid';
}

/**
 * Находит инвариантную точку (эвтектику / перитектику)
 * как пересечение двух кривых ликвидуса фаз phaseIds.
 * Использует root-finding: T1(x) - T2(x) = 0.
 */
export function findInvariantPointDetailed(
  phaseIds: string[],
  compA: PureComponent,
  compB: PureComponent,
  compounds: Compound[],
  Lv_H: number[],
  Lv_S: number[],
  steps = 2000,
): InvariantPointResult {
  if (phaseIds.length !== 2) {
    return { xB: NaN, T: NaN, kind: 'invalid' };
  }

  const [id1, id2] = phaseIds;
  const eps = 1e-6;

  let prevX = NaN;
  let prevDiff = NaN;
  let prevValid = false;

  let bestX = NaN;
  let bestT = NaN;
  let bestAbsDiff = Infinity;

  const diffAt = (xB: number) => {
    const t1 = evaluatePhaseLiquidusT(xB, id1, compA, compB, compounds, Lv_H, Lv_S);
    const t2 = evaluatePhaseLiquidusT(xB, id2, compA, compB, compounds, Lv_H, Lv_S);

    if (!Number.isFinite(t1) || !Number.isFinite(t2) || t1 <= 0 || t2 <= 0) {
      return { valid: false as const, diff: NaN, t1, t2 };
    }

    return {
      valid: true as const,
      diff: t1 - t2,
      t1,
      t2,
    };
  };

  let bracketLeft = NaN;
  let bracketRight = NaN;

  for (let i = 1; i < steps; i++) {
    const xB = eps + (1 - 2 * eps) * (i / steps);
    const sample = diffAt(xB);

    if (!sample.valid) {
      prevValid = false;
      prevDiff = NaN;
      prevX = NaN;
      continue;
    }

    const absDiff = Math.abs(sample.diff);
    if (absDiff < bestAbsDiff) {
      bestAbsDiff = absDiff;
      bestX = xB;
      bestT = 0.5 * (sample.t1 + sample.t2);
    }

    if (prevValid && Number.isFinite(prevDiff) && prevDiff * sample.diff <= 0) {
      bracketLeft = prevX;
      bracketRight = xB;
      break;
    }

    prevValid = true;
    prevDiff = sample.diff;
    prevX = xB;
  }

  // 1) Если нашли реальное пересечение — уточняем его бисекцией
  if (Number.isFinite(bracketLeft) && Number.isFinite(bracketRight)) {
    const f = (x: number) => {
      const s = diffAt(x);
      return s.valid ? s.diff : NaN;
    };

    const xB = bisectBracketed(f, bracketLeft, bracketRight, 48);
    if (Number.isFinite(xB)) {
      const s = diffAt(xB);
      if (s.valid) {
        return {
          xB,
          T: 0.5 * (s.t1 + s.t2),
          kind: 'intersection',
        };
      }
    }
  }

  // 2) Если пересечения нет — возвращаем closest approach
  if (Number.isFinite(bestX) && Number.isFinite(bestT) && bestT > 0) {
    return {
      xB: bestX,
      T: bestT,
      kind: 'closest',
    };
  }

  // 3) И только если вообще не было валидной общей области — NaN
  return { xB: NaN, T: NaN, kind: 'invalid' };
}

export function findInvariantPoint(
  phaseIds: string[],
  compA: PureComponent,
  compB: PureComponent,
  compounds: Compound[],
  Lv_H: number[],
  Lv_S: number[],
  steps = 2000,
): { xB: number; T: number } {
  const result = findInvariantPointDetailed(
    phaseIds, compA, compB, compounds, Lv_H, Lv_S, steps,
  );
  return { xB: result.xB, T: result.T };
}

/**
 * Каноническое отображение phaseId -> состав x_B.
 * SSOT: вся UI-логика, связанная с положением фаз на оси состава,
 * должна использовать только этот helper.
 */
export function getPhaseCompositionX(
  phaseId: string,
  compounds: Compound[],
  fallback = 0.5,
): number {
  if (phaseId === 'A') return 0;
  if (phaseId === 'B') return 1;
  return compounds.find(c => c.id === phaseId)?.stoichB ?? fallback;
}

/**
 * Топологическая классификация инварианты на огибающей ликвидуса.
 * Это derived-data helper для визуализации/подписей, а не отдельное состояние.
 *
 * Если состав жидкости xInv лежит внутри интервала составов твёрдых фаз,
 * отображаем как "eutectic", иначе — как "peritectic".
 *
 * tolerance согласован по порядку величины с дискретизацией поиска инварианты
 * (steps=2000 -> Δx ≈ 5e-4), поэтому используем запас 1e-3.
 */
export function determineInvariantType(
  xInv: number,
  phaseIds: string[],
  compounds: Compound[],
  tolerance = 1e-3,
): 'eutectic' | 'peritectic' {
  if (phaseIds.length === 0) return 'eutectic';

  const xs = phaseIds.map(id => getPhaseCompositionX(id, compounds, xInv));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);

  return xInv >= minX - tolerance && xInv <= maxX + tolerance
    ? 'eutectic'
    : 'peritectic';
}

/**
 * Диапазон отображения горизонтали инварианты.
 * Для эвтектики xInv обычно уже лежит внутри [x_solid,min; x_solid,max],
 * для перитектики — может выходить за него, поэтому включаем xInv в span.
 */
export function getInvariantDisplaySpan(
  xInv: number,
  phaseIds: string[],
  compounds: Compound[],
): { xLeft: number; xRight: number } {
  if (phaseIds.length === 0) {
    return { xLeft: xInv, xRight: xInv };
  }

  const xs = phaseIds.map(id => getPhaseCompositionX(id, compounds, xInv));
  return {
    xLeft: Math.min(...xs, xInv),
    xRight: Math.max(...xs, xInv),
  };
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
