import { liquidusResidualA, liquidusResidualB } from './thermodynamics';
import type { PureComponent } from './thermodynamics';
import { lnGammaA, lnGammaB } from './redlichKister';

// Ветвь может быть 'A', 'B', 'eutectic' или 'Ttrans_A_0', 'Ttrans_B_1' и т.д.
export type Branch = string;

// Simple Brent's method implementation
function brent(f: (x: number) => number, lower: number, upper: number, tolerance: number): number {
  let a = lower;
  let b = upper;
  let fa = f(a);
  let fb = f(b);
  
  if (fa * fb >= 0) {
    if (Math.abs(fa) < Math.abs(fb)) return a;
    return b;
  }
  
  if (Math.abs(fa) < Math.abs(fb)) {
    [a, b] = [b, a];
    [fa, fb] = [fb, fa];
  }
  
  let c = a;
  let fc = fa;
  let s = 0;
  let fs = 0;
  let mflag = true;
  let d = 0;
  
  for (let iter = 0; iter < 100; iter++) {
    if (Math.abs(b - a) < tolerance || fb === 0) {
      return b;
    }
    
    if (fa !== fc && fb !== fc) {
      s = a * fb * fc / ((fa - fb) * (fa - fc)) +
          b * fa * fc / ((fb - fa) * (fb - fc)) +
          c * fa * fb / ((fc - fa) * (fc - fb));
    } else {
      s = b - fb * (b - a) / (fb - fa);
    }
    
    const condition1 = (s < (3 * a + b) / 4 || s > b) && (s > (3 * a + b) / 4 || s < b);
    const condition2 = mflag && Math.abs(s - b) >= Math.abs(b - c) / 2;
    const condition3 = !mflag && Math.abs(s - b) >= Math.abs(c - d) / 2;
    const condition4 = mflag && Math.abs(b - c) < Math.abs(tolerance);
    const condition5 = !mflag && Math.abs(c - d) < Math.abs(tolerance);
    
    if (condition1 || condition2 || condition3 || condition4 || condition5) {
      s = (a + b) / 2;
      mflag = true;
    } else {
      mflag = false;
    }
    
    fs = f(s);
    d = c;
    c = b;
    fc = fb;
    
    if (fa * fs < 0) {
      b = s;
      fb = fs;
    } else {
      a = s;
      fa = fs;
    }
    
    if (Math.abs(fa) < Math.abs(fb)) {
      [a, b] = [b, a];
      [fa, fb] = [fb, fa];
    }
  }
  
  throw new Error('Метод Брента не сошелся за 100 итераций');
}

export function calcTLiquidus(
  xA: number,
  branch: Branch,
  compA: PureComponent,
  compB: PureComponent,
  Lv_H: number[],
  Lv_S: number[],
  Tmin = 200,
  Tmax = 3000,
): number {
  // Обработка точек полиморфных переходов напрямую (горизонтальная линия)
  if (branch.startsWith('Ttrans_A_')) {
    const t = compA.transitions.find(trans => trans.id === branch);
    return t ? t.T : 0;
  }
  if (branch.startsWith('Ttrans_B_')) {
    const t = compB.transitions.find(trans => trans.id === branch);
    return t ? t.T : 0;
  }

  const f = (T: number) => {
    const Lv = Lv_H.map((H, i) => H - T * Lv_S[i]);
    const gammaA = Math.exp(lnGammaA(xA, T, Lv));
    const gammaB = Math.exp(lnGammaB(xA, T, Lv));
    return branch === 'A'
      ? liquidusResidualA(T, xA, gammaA, compA)
      : liquidusResidualB(T, 1 - xA, gammaB, compB);
  };
  try {
    return brent(f, Tmin, Tmax, 1e-6);
  } catch (e) {
    console.error(e);
    return NaN;
  }
}

// Вычислить T_calc для массива точек
export function calcAllTLiquidus(
  points: Array<{ xA: number; branch: Branch }>,
  compA: PureComponent,
  compB: PureComponent,
  Lv_H: number[],
  Lv_S: number[],
): number[] {
  return points.map(p => calcTLiquidus(p.xA, p.branch, compA, compB, Lv_H, Lv_S));
}
