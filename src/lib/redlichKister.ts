import { R } from './thermodynamics';

// Коэффициенты L_v зависят от T линейно: L_v = a_v + b_v·T
// В простейшем случае b_v = 0 (только a_v)
export type RKCoeff = number; // L_v при данной T (или константа)

export function gExcess(xA: number, Lv: number[]): number {
  const xB = 1 - xA;
  let sum = 0;
  for (let v = 0; v < Lv.length; v++) {
    sum += Lv[v] * (xA - xB) ** v;
  }
  return xA * xB * sum;
}

// Аналитические производные через формулу Маргулеса
export function lnGammaA(xA: number, T: number, Lv: number[]): number {
  const xB = 1 - xA;
  // d(Gex/RT)/d(nA) при const nB
  let sum = 0;
  for (let v = 0; v < Lv.length; v++) {
    const d = xA - xB;
    sum += (Lv[v] / (R * T)) * (
      xB * d ** v - xA * xB * v * d ** (v - 1) * 2
    );
  }
  return xB * xB * sum; 
}

export function lnGammaB(xA: number, T: number, Lv: number[]): number {
  // Аналогично для компонента B
  return lnGammaA(1 - xA, T, Lv.map((l, v) => (v % 2 === 0 ? l : -l)));
}

// Проверка на расслаивание: d²Gex/dx² + RT/(x(1-x)) > 0 для всех x
function numericalD2Gex(x: number, Lv: number[], h = 1e-4): number {
  return (gExcess(x + h, Lv) - 2 * gExcess(x, Lv) + gExcess(x - h, Lv)) / (h * h);
}

export function checkMiscibility(Lv: number[], T: number, steps = 50): boolean {
  for (let i = 1; i < steps; i++) {
    const x = i / steps;
    const d2G = numericalD2Gex(x, Lv);
    const ideal = R * T / (x * (1 - x));
    if (d2G + ideal < 0) return false;
  }
  return true;
}