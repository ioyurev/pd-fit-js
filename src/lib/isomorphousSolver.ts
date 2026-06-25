import type { PureComponent } from '@/lib/thermodynamics';
import { schroederRHS } from '@/lib/thermodynamics';
import { lnGammaA, lnGammaB } from '@/lib/redlichKister';
import { findSignChangeBracket, bisectBracketed } from '@/lib/numerics';

/**
 * Вычисляет температурно-зависимые параметры взаимодействия Редлиха-Кистера:
 * L_v(T) = L_v^H - T * L_v^S
 */
function getLvAtT(Lv_H: number[], Lv_S: number[], T: number): number[] {
  return Lv_H.map((h, v) => h - T * (Lv_S[v] ?? 0));
}

/**
 * Класс для кубической сплайн-интерполяции естественного вида (Natural Cubic Spline).
 * Обеспечивает гладкость класса C1 (непрерывность первой производной),
 * предотвращая разрывы градиентов для оптимизатора Левенберга-Марквардта.
 */
export class CubicSpline {
  private x: number[] = [];
  private a: number[] = [];
  private b: number[] = [];
  private c: number[] = [];
  private d: number[] = [];
  private n = 0;

  constructor(x: number[], y: number[]) {
    if (x.length < 2) {
      throw new Error('Для построения сплайна требуется как минимум 2 точки.');
    }
    this.n = x.length - 1;
    this.x = [...x];
    this.a = [...y];

    const h: number[] = [];
    for (let i = 0; i < this.n; i++) {
      h.push(x[i + 1] - x[i]);
    }

    const alpha: number[] = [0];
    for (let i = 1; i < this.n; i++) {
      alpha.push(
        (3 / h[i]) * (this.a[i + 1] - this.a[i]) -
        (3 / h[i - 1]) * (this.a[i] - this.a[i - 1])
      );
    }

    const l: number[] = [1];
    const mu: number[] = [0];
    const z: number[] = [0];

    for (let i = 1; i < this.n; i++) {
      l.push(2 * (x[i + 1] - x[i - 1]) - h[i - 1] * mu[i - 1]);
      mu.push(h[i] / l[i]);
      z.push((alpha[i] - h[i - 1] * z[i - 1]) / l[i]);
    }

    l.push(1);
    z.push(0);
    this.c = Array(this.n + 1).fill(0);

    for (let j = this.n - 1; j >= 0; j--) {
      this.c[j] = z[j] - mu[j] * this.c[j + 1];
      this.b.push(
        (this.a[j + 1] - this.a[j]) / h[j] -
        (h[j] * (this.c[j + 1] + 2 * this.c[j])) / 3
      );
      this.d.push((this.c[j + 1] - this.c[j]) / (3 * h[j]));
    }
    this.b.reverse();
    this.d.reverse();
  }

  interpolate(val: number): number {
    if (this.n === 0) return this.a[0] ?? 0;

    // Бинарный поиск интервала
    let low = 0;
    let high = this.n - 1;
    let idx = 0;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (val >= this.x[mid] && val <= this.x[mid + 1]) {
        idx = mid;
        break;
      } else if (val < this.x[mid]) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    // Экстраполяция на краях
    if (val < this.x[0]) idx = 0;
    if (val > this.x[this.n]) idx = this.n - 1;

    const dx = val - this.x[idx];
    return (
      this.a[idx] +
      this.b[idx] * dx +
      this.c[idx] * dx * dx +
      this.d[idx] * dx * dx * dx
    );
  }
}

/**
 * Находит xB_sol для заданных xB_liq и T.
 * Уравнение: ln(xA_liq * gammaA_liq) - ln(xA_sol * gammaA_sol) - RHS_A = 0
 */
export function findXBSol(
  T: number,
  xB_liq: number,
  compA: PureComponent,
  Lv_H_liq: number[],
  Lv_S_liq: number[],
  Lv_H_sol: number[],
  Lv_S_sol: number[]
): number {
  const xA_liq = 1 - xB_liq;
  const rhsA = schroederRHS(T, compA);
  
  const Lv_liq = getLvAtT(Lv_H_liq, Lv_S_liq, T);
  const Lv_sol = getLvAtT(Lv_H_sol, Lv_S_sol, T);

  const ln_actA_liq = Math.log(xA_liq) + lnGammaA(xA_liq, T, Lv_liq);

  const f = (xB_sol: number) => {
    const xA_sol = 1 - xB_sol;
    const ln_actA_sol = Math.log(xA_sol) + lnGammaA(xA_sol, T, Lv_sol);
    return ln_actA_liq - ln_actA_sol - rhsA;
  };

  const bracket = findSignChangeBracket(f, 1e-9, 1 - 1e-9);
  if (!bracket) return NaN;

  return bisectBracketed(f, bracket[0], bracket[1], 35);
}

/**
 * Вычисляет невязку уравнения равновесия для компонента B
 */
export function evaluateDiffT(
  T: number,
  xB_liq: number,
  compA: PureComponent,
  compB: PureComponent,
  Lv_H_liq: number[],
  Lv_S_liq: number[],
  Lv_H_sol: number[],
  Lv_S_sol: number[]
): number {
  const xB_sol = findXBSol(T, xB_liq, compA, Lv_H_liq, Lv_S_liq, Lv_H_sol, Lv_S_sol);
  const xA_liq = 1 - xB_liq;
  const rhsB = schroederRHS(T, compB);

  const Lv_liq = getLvAtT(Lv_H_liq, Lv_S_liq, T);
  const Lv_sol = getLvAtT(Lv_H_sol, Lv_S_sol, T);

  const ln_actB_liq = Math.log(xB_liq) + lnGammaB(xA_liq, T, Lv_liq);
  const ln_actB_sol = Math.log(xB_sol) + lnGammaB(1 - xB_sol, T, Lv_sol);

  return ln_actB_liq - ln_actB_sol - rhsB;
}

/**
 * Численно находит температуру T и состав твердой фазы xB_sol для заданного состава жидкости xB_liq.
 */
export function solveIsomorphousPoint(
  xB_liq: number,
  compA: PureComponent,
  compB: PureComponent,
  Lv_H_liq: number[],
  Lv_S_liq: number[],
  Lv_H_sol: number[],
  Lv_S_sol: number[]
): { T: number; xB_sol: number } {
  if (xB_liq <= 1e-8) {
    return { T: compA.Tfus, xB_sol: 0 };
  }
  if (xB_liq >= 1 - 1e-8) {
    return { T: compB.Tfus, xB_sol: 1 };
  }

  let left = Math.min(compA.Tfus, compB.Tfus) - 300;
  let right = Math.max(compA.Tfus, compB.Tfus) + 300;
  if (left < 50) left = 50;

  let T = (left + right) / 2;

  const f = (T: number) =>
    evaluateDiffT(T, xB_liq, compA, compB, Lv_H_liq, Lv_S_liq, Lv_H_sol, Lv_S_sol);

  const bracket = findSignChangeBracket(f, left, right, 64);
  if (!bracket) {
    return { T: NaN, xB_sol: NaN };
  }

  T = bisectBracketed(f, bracket[0], bracket[1], 40);
  const xB_sol = findXBSol(T, xB_liq, compA, Lv_H_liq, Lv_S_liq, Lv_H_sol, Lv_S_sol);

  return Number.isFinite(T) && Number.isFinite(xB_sol)
    ? { T, xB_sol }
    : { T: NaN, xB_sol: NaN };
}

/**
 * Находит xB_liq для заданных xB_sol и T.
 * Уравнение: ln(xB_liq * gammaB_liq) - ln(xB_sol * gammaB_sol) - RHS_B = 0
 */
export function findXBLiq(
  T: number,
  xB_sol: number,
  compB: PureComponent,
  Lv_H_liq: number[],
  Lv_S_liq: number[],
  Lv_H_sol: number[],
  Lv_S_sol: number[]
): number {
  const rhsB = schroederRHS(T, compB);
  
  const Lv_liq = getLvAtT(Lv_H_liq, Lv_S_liq, T);
  const Lv_sol = getLvAtT(Lv_H_sol, Lv_S_sol, T);

  const ln_actB_sol = Math.log(xB_sol) + lnGammaB(1 - xB_sol, T, Lv_sol);

  const f = (xB_liq: number) => {
    const xA_liq = 1 - xB_liq;
    const ln_actB_liq = Math.log(xB_liq) + lnGammaB(xA_liq, T, Lv_liq);
    return ln_actB_liq - ln_actB_sol - rhsB;
  };

  const bracket = findSignChangeBracket(f, 1e-9, 1 - 1e-9);
  if (!bracket) return NaN;

  return bisectBracketed(f, bracket[0], bracket[1], 35);
}

export function evaluateDiffTFromSolidus(
  T: number,
  xB_sol: number,
  compA: PureComponent,
  compB: PureComponent,
  Lv_H_liq: number[],
  Lv_S_liq: number[],
  Lv_H_sol: number[],
  Lv_S_sol: number[]
): number {
  const xB_liq = findXBLiq(T, xB_sol, compB, Lv_H_liq, Lv_S_liq, Lv_H_sol, Lv_S_sol);
  const xA_liq = 1 - xB_liq;
  const xA_sol = 1 - xB_sol;
  const rhsA = schroederRHS(T, compA);

  const Lv_liq = getLvAtT(Lv_H_liq, Lv_S_liq, T);
  const Lv_sol = getLvAtT(Lv_H_sol, Lv_S_sol, T);

  const ln_actA_liq = Math.log(xA_liq) + lnGammaA(xA_liq, T, Lv_liq);
  const ln_actA_sol = Math.log(xA_sol) + lnGammaA(xA_sol, T, Lv_sol);

  return ln_actA_liq - ln_actA_sol - rhsA;
}

/**
 * Численно находит температуру T и состав жидкости xB_liq для заданного состава твердой фазы xB_sol.
 */
export function solveIsomorphousPointFromSolidus(
  xB_sol: number,
  compA: PureComponent,
  compB: PureComponent,
  Lv_H_liq: number[],
  Lv_S_liq: number[],
  Lv_H_sol: number[],
  Lv_S_sol: number[]
): { T: number; xB_liq: number } {
  if (xB_sol <= 1e-8) {
    return { T: compA.Tfus, xB_liq: 0 };
  }
  if (xB_sol >= 1 - 1e-8) {
    return { T: compB.Tfus, xB_liq: 1 };
  }

  let left = Math.min(compA.Tfus, compB.Tfus) - 300;
  let right = Math.max(compA.Tfus, compB.Tfus) + 300;
  if (left < 50) left = 50;

  let T = (left + right) / 2;

  const f = (T: number) =>
    evaluateDiffTFromSolidus(T, xB_sol, compA, compB, Lv_H_liq, Lv_S_liq, Lv_H_sol, Lv_S_sol);

  const bracket = findSignChangeBracket(f, left, right, 64);
  if (!bracket) {
    return { T: NaN, xB_liq: NaN };
  }

  T = bisectBracketed(f, bracket[0], bracket[1], 40);
  const xB_liq = findXBLiq(T, xB_sol, compB, Lv_H_liq, Lv_S_liq, Lv_H_sol, Lv_S_sol);

  return Number.isFinite(T) && Number.isFinite(xB_liq)
    ? { T, xB_liq }
    : { T: NaN, xB_liq: NaN };
}

export interface IsomorphousProfile {
  liquidusSpline: CubicSpline;
  solidusSpline: CubicSpline;
  points: Array<{ T: number; xB_liq: number; xB_sol: number }>;
}

/**
 * Строит профиль изоморфной диаграммы (ликвидус и солидус) свипом по составу жидкости.
 * Возвращает сплайны интерполяции T(x) для ликвидуса и солидуса.
 */
export function buildIsomorphousProfile(
  compA: PureComponent,
  compB: PureComponent,
  Lv_H_liq: number[],
  Lv_S_liq: number[],
  Lv_H_sol: number[],
  Lv_S_sol: number[],
  steps = 100
): IsomorphousProfile {
  const points: Array<{ T: number; xB_liq: number; xB_sol: number }> = [];

  for (let i = 0; i <= steps; i++) {
    const xB_liq = i / steps;
    try {
      const coex = solveIsomorphousPoint(xB_liq, compA, compB, Lv_H_liq, Lv_S_liq, Lv_H_sol, Lv_S_sol);
      if (Number.isFinite(coex.T) && Number.isFinite(coex.xB_sol)) {
        points.push({ T: coex.T, xB_liq, xB_sol: coex.xB_sol });
      }
    } catch {
      // Игнорируем сбои
    }
  }

  if (points.length < 2) {
    points.push(
      { T: compA.Tfus, xB_liq: 0, xB_sol: 0 },
      { T: compB.Tfus, xB_liq: 1, xB_sol: 1 },
    );
  }

  // Сортируем точки по составу
  const sortedLiq = [...points].sort((a, b) => a.xB_liq - b.xB_liq);
  const sortedSol = [...points].sort((a, b) => a.xB_sol - b.xB_sol);

  // Фильтруем дубликаты
  const uniqueLiq: typeof sortedLiq = [];
  for (const pt of sortedLiq) {
    if (uniqueLiq.length === 0 || Math.abs(pt.xB_liq - uniqueLiq[uniqueLiq.length - 1].xB_liq) > 1e-6) {
      uniqueLiq.push(pt);
    }
  }

  const uniqueSol: typeof sortedSol = [];
  for (const pt of sortedSol) {
    if (uniqueSol.length === 0 || Math.abs(pt.xB_sol - uniqueSol[uniqueSol.length - 1].xB_sol) > 1e-6) {
      uniqueSol.push(pt);
    }
  }

  const xsLiq = uniqueLiq.map(p => p.xB_liq);
  const tsLiq = uniqueLiq.map(p => p.T);

  const xsSol = uniqueSol.map(p => p.xB_sol);
  const tsSol = uniqueSol.map(p => p.T);

  return {
    liquidusSpline: new CubicSpline(xsLiq, tsLiq),
    solidusSpline: new CubicSpline(xsSol, tsSol),
    points
  };
}
