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
  LineController
} from 'chart.js';
import { Scatter } from 'solid-chartjs';
import { state } from '../../store/fitStore';

Chart.register(
  Title,
  Tooltip,
  Legend,
  Colors,
  LinearScale,
  PointElement,
  LineElement,
  ScatterController,
  LineController
);

export const ResidualsPlot: Component = () => {
  const chartData = createMemo(() => {
    const { dataPoints, residuals } = state;
    
    const ptsA = [];
    const ptsB = [];
    
    // residuals are calculated only for non-eutectic points
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
          label: 'Нулевая линия',
          data: [{x: 0, y: 0}, {x: 1, y: 0}],
          borderColor: 'rgba(0, 0, 0, 0.5)',
          borderWidth: 1,
          pointRadius: 0,
          borderDash: [5, 5],
          fill: false,
          type: 'line' as const,
        }
      ]
    };
  });

  const options = {
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        title: { display: true, text: 'xB' },
        min: 0,
        max: 1,
      },
      y: {
        title: { display: true, text: 'T_obs - T_calc (K)' },
      }
    }
  };

  return (
    <div class="chart-container residual-chart">
      <Scatter data={chartData()} options={options} />
    </div>
  );
};
