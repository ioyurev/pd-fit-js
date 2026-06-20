import { createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import { Chart, LineController, LineElement, PointElement, LinearScale, Title, Tooltip, ScatterController, Filler } from 'chart.js';
import { Line } from 'solid-chartjs';
import { state } from '@/store/fitStore';
import { isDark } from '@/store/themeStore';
import { buildGExDatasets } from '@/lib/gexSeries';
import { getChartTheme } from '@/lib/chartTheme';

Chart.register(LineController, LineElement, PointElement, LinearScale, Title, Tooltip, ScatterController, Filler);

export const GExPlot: Component = () => {
  const gexResult = createMemo(() =>
    buildGExDatasets(state.dataPoints, state.parameters, state.covMatrix)
  );

  const chartData = createMemo(() => ({
    datasets: gexResult().datasets,
  }));

  const options = createMemo(() => {
    const dark = isDark();
    const theme = getChartTheme(dark);
    const gridColor = theme.gridColor;
    const textColor = theme.textColor;

    return {
      animation: false as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)} J/mol`,
          },
        },
      },
      scales: {
        x: {
          type: 'linear' as const,
          min: 0, max: 1,
          title: { display: true, text: `x(${state.compBName})`, color: textColor },
          grid: { color: gridColor },
          ticks: { color: textColor }
        },
        y: {
          title: { display: true, text: 'Gex (J/mol)', color: textColor },
          grid: { color: gridColor },
          ticks: { color: textColor }
        },
      },
    };
  });

  const T_ref_text = createMemo(() => gexResult().T_ref.toFixed(0));

  return (
    <div class="residuals-wrap">
      <div class="residuals-header">
        <span class="residuals-title">Избыточная энергия Гиббса (G<sup>ex</sup>)</span>
        <span class="residuals-hint">при T = {T_ref_text()} K</span>
      </div>
      <div class="chart-container residual-chart">
        <Line data={chartData()} options={options()} />
      </div>
    </div>
  );
};
