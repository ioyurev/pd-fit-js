/**
 * SSOT для визуальной темы графиков Chart.js.
 * Все компоненты графиков используют только этот модуль.
 */

export interface ChartThemeColors {
  gridColor: string;
  textColor: string;
  dark: boolean;
}

export function getChartTheme(isDark: boolean): ChartThemeColors {
  return {
    dark: isDark,
    gridColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    textColor: isDark ? '#aaaaaa' : '#666666',
  };
}

/** Цветовая палитра для фаз на диаграмме */
export const PHASE_COLORS = {
  A: 'rgba(54, 162, 235, 1)',
  B: 'rgba(75, 192, 192, 1)',
  compounds: [
    'rgba(155, 89, 182, 1)',
    'rgba(230, 126, 34, 1)',
    'rgba(26, 188, 156, 1)',
    'rgba(241, 196, 15, 1)',
  ],
} as const;

export function phaseColor(
  id: string,
  compoundIds: string[],
  alpha = 1,
): string {
  if (id === 'A') return PHASE_COLORS.A.replace('1)', `${alpha})`);
  if (id === 'B') return PHASE_COLORS.B.replace('1)', `${alpha})`);
  const idx = compoundIds.indexOf(id);
  const base = PHASE_COLORS.compounds[
    (idx >= 0 ? idx : 0) % PHASE_COLORS.compounds.length
  ];
  return base.replace('1)', `${alpha})`);
}
