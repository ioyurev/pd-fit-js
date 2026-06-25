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
import { tempUnit } from '@/store/unitsStore';
import { mapDatasetsTemperature, unitLabel, toDisplay } from '@/lib/temperatureUnits';

Chart.register(
  Title, Tooltip, Legend, Colors,
  LinearScale, PointElement, LineElement,
  ScatterController, LineController,
);

export const DiagramPlot: Component = () => {
  const chartData = createMemo(() => {
    const { dataPoints, parameters, systemType, compAName, compBName, compoundNames } = state;
    const raw = buildDiagramDatasets(
      dataPoints, parameters, systemType, compAName, compBName, compoundNames,
    );
    const unit = tempUnit();
    return {
      ...raw,
      datasets: mapDatasetsTemperature(raw.datasets, unit),
      yMin: raw.yMin !== undefined ? toDisplay(raw.yMin, unit) : undefined,
    };
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
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            color: textColor,
            filter: (legendItem: any, data: any) => {
              const ds = data?.datasets?.[legendItem.datasetIndex];
              return ds?.pdLegend !== false;
            },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx: any) => `${ctx.dataset.label}: (${ctx.parsed.x.toFixed(3)}, ${ctx.parsed.y.toFixed(1)} ${unitLabel(tempUnit())})`,
          },
        },
      },
      scales: {
        x: { title: { display: true, text: `x(${state.compBName})`, color: textColor }, min: 0, max: 1, grid: { color: gridColor }, ticks: { color: textColor } },
        y: {
          title: { display: true, text: `T (${unitLabel(tempUnit())})`, color: textColor },
          grid: { color: gridColor },
          ticks: { color: textColor },
          min: chartData().yMin,
        },
      },
    };
  });

  return (
    <div class="chart-container main-chart">
      <Scatter data={chartData()} options={options()} />
    </div>
  );
};
