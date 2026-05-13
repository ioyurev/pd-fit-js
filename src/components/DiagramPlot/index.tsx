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
import { findEutectic, calcTLiquidus } from '../../lib/liquidusSolver';
import { paramsToPhysical } from '../../lib/fitAdapter';

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

export const DiagramPlot: Component = () => {

  const chartData = createMemo(() => {
    const { dataPoints, parameters } = state;
    const { compA, compB, Lv_H, Lv_S } = paramsToPhysical(parameters);
    
    // Мгновенный поиск глобальной эвтектики
    const eut = findEutectic(compA, compB, Lv_H, Lv_S);
    const ex = eut.xB;
    const Teut = eut.T;
    
    const expPoints = dataPoints.map(p => ({ x: p.xB, y: p.T }));
    
    const curveA = [];
    const curveB = [];

    // --- ВЕТВЬ A (Кристаллизуется компонент A, слева от эвтектики) ---
    for (let xB = 0; xB <= ex; xB += 0.005) {
      curveA.push({ x: xB, y: calcTLiquidus(xB, 'A', compA, compB, Lv_H, Lv_S) });
    }
    curveA.push({ x: ex, y: Teut });

    // --- ВЕТВЬ B (Кристаллизуется компонент B, справа от эвтектики) ---
    curveB.push({ x: ex, y: Teut });
    for (let xB = ex; xB <= 1.001; xB += 0.005) {
      curveB.push({ x: xB, y: calcTLiquidus(xB, 'B', compA, compB, Lv_H, Lv_S) });
    }

    const datasets: any[] = [
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
    ];

    // Отрисовка линий полиморфных переходов A
    for (const trans of compA.transitions) {
      if (trans.T <= 0) continue;
      const intersectPoint = curveA.find(p => p.y <= trans.T) || { x: ex, y: trans.T };
      datasets.push({
        label: `Переход A (${trans.T.toFixed(0)} K)`,
        data: [{ x: 0, y: trans.T }, { x: intersectPoint.x, y: trans.T }],
        borderColor: 'rgba(54, 162, 235, 0.6)',
        borderWidth: 1.5,
        pointRadius: 0,
        type: 'line' as const,
      });
    }

    // Отрисовка линий полиморфных переходов B
    for (const trans of compB.transitions) {
      if (trans.T <= 0) continue;
      const intersectPoint = curveB.find(p => p.y >= trans.T) || { x: ex, y: trans.T };
      datasets.push({
        label: `Переход B (${trans.T.toFixed(0)} K)`,
        data: [{ x: intersectPoint.x, y: trans.T }, { x: 1, y: trans.T }],
        borderColor: 'rgba(75, 192, 192, 0.6)',
        borderWidth: 1.5,
        pointRadius: 0,
        type: 'line' as const,
      });
    }

    return { datasets };
  });

  const options = {
    animation: false as const,
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { title: { display: true, text: 'xB' }, min: 0, max: 1 },
      y: { title: { display: true, text: 'T (K)' } }
    }
  };

  return (
    <div class="chart-container main-chart">
      <Scatter data={chartData()} options={options} />
    </div>
  );
};
