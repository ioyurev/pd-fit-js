import { createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import { Chart, LineController, LineElement, PointElement, LogarithmicScale, LinearScale, Title, Legend } from 'chart.js';
import { Line } from 'solid-chartjs';
import { state } from '@/store/fitStore';
import { isDark } from '@/store/themeStore';
import { getChartTheme } from '@/lib/chartTheme';

Chart.register(LineController, LineElement, PointElement, LogarithmicScale, LinearScale, Title, Legend);

export const ConvergencePlot: Component = () => {
  const chartData = createMemo(() => {
    const history = state.progressHistory;
    const targetLine = history.map(() => 1e-4);

    return {
      labels: history.map(h => h.step),
      datasets: [
        {
          label: 'Относительное изменение \u03c7\u00b2 (Convergence)',
          data: history.map(h => h.convergenceError),
          borderColor: '#e74c3c',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          hitRadius: 6,
          tension: 0.1,
          type: 'line' as const,
        },
        {
          label: 'Target Tolerance (1e-4)',
          data: targetLine,
          borderColor: 'rgba(46, 204, 113, 0.8)',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          type: 'line' as const,
        }
      ]
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
      plugins: {
        legend: {
          display: true, position: 'top' as const,
          labels: { boxWidth: 12, font: { size: 10 }, color: textColor }
        },
        title: {
          display: true, text: 'Сходимость алгоритма Левенберга-Марквардта',
          font: { size: 12, weight: 'bold' as const }, color: textColor
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Улучшение модели', color: textColor },
          grid: { display: false }, ticks: { color: textColor }
        },
        y: {
          type: 'logarithmic' as const,
          display: true,
          position: 'left' as const,
          title: { display: true, text: '\u0394\u03c7\u00b2 / \u03c7\u00b2', color: textColor },
          grid: { color: gridColor },
          ticks: { color: textColor }
        }
      }
    };
  });

  return (
    <div class="optimization-chart-pane">
      <Line data={chartData()} options={options()} />
    </div>
  );
};
