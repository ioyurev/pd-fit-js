import { createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import { Chart, Title, Tooltip, Legend, Colors } from 'chart.js';
import { Scatter } from 'solid-chartjs';
import { state } from '../../store/fitStore';

Chart.register(Title, Tooltip, Legend, Colors);

export const ResidualsPlot: Component = () => {
  const chartData = createMemo(() => {
    const { dataPoints, residuals } = state;
    const ptsA = [];
    const ptsB = [];
    let resIdx = 0;
    for (const p of dataPoints) {
      if (p.branch === 'eutectic') continue;
      const r = residuals[resIdx++];
      if (p.branch === 'A') ptsA.push({ x: p.xB, y: r });
      else ptsB.push({ x: p.xB, y: r });
    }
    return {
      datasets: [
        {
          label: 'Невязки A',
          data: ptsA,
          backgroundColor: 'rgba(54, 162, 235, 1)',
          type: 'scatter' as const,
        },
        {
          label: 'Невязки B',
          data: ptsB,
          backgroundColor: 'rgba(75, 192, 192, 1)',
          type: 'scatter' as const,
        },
        {
          label: 'Ноль',
          data: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
          borderColor: 'rgba(0,0,0,0.3)',
          borderWidth: 1,
          pointRadius: 0,
          borderDash: [4, 4],
          fill: false,
          type: 'line' as const,
        },
      ],
    };
  });

  const options = {
    animation: false as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        title: { display: true, text: 'xB' },
        min: 0,
        max: 1,
      },
      y: {
        title: { display: true, text: 'ΔT (K)' },
      },
    },
  };

  return (
    <div class="residuals-wrap">
      <div class="residuals-header">
        <span class="residuals-title">Невязки</span>
        <span class="residuals-hint">T<sub>obs</sub> − T<sub>calc</sub></span>
      </div>
      <div class="chart-container residual-chart">
        <Scatter data={chartData()} options={options} />
      </div>
    </div>
  );
};
