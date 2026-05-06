import { createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import { Chart, Title, Tooltip, Legend, Colors } from 'chart.js';
import { Scatter } from 'solid-chartjs';
import { state } from '../../store/fitStore';
import { calcTLiquidus } from '../../lib/liquidusSolver';
import { paramsToPhysical } from '../../lib/fitAdapter';

Chart.register(Title, Tooltip, Legend, Colors);

export const DiagramPlot: Component = () => {
  // Поиск точки пересечения ветвей (эвтектики) методом дихотомии
  const eutX = createMemo(() => {
    const { parameters } = state;
    const { compA, compB, Lv_H, Lv_S } = paramsToPhysical(parameters);

    const f = (x: number) => {
      const Ta = calcTLiquidus(x, 'A', compA, compB, Lv_H, Lv_S);
      const Tb = calcTLiquidus(x, 'B', compA, compB, Lv_H, Lv_S);
      return Ta - Tb;
    };

    // f(0) = TfusA - (~Tb) > 0 обычно
    // f(1) = (~Ta) - TfusB < 0 обычно
    // Ищем x где f(x) = 0
    let low = 0, high = 1;
    for (let i = 0; i < 30; i++) {
      const mid = (low + high) / 2;
      if (f(mid) > 0) low = mid;
      else high = mid;
    }
    return (low + high) / 2;
  });

  const chartData = createMemo(() => {
    const { dataPoints, parameters } = state;
    const ex = eutX();
    
    // Experimental points
    const expPoints = dataPoints.map(p => ({ x: p.xA, y: p.T }));
    
    // Calculated curve (smooth)
    const { compA, compB, Lv_H, Lv_S } = paramsToPhysical(parameters);
    const curveA = [];
    const curveB = [];
    
    const Teut = calcTLiquidus(ex, 'A', compA, compB, Lv_H, Lv_S);

    // Ветвь B (слева направо до эвтектики)
    for (let x = 0; x < ex; x += 0.02) {
      curveB.push({ x, y: calcTLiquidus(x, 'B', compA, compB, Lv_H, Lv_S) });
    }
    curveB.push({ x: ex, y: Teut });

    // Ветвь A (справа налево до эвтектики)
    curveA.push({ x: ex, y: Teut });
    for (let x = ex + 0.02; x <= 1.001; x += 0.02) {
      curveA.push({ x, y: calcTLiquidus(x, 'A', compA, compB, Lv_H, Lv_S) });
    }
    if (curveA[curveA.length-1].x < 1) {
       curveA.push({ x: 1, y: calcTLiquidus(1, 'A', compA, compB, Lv_H, Lv_S) });
    }

    // --- НОВАЯ ЛОГИКА: ЛИНИИ ПЕРЕХОДОВ ---
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

    // Отрисовка линий всех переходов для B (слева направо до пересечения с ликвидусом)
    for (const trans of compB.transitions) {
      if (trans.T <= 0) continue;
      // Ищем пересечение: первая точка слева направо, где температура падает ниже Ttrans
      const intersectPoint = curveB.find(p => p.y <= trans.T) || { x: ex, y: trans.T };
      datasets.push({
        label: `Переход B (${trans.T.toFixed(0)} K)`,
        data: [{ x: 0, y: trans.T }, { x: intersectPoint.x, y: trans.T }],
        borderColor: 'rgba(75, 192, 192, 0.6)',
        borderWidth: 1.5,
        borderDash: [5, 5],
        pointRadius: 0,
        type: 'line' as const,
      });
    }

    // Отрисовка линий всех переходов для A (от пересечения с ликвидусом вправо до чистого компонента)
    for (const trans of compA.transitions) {
      if (trans.T <= 0) continue;
      // Ищем пересечение: первая точка слева направо (от эвтектики к краю), где температура поднимается выше Ttrans
      const intersectPoint = curveA.find(p => p.y >= trans.T) || { x: ex, y: trans.T };
      datasets.push({
        label: `Переход A (${trans.T.toFixed(0)} K)`,
        data: [{ x: intersectPoint.x, y: trans.T }, { x: 1, y: trans.T }],
        borderColor: 'rgba(54, 162, 235, 0.6)',
        borderWidth: 1.5,
        borderDash: [5, 5],
        pointRadius: 0,
        type: 'line' as const,
      });
    }

    return { datasets };
  });

  const options = {
    animation: false,
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
    <div class="chart-container main-chart">
      <Scatter data={chartData()} options={options} />
    </div>
  );
};