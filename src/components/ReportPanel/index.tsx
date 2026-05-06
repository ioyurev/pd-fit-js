import type { Component } from 'solid-js';
import { state } from '../../store/fitStore';

export const ReportPanel: Component = () => {
  const exportParameters = () => {
    const data = JSON.stringify(state.parameters, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'parameters.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const header = 'xA,T_obs,T_calc,Residual,Branch\n';
    const pts = state.dataPoints.filter(p => p.branch !== 'eutectic');
    const rows = pts.map((p, i) => {
      const calcT = state.calcT[i] || 0;
      return `${p.xA},${p.T},${calcT.toFixed(4)},${(p.T - calcT).toFixed(4)},${p.branch}`;
    }).join('\n');
    
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fit_results.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div class="report-panel">
      <h3>Отчёт и экспорт</h3>
      <div class="actions">
        <button onClick={exportParameters}>Скачать параметры (JSON)</button>
        <button onClick={exportCSV}>Скачать таблицу (CSV)</button>
      </div>
    </div>
  );
};