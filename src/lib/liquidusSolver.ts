import { liquidusResidualA, liquidusResidualB } from './thermodynamics';
import type { PureComponent } from './thermodynamics';
import { lnGammaA, lnGammaB } from './redlichKister';

export type Branch = 'A' | 'B';

// Simple Brent's method implementation
function brent(f: (x: number) => number, lower: number, upper: number, tolerance: number): number {
  let a = lower;
  let b = upper;
  let fa = f(a);
  let fb = f(b);
  
  if (fa * fb >= 0) {
    // If signs don't alternate, expand the search window by checking closer to boundaries or just bisection fallback
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
      // Inverse quadratic interpolation
      s = a * fb * fc / ((fa - fb) * (fa - fc)) +
          b * fa * fc / ((fb - fa) * (fb - fc)) +
          c * fa * fb / ((fc - fa) * (fc - fb));
    } else {
      // Secant method
      s = b - fb * (b - a) / (fb - fa);
    }
    
    // Check condition to use bisection
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
  
  return b;
}

export function calcTLiquidus(
  xA: number,
  branch: Branch,
  compA: PureComponent,
  compB: PureComponent,
  Lv: number[],
  Tmin = 200,
  Tmax = 3000,
): number {
  const f = (T: number) => {
    const gammaA = Math.exp(lnGammaA(xA, T, Lv));
    const gammaB = Math.exp(lnGammaB(xA, T, Lv));
    return branch === 'A'
      ? liquidusResidualA(T, xA, gammaA, compA)
      : liquidusResidualB(T, 1 - xA, gammaB, compB);
  };
  return brent(f, Tmin, Tmax, 1e-6);
}

// Вычислить T_calc для массива точек
export function calcAllTLiquidus(
  points: Array<{ xA: number; branch: Branch }>,
  compA: PureComponent,
  compB: PureComponent,
  Lv: number[],
): number[] {
  return points.map(p => calcTLiquidus(p.xA, p.branch, compA, compB, Lv));
}