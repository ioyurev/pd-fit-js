import { createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import { Chart, Title, Tooltip, Legend, Colors } from 'chart.js';
import { Scatter } from 'solid-chartjs';
import { state } from '../../store/fitStore';
import { calcTLiquidus } from '../../lib/liquidusSolver';
import { paramsToPhysical } from '../../lib/fitAdapter';

Chart.register(Title, Tooltip, Legend, Colors);

export const DiagramPlot: Component = () => {
  const chartData = createMemo(() => {
    const { dataPoints, parameters } = state;
    
    // Experimental points
    const expPoints = dataPoints.map(p => ({ x: p.xA, y: p.T }));
    
    // Calculated curve (smooth)
    const { compA, compB, Lv } = paramsToPhysical(parameters);
    const curveA = [];
    const curveB = [];
    
    // Simple heuristic for eutectic: find min T in experimental data or use 0.5
    const eutX = dataPoints.length > 0 
      ? dataPoints.reduce((minX, p) => p.T < state.dataPoints.find(dp => dp.xA === minX)!.T ? p.xA : minX, dataPoints[0].xA)
      : 0.5;

    for (let x = 0; x <= 1.001; x += 0.02) {
      if (x >= eutX) {
        curveA.push({ x, y: calcTLiquidus(x, 'A', compA, compB, Lv) });
      }
      if (x <= eutX) {
        curveB.push({ x, y: calcTLiquidus(x, 'B', compA, compB, Lv) });
      }
    }

    return {
      datasets: [
        {
          label: 'Эксперимент',
          data: expPoints,
          backgroundColor: 'rgba(255, 99, 132, 1)',
          type: 'scatter' as const,
        },
        {
          label: 'Ликвидус A',
          data: curveA,
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          type: 'line' as const,
        },
        {
          label: 'Ликвидус B',
          data: curveB,
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          type: 'line' as const,
        }
      ]
    };
  });

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        title: { display: true, text: 'xA' },
        min: 0,
        max: 1,
      },
      y: {
        title: { display: true, text: 'T (K)' },
      }
    }
  };

  return (
    <div class="diagram-plot" style="height: 400px; width: 100%;">
      <Scatter data={chartData()} options={options} />
    </div>
  );
};