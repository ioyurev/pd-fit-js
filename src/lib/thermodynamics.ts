export const R = 8.314; // Дж/(моль·К)

export interface PhaseTransition {
  id: string; // идентификатор, например Ttrans_A_0
  T: number;  // Температура перехода, К
  dH: number; // Энтальпия перехода, Дж/моль
}

export interface PureComponent {
  Tfus: number;   // К
  dHfus: number;  // Дж/моль
  transitions: PhaseTransition[]; // Массив полиморфных переходов
}

// Правая часть уравнения Шредера-Ле Шателье
export function schroederRHS(T: number, comp: PureComponent): number {
  let dH_eff = comp.dHfus;
  let dS_eff = comp.dHfus / comp.Tfus;

  // Сортируем переходы по убыванию температуры (от плавления вниз)
  const sortedTrans = [...comp.transitions].sort((a, b) => b.T - a.T);

  for (const trans of sortedTrans) {
    // Если мы спустились по температуре ниже точки этого перехода
    if (trans.T > 0 && T < trans.T) {
      dH_eff += trans.dH;
      dS_eff += trans.dH / trans.T;
    }
  }

  const T_eff = dS_eff !== 0 ? dH_eff / dS_eff : comp.Tfus;
  return (dH_eff / R) * (1 / T_eff - 1 / T);
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