import { createMemo, For } from 'solid-js';
import type { Component } from 'solid-js';
import { state } from '@/store/fitStore';
import { Katex } from '@/components/Katex';
import { tempUnit } from '@/store/unitsStore';
import { unitLabel } from '@/lib/temperatureUnits';
import {
  selectParamErrors,
  formatChiSqWithDelta,
  formatRwpWithDelta,
  getLiquidusTableData,
} from '@/store/fitSelectors';
import {
  exportParamsCSV,
  exportParamsXLSX,
  exportLiquidusCSV,
  exportLiquidusXLSX,
} from '@/lib/reportExport';
import { formatLLMText } from '@/lib/llmExport';
import { addToast } from '@/store/toastStore';

export const ReportPanel: Component = () => {
  const shareURL = () => {
    navigator.clipboard.writeText(window.location.href);
    addToast('Ссылка скопирована в буфер обмена.', 'success', 3000);
  };

  const handleCopyLLM = () => {
    try {
      const text = formatLLMText(
        state.dataPoints,
        state.parameters,
        state.chiSq,
        state.rwpVal,
        state.corrWarnings,
        tempUnit(),
        state.residuals,
      );
      navigator.clipboard.writeText(text);
      addToast('Данные скопированы для LLM.', 'success', 3000);
    } catch (e) {
      console.error(e);
      addToast('Ошибка копирования.', 'error', 4000);
    }
  };

  const paramErrors = createMemo(selectParamErrors);
  const chiSqWithDelta = createMemo(formatChiSqWithDelta);
  const rwpWithDelta = createMemo(formatRwpWithDelta);

  const exportParams = (format: 'csv' | 'xlsx') => {
    const errors = paramErrors();
    if (format === 'csv') {
      exportParamsCSV(state.parameters, errors, state.chiSq, state.rwpVal);
    } else {
      exportParamsXLSX(state.parameters, errors, state.chiSq, state.rwpVal);
    }
  };

  const exportLiquidus = (format: 'csv' | 'xlsx') => {
    const rows = getLiquidusTableData();
    const unit = tempUnit();
    if (format === 'csv') {
      exportLiquidusCSV(rows, unit);
    } else {
      exportLiquidusXLSX(rows, unit);
    }
  };

  return (
    <div class="report-panel">
      {/* Статистика */}
      <div class="report-stats">
        <div class="stat-item" style="flex-direction: column; align-items: flex-start; gap: 0;">
          <span class="stat-label"><Katex math="\chi^2" /></span>
          <span class="stat-value" style="font-size: 0.85rem; white-space: nowrap;">{chiSqWithDelta()}</span>
        </div>
        <div class="stat-item" style="flex-direction: column; align-items: flex-start; gap: 0; margin-top: 0.5rem;">
          <span class="stat-label"><Katex math="R_{wp}" /></span>
          <span class="stat-value" style="font-size: 0.85rem; white-space: nowrap;">{rwpWithDelta()}</span>
        </div>
        <div class="stat-item" style="flex-direction: column; align-items: flex-start; gap: 0; margin-top: 0.4rem;">
          <span class="stat-label">RMSE</span>
          <span class="stat-value" style="font-size: 0.85rem; white-space: nowrap;">{state.rmseVal.toFixed(3)} {unitLabel(tempUnit())}</span>
        </div>
        <div class="stat-item" style="flex-direction: column; align-items: flex-start; gap: 0; margin-top: 0.4rem;">
          <span class="stat-label">R²</span>
          <span class="stat-value" style="font-size: 0.85rem; white-space: nowrap;">{state.r2Val.toFixed(5)}</span>
        </div>
        <div class="stat-item" style="flex-direction: column; align-items: flex-start; gap: 0; margin-top: 0.4rem;">
          <span class="stat-label">Loss</span>
          <span class="stat-value" style="font-size: 0.78rem; white-space: nowrap;">
            {state.lossType === 'huber' ? `Huber (β=${state.huberBeta})` : 'L2'}
          </span>
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
              <th>Изменение (Δ)</th>
              <th><Katex math="\pm\,\sigma" /></th>
            </tr>
          </thead>
          <tbody>
            <For each={state.parameters}>
              {(p) => {
                const prev = createMemo(() => state.prevParameters?.find(x => x.name === p.name));
                const delta = createMemo(() => prev() ? p.value - prev()!.value : null);

                return (
                  <tr>
                    <td><code>{p.name}</code></td>
                    <td class="num-cell">{p.value.toFixed(4)}</td>
                    <td class="num-cell" style="font-weight: 500;">
                      {delta() !== null && Math.abs(delta()!) > 1e-6 ? (
                        <span style={{ color: delta()! > 0 ? '#e74c3c' : '#2ecc71' }}>
                          {delta()! > 0 ? '+' : ''}{delta()!.toFixed(4)}
                        </span>
                      ) : (
                        <span class="text-muted">—</span>
                      )}
                    </td>
                    <td class="num-cell">
                      {p.fixed
                        ? <span class="text-muted">фикс.</span>
                        : (paramErrors()[p.name] !== undefined
                            ? `± ${paramErrors()[p.name].toFixed(4)}`
                            : '—')}
                    </td>
                  </tr>
                );
              }}
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
        <div style="display: flex; gap: 4px;">
          <button onClick={shareURL} class="btn-share-sm" style="flex: 1;" disabled={state.isRunning}>
            🔗 URL
          </button>
          <button onClick={handleCopyLLM} class="btn-export" style="flex: 1; background: #8e44ad;" disabled={state.isRunning}>
            📋 LLM
          </button>
        </div>
      </div>
    </div>
  );
};
