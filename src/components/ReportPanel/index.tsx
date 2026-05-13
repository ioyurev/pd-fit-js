import { createMemo, For } from 'solid-js';
import type { Component } from 'solid-js';
import { state, getLiquidusTableData } from '../../store/fitStore';
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

  const exportParams = () => {
    const errors = paramErrors();
    const lines = [
      'Параметр,Значение,Погрешность,Фиксирован',
      ...state.parameters.map(p => {
        const err = p.fixed ? 'фикс.' : (errors[p.name] !== undefined ? errors[p.name].toFixed(6) : '—');
        return `${p.name},${p.value.toFixed(6)},${err},${p.fixed ? 'да' : 'нет'}`;
      }),
      '',
      `chi2,${state.chiSq.toFixed(6)},,`,
      `Rwp,${(state.rwpVal * 100).toFixed(4)}%,,`,
    ];
    downloadCSV('parameters.csv', lines.join('\r\n'));
  };

  const exportLiquidus = () => {
    const rows = getLiquidusTableData();
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
  };

  return (
    <div class="report-panel">
      <h3>Итоговые параметры</h3>
      <table class="data-table">
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
                <td>{p.value.toFixed(4)}</td>
                <td>
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

      <div class="export-section">
        <h4>Статистика подгонки</h4>
        <dl>
          <dt><Katex math="\chi^2" /></dt>
          <dd>{state.chiSq.toFixed(4)}</dd>
          <dt><Katex math="R_{wp}" /></dt>
          <dd>{(state.rwpVal * 100).toFixed(2)}%</dd>
        </dl>
      </div>

      <div class="actions">
        <button onClick={exportParams} class="btn-export" disabled={state.isRunning}>
          ⬇ Параметры (CSV)
        </button>
        <button onClick={exportLiquidus} class="btn-export" disabled={state.isRunning}>
          ⬇ Ликвидус (CSV)
        </button>
      </div>

      <button onClick={shareURL} class="btn-share mt-3" disabled={state.isRunning}>
        Поделиться (копировать URL)
      </button>
    </div>
  );
};
