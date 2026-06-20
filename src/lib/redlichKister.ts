import { R } from '@/lib/thermodynamics';

export type RKCoeff = number;

// Интегральная избыточная функция (энтальпийная или энтропийная часть)
export function gExcess(xA: number, Lv: number[]): number {
  const xB = 1 - xA;
  let sum = 0;
  for (let v = 0; v < Lv.length; v++) {
    sum += Lv[v] * Math.pow(xA - xB, v);
  }
  return xA * xB * sum;
}

export function lnGammaA(xA: number, T: number, Lv: number[]): number {
  const xB = 1 - xA;
  const d = xA - xB;
  let sum = 0;
  for (let v = 0; v < Lv.length; v++) {
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
    const term = Math.pow(d, v) - (v > 0 ? 2 * v * xB * Math.pow(d, v - 1) : 0);
    sum += (Lv[v] / (R * T)) * term;
  }
  return xA * xA * sum;
}

// Парциальные вклады (без деления на RT — сырые дж/моль для H или дж/(моль·К) для S)
export function partialExcessA(xA: number, Lv: number[]): number {
  const xB = 1 - xA;
  const d = xA - xB;
  let sum = 0;
  for (let v = 0; v < Lv.length; v++) {
    const term = Math.pow(d, v) + (v > 0 ? 2 * v * xA * Math.pow(d, v - 1) : 0);
    sum += Lv[v] * term;
  }
  return xB * xB * sum;
}

export function partialExcessB(xA: number, Lv: number[]): number {
  const xB = 1 - xA;
  const d = xA - xB;
  let sum = 0;
  for (let v = 0; v < Lv.length; v++) {
    const term = Math.pow(d, v) - (v > 0 ? 2 * v * xB * Math.pow(d, v - 1) : 0);
    sum += Lv[v] * term;
  }
  return xA * xA * sum;
}

export function checkMiscibility(Lv: number[], T: number, steps = 50): boolean {
  const h = 1e-4;
  for (let i = 1; i < steps; i++) {
    const x = i / steps;
    const d2G = (gExcess(x + h, Lv) - 2 * gExcess(x, Lv) + gExcess(x - h, Lv)) / (h * h);
    const ideal = R * T / (x * (1 - x));
    if (d2G + ideal < 0) return false;
  }
  return true;
}
