import { createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import {
  Chart,
  Title,
  Tooltip,
  Legend,
  Colors,
  LinearScale,
  PointElement,
  LineElement,
  ScatterController,
  LineController,
} from 'chart.js';
import { Scatter } from 'solid-chartjs';
import { state } from '@/store/fitStore';
import { isDark } from '@/store/themeStore';
import { buildDiagramDatasets } from '@/lib/diagramSeries';
import { getChartTheme } from '@/lib/chartTheme';

Chart.register(
  Title, Tooltip, Legend, Colors,
  LinearScale, PointElement, LineElement,
  ScatterController, LineController,
);

export const DiagramPlot: Component = () => {
  const chartData = createMemo(() => {
    const { dataPoints, parameters, systemType, compAName, compBName } = state;
    return buildDiagramDatasets(dataPoints, parameters, systemType, compAName, compBName);
  });

  const options = createMemo(() => {
    const dark = isDark();
    const theme = getChartTheme(dark);
    const textColor = theme.textColor;
    const gridColor = theme.gridColor;

    return {
      animation: false as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' as const, labels: { color: textColor } },
        tooltip: {
          callbacks: {
            label: (ctx: any) => `${ctx.dataset.label}: (${ctx.parsed.x.toFixed(3)}, ${ctx.parsed.y.toFixed(1)} K)`,
          },
        },
      },
      scales: {
        x: { title: { display: true, text: `x(${state.compBName})`, color: textColor }, min: 0, max: 1, grid: { color: gridColor }, ticks: { color: textColor } },
        y: { title: { display: true, text: 'T (K)', color: textColor }, grid: { color: gridColor }, ticks: { color: textColor } },
      },
    };
  });

  return (
    <div class="chart-container main-chart">
      <Scatter data={chartData()} options={options()} />
    </div>
  );
};
