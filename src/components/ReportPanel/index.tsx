import { createMemo, For } from 'solid-js';
import type { Component } from 'solid-js';
import { utils, writeFile } from 'xlsx';
import { state, getLiquidusTableData, toggleLog } from '../../store/fitStore';
import { Katex } from '../Katex';

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const ReportPanel: Component = () => {
  const shareURL = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Ссылка скопирована в буфер обмена');
  };

  const paramErrors = createMemo(() => {
    const { covMatrix, parameters } = state;
    if (!covMatrix || covMatrix.length === 0) return {};
    const errors: Record<string, number> = {};
    const freeParams = parameters.filter(p => !p.fixed);
    freeParams.forEach((p, i) => {
      const variance = covMatrix[i][i];
      errors[p.name] = variance > 0 ? Math.sqrt(variance) : 0;
    });
    return errors;
  });

  const exportParams = (format: 'csv' | 'xlsx') => {
    const errors = paramErrors();
    if (format === 'csv') {
      const lines = [
        'Параметр,Значение,Погрешность,Фиксирован',
        ...state.parameters.map(p => {
          const err = p.fixed
            ? 'фикс.'
            : (errors[p.name] !== undefined ? errors[p.name].toFixed(6) : '—');
          return `${p.name},${p.value.toFixed(6)},${err},${p.fixed ? 'да' : 'нет'}`;
        }),
        '',
        `chi2,${state.chiSq.toFixed(6)},,`,
        `Rwp,${(state.rwpVal * 100).toFixed(4)}%,,`,
      ];
      downloadCSV('parameters.csv', lines.join('\r\n'));
    } else {
      const data = state.parameters.map(p => ({
        'Параметр': p.name,
        'Значение': p.value,
        'Погрешность': p.fixed ? 'фикс.' : (errors[p.name] !== undefined ? errors[p.name] : null),
        'Фиксирован': p.fixed ? 'да' : 'нет'
      }));
      const ws = utils.json_to_sheet(data);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'Parameters');
      utils.sheet_add_aoa(ws, [
        [],
        ['chi2', state.chiSq],
        ['Rwp (%)', state.rwpVal * 100]
      ], { origin: -1 });
      writeFile(wb, 'parameters.xlsx');
    }
  };

  const exportLiquidus = (format: 'csv' | 'xlsx') => {
    const rows = getLiquidusTableData();
    if (format === 'csv') {
      const lines = [
        'xB,T_liquidus_A (K),T_liquidus_B (K),T_liquidus (K)',
        ...rows.map(r =>
          [
            r.xB.toFixed(4),
            r.T_A !== null ? r.T_A.toFixed(4) : '',
            r.T_B !== null ? r.T_B.toFixed(4) : '',
            r.T_liq.toFixed(4),
          ].join(',')
        ),
      ];
      downloadCSV('liquidus.csv', lines.join('\r\n'));
    } else {
      const data = rows.map(r => ({
        'xB': r.xB,
        'T_liquidus_A (K)': r.T_A,
        'T_liquidus_B (K)': r.T_B,
        'T_liquidus (K)': r.T_liq
      }));
      const ws = utils.json_to_sheet(data);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'Liquidus');
      writeFile(wb, 'liquidus.xlsx');
    }
  };

  return (
    <div class="report-panel">
      {/* Статистика */}
      <div class="report-stats">
        <div class="stat-item">
          <span class="stat-label"><Katex math="\chi^2" /></span>
          <span class="stat-value">{state.chiSq.toFixed(4)}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label"><Katex math="R_{wp}" /></span>
          <span class="stat-value">{(state.rwpVal * 100).toFixed(2)}%</span>
        </div>
        <div class="stat-item stat-warnings">
          {state.corrWarnings.length > 0 && (
            <span class="warn-badge" title={state.corrWarnings.join('\n')}>
              ⚠ {state.corrWarnings.length} корреляций
            </span>
          )}
        </div>
      </div>

      {/* Таблица параметров */}
      <div class="report-params-wrap">
        <table class="data-table report-table">
          <thead>
            <tr>
              <th>Параметр</th>
              <th>Значение</th>
              <th><Katex math="\pm\,\sigma" /></th>
            </tr>
          </thead>
          <tbody>
            <For each={state.parameters}>
              {(p) => (
                <tr>
                  <td><code>{p.name}</code></td>
                  <td class="num-cell">{p.value.toFixed(4)}</td>
                  <td class="num-cell">
                    {p.fixed
                      ? <span class="text-muted">фикс.</span>
                      : (paramErrors()[p.name] !== undefined
                          ? `± ${paramErrors()[p.name].toFixed(4)}`
                          : '—')}
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>

      {/* Действия */}
      <div class="report-actions">
        <div style="display: flex; gap: 4px;">
          <button onClick={() => exportParams('csv')} class="btn-export" style="flex: 1;" disabled={state.isRunning}>
            CSV
          </button>
          <button onClick={() => exportParams('xlsx')} class="btn-export" style="flex: 1; background: #27ae60;" disabled={state.isRunning}>
            XLSX
          </button>
        </div>
        <div style="display: flex; gap: 4px;">
          <button onClick={() => exportLiquidus('csv')} class="btn-export" style="flex: 1;" disabled={state.isRunning}>
            Liq CSV
          </button>
          <button onClick={() => exportLiquidus('xlsx')} class="btn-export" style="flex: 1; background: #27ae60;" disabled={state.isRunning}>
            Liq XLSX
          </button>
        </div>
        <button onClick={shareURL} class="btn-share-sm" disabled={state.isRunning}>
          🔗 URL
        </button>
        <button onClick={toggleLog} class="btn-log">
          📋 Лог ({state.log.length})
        </button>
      </div>
    </div>
  );
};
