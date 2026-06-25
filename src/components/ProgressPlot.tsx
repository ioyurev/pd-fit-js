import { createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import { Chart, LineController, LineElement, PointElement, LinearScale, Title, Legend, Filler } from 'chart.js';
import { Line } from 'solid-chartjs';
import { state } from '@/store/fitStore';
import { isDark } from '@/store/themeStore';
import { getChartTheme } from '@/lib/chartTheme';

Chart.register(LineController, LineElement, PointElement, LinearScale, Title, Legend, Filler);

export const ProgressPlot: Component = () => {
  const chartData = createMemo(() => {
    const history = state.progressHistory;
    return {
      labels: history.map(h => h.step),
      datasets: [
        {
          label: 'Rwp (%)',
          data: history.map(h => h.rwpVal * 100),
          borderColor: '#aa3bff',
          backgroundColor: 'rgba(170, 59, 255, 0.05)',
          borderWidth: 2,
          pointRadius: 0,
          hitRadius: 6,
          tension: 0.15,
          fill: true,
          yAxisID: 'y',
        },
        {
          label: 'Chi-Sq (\u03c7\u00b2)',
          data: history.map(h => h.chiSq),
          borderColor: '#e67e22',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          hitRadius: 6,
          tension: 0.15,
          fill: false,
          yAxisID: 'y1',
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
          display: true,
          position: 'top' as const,
          labels: { boxWidth: 12, font: { size: 10 }, color: textColor }
        },
        title: {
          display: true,
          text: 'Динамика факторов адекватности',
          font: { size: 12, weight: 'bold' as const },
          color: textColor
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Улучшение модели', color: textColor },
          grid: { display: false },
          ticks: { color: textColor }
        },
        y: {
          type: 'linear' as const,
          display: true,
          position: 'left' as const,
          beginAtZero: true,
          title: { display: true, text: 'Rwp (%)', color: textColor },
          grid: { color: gridColor },
          ticks: { color: textColor }
        },
        y1: {
          type: 'linear' as const,
          display: true,
          position: 'right' as const,
          beginAtZero: true,
          title: { display: true, text: 'Chi-Sq (\u03c7\u00b2)', color: textColor },
          grid: { drawOnChartArea: false },
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
