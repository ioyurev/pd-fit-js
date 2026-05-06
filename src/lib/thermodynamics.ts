export const R = 8.314; // Дж/(моль·К)

export interface PureComponent {
  Tfus: number;   // К
  dHfus: number;  // Дж/моль
}

// Правая часть уравнения Шредера–ЛеШателье
// ln(x·γ) = (dHfus/R)·(1/Tfus - 1/T)
export function schroederRHS(T: number, comp: PureComponent): number {
  return (comp.dHfus / R) * (1 / comp.Tfus - 1 / T);
}

// Невязка для численного решения: f(T) = 0
export function liquidusResidualA(
  T: number, xA: number, gammaA: number, comp: PureComponent
): number {
  return Math.log(xA * gammaA) - schroederRHS(T, comp);
}

export function liquidusResidualB(
  T: number, xB: number, gammaB: number, comp: PureComponent
): number {
  return Math.log(xB * gammaB) - schroederRHS(T, comp);
}