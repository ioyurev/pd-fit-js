import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import { state, runRefinement, setLossType, setHuberBeta } from '@/store/fitStore';
import type { LossType } from '@/lib/numerics';

export const RefinementControl: Component = () => {
  return (
    <div class="refinement-control">
      <p class="hint-text">
        Снимите флажок «Фикс.» у параметров, которые нужно уточнить.
      </p>

      {/* ── Выбор функции потерь ── */}
      <div style="margin-bottom: 0.6rem;">
        <label style="display: flex; align-items: center; gap: 6px; font-size: 0.82rem;">
          <span style="min-width: 80px; color: var(--text-muted);">Потери:</span>
          <select
            class="select-sm"
            style="flex: 1;"
            value={state.lossType}
            disabled={state.isRunning}
            onChange={e => setLossType(e.currentTarget.value as LossType)}
          >
            <option value="L2">L2 (стандартная χ²)</option>
            <option value="huber">Huber (робастная)</option>
          </select>
        </label>

        <Show when={state.lossType === 'huber'}>
          <label style="display: flex; align-items: center; gap: 6px; font-size: 0.82rem; margin-top: 4px;">
            <span style="min-width: 80px; color: var(--text-muted);">β (порог):</span>
            <input
              type="number"
              class="num-input"
              style="width: 80px;"
              step="1"
              min="0.1"
              value={state.huberBeta}
              disabled={state.isRunning}
              onInput={e => {
                const v = e.currentTarget.valueAsNumber;
                if (Number.isFinite(v) && v > 0) setHuberBeta(v);
              }}
            />
            <span style="font-size: 0.75rem; color: var(--text-muted);">K</span>
          </label>
          <p class="hint-text" style="margin-top: 2px; font-size: 0.72rem;">
            Точки с |ΔT| {'>'} β штрафуются линейно, а не квадратично.
            Рекомендуется β ≈ 2–3 × RMSE.
          </p>
        </Show>
      </div>

      <button
        class="run-btn"
        onClick={runRefinement}
        disabled={state.isRunning || state.dataPoints.length === 0}
      >
        {state.isRunning ? 'Выполняется...' : '\u25B6 Запустить уточнение'}
      </button>
    </div>
  );
};
