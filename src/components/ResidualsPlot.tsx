import { createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import { Chart, Title, Tooltip, Legend, Colors } from 'chart.js';
import { Scatter } from 'solid-chartjs';
import { state } from '@/store/fitStore';
import { isDark } from '@/store/themeStore';
import { getChartTheme } from '@/lib/chartTheme';
import { tempUnit } from '@/store/unitsStore';
import { unitLabel } from '@/lib/temperatureUnits';

Chart.register(Title, Tooltip, Legend, Colors);

export const ResidualsPlot: Component = () => {
  const chartData = createMemo(() => {
    const { dataPoints, residuals } = state;
    const ptsA: { x: number; y: number }[] = [];
    const ptsB: { x: number; y: number }[] = [];
    const ptsC: { x: number; y: number }[] = [];

    let resIdx = 0;
    for (const p of dataPoints) {
      // Итератор массива residuals теперь синхронизирован со всеми точками
      const r = residuals[resIdx++] ?? 0;

      if (p.branch.type === 'pure' && p.branch.comp === 'A') ptsA.push({ x: p.xB, y: r });
      else if (p.branch.type === 'pure' && p.branch.comp === 'B') ptsB.push({ x: p.xB, y: r });
      else ptsC.push({ x: p.xB, y: r });
    }

    return {
      datasets: [
        {
          label: `Ветвь ${state.compAName}`,
          data: ptsA,
          backgroundColor: 'rgba(54, 162, 235, 1)',
          type: 'scatter' as const,
        },
        {
          label: `Ветвь ${state.compBName}`,
          data: ptsB,
          backgroundColor: 'rgba(75, 192, 192, 1)',
          type: 'scatter' as const,
        },
        {
          label: 'Соед./переходы/инв.',
          data: ptsC,
          backgroundColor: 'rgba(155, 89, 182, 1)',
          type: 'scatter' as const,
        },
        {
          label: 'Ноль',
          data: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
          borderColor: 'rgba(0,0,0,0.25)',
          borderWidth: 1,
          pointRadius: 0,
          borderDash: [4, 4],
          fill: false,
          type: 'line' as const,
        },
        {
          label: '+RMSE',
          data: [{ x: 0, y: state.rmseVal }, { x: 1, y: state.rmseVal }],
          borderColor: 'rgba(150, 150, 150, 0.2)',
          borderWidth: 1,
          pointRadius: 0,
          fill: false,
          type: 'line' as const,
        },
        {
          label: '-RMSE',
          data: [{ x: 0, y: -state.rmseVal }, { x: 1, y: -state.rmseVal }],
          borderColor: 'rgba(150, 150, 150, 0.2)',
          borderWidth: 1,
          pointRadius: 0,
          fill: '-1',
          backgroundColor: 'rgba(150, 150, 150, 0.15)',
          type: 'line' as const,
        },
      ],
    };
  });

  const options = createMemo(() => {
    const dark = isDark();
    const theme = getChartTheme(dark);
    const gridColor = theme.gridColor;
    const textColor = theme.textColor;

    return {
      animation: false as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: `x(${state.compBName})`, color: textColor }, min: 0, max: 1, grid: { color: gridColor }, ticks: { color: textColor } },
        y: { title: { display: true, text: `ΔT (${unitLabel(tempUnit())})`, color: textColor }, grid: { color: gridColor }, ticks: { color: textColor } },
      },
    };
  });

  return (
    <div class="residuals-wrap">
      <div class="residuals-header">
        <span class="residuals-title">Невязки</span>
        <span class="residuals-hint">
          T<sub>obs</sub> − T<sub>calc</sub>
        </span>
      </div>
      <div class="chart-container residual-chart">
        <Scatter data={chartData()} options={options()} />
      </div>
    </div>
  );
};
