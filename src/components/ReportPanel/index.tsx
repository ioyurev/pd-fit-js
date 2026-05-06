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
      // Error is sqrt of diagonal element of covariance matrix
      const variance = covMatrix[i][i];
      errors[p.name] = variance > 0 ? Math.sqrt(variance) : 0;
    });
    
    return errors;
  });

  return (
    <div class="report-panel">
      <h3>Итоговые параметры</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="text-align: left; border-bottom: 1px solid #ddd;">
            <th style="padding: 8px;">Параметр</th>
            <th style="padding: 8px;">Значение</th>
            <th style="padding: 8px;">Погрешность</th>
          </tr>
        </thead>
        <tbody>
          <For each={state.parameters}>
            {(p) => (
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px;">{p.name}</td>
                <td style="padding: 8px;">{p.value.toFixed(4)}</td>
                <td style="padding: 8px;">
                  {p.fixed 
                    ? <span style="color: #999;">фикс.</span> 
                    : (paramErrors()[p.name] !== undefined ? paramErrors()[p.name].toFixed(4) : '—')}
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>

      <button 
        onClick={shareURL}
        style="margin-top: 20px; padding: 10px; background: #2ecc71; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;"
      >
        Поделиться (копировать URL)
      </button>
    </div>
  );
};
