import { createMemo, For } from 'solid-js';
import type { Component } from 'solid-js';
import { state } from '../../store/fitStore';

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

  return (
    <div class="report-panel">
      <h3>Итоговые параметры</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>Параметр</th>
            <th>Значение</th>
            <th>Погрешность</th>
          </tr>
        </thead>
        <tbody>
          <For each={state.parameters}>
            {(p) => (
              <tr>
                <td>{p.name}</td>
                <td>{p.value.toFixed(4)}</td>
                <td>
                  {p.fixed 
                    ? <span class="text-muted">фикс.</span> 
                    : (paramErrors()[p.name] !== undefined ? paramErrors()[p.name].toFixed(4) : '—')}
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>

      <button 
        onClick={shareURL}
        class="btn-share mt-3"
        disabled={state.isRunning}
      >
        Поделиться (копировать URL)
      </button>
    </div>
  );
};