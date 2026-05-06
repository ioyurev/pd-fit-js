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

// Аналитические производные для модели Редлиха–Кистера
export function lnGammaA(xA: number, T: number, Lv: number[]): number {
  const xB = 1 - xA;
  const d = xA - xB;
  let sum = 0;
  for (let v = 0; v < Lv.length; v++) {
    // ln γ_A = x_B² · Σ L_v · [ (x_A - x_B)^v + 2·v·x_A·(x_A - x_B)^(v-1) ] / RT
    const term = Math.pow(d, v) + (v > 0 ? 2 * v * xA * Math.pow(d, v - 1) : 0);
    sum += (Lv[v] / (R * T)) * term;
  }
  return xB * xB * sum; 
}

export function lnGammaB(xA: number, T: number, Lv: number[]): number {
  const xB = 1 - xA;
  const d = xA - xB;
  let sum = 0;
  for (let v = 0; v < Lv.length; v++) {
    // ln γ_B = x_A² · Σ L_v · [ (x_A - x_B)^v - 2·v·x_B·(x_A - x_B)^(v-1) ] / RT
    const term = Math.pow(d, v) - (v > 0 ? 2 * v * xB * Math.pow(d, v - 1) : 0);
    sum += (Lv[v] / (R * T)) * term;
  }
  return xA * xA * sum;
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