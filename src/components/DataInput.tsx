import { For, createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import { state, addDataPoint, removeDataPoint, updateDataPoint, setComponentName } from '@/store/fitStore';
import { encodeBranch, decodeBranch } from '@/lib/types';
import { buildBranchOptions } from '@/lib/branchCatalog';

export const DataInput: Component = () => {
  const branchOptions = createMemo(() =>
    buildBranchOptions(state.parameters, state.systemType, state.compAName, state.compBName)
  );

  return (
    <div class="data-input">
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;">
        <h3>Экспериментальные данные</h3>
        <div style="display: flex; gap: 10px; font-size: 0.85rem;">
          <label style="display: flex; align-items: center; gap: 5px;">
            Фаза A:
            <input
              type="text"
              class="num-input"
              style="width: 70px;"
              value={state.compAName}
              onInput={e => setComponentName('A', e.currentTarget.value)}
            />
          </label>
          <label style="display: flex; align-items: center; gap: 5px;">
            Фаза B:
            <input
              type="text"
              class="num-input"
              style="width: 70px;"
              value={state.compBName}
              onInput={e => setComponentName('B', e.currentTarget.value)}
            />
          </label>
        </div>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>x({state.compBName})</th>
            <th>T (K)</th>
            <th>σ</th>
            <th>Ветвь</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <For each={state.dataPoints}>
            {(p, i) => (
              <tr>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    class="num-input input-sm"
                    value={p.xB}
                    disabled={state.isRunning}
                    onInput={e => {
                      const v = e.currentTarget.valueAsNumber;
                      if (Number.isFinite(v)) updateDataPoint(i(), 'xB', v);
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="1"
                    class="num-input input-md"
                    value={p.T}
                    disabled={state.isRunning}
                    onInput={e => {
                      const v = e.currentTarget.valueAsNumber;
                      if (Number.isFinite(v)) updateDataPoint(i(), 'T', v);
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    class="num-input input-xs"
                    value={p.sigma}
                    disabled={state.isRunning}
                    onInput={e => {
                      const v = e.currentTarget.valueAsNumber;
                      if (Number.isFinite(v)) updateDataPoint(i(), 'sigma', v);
                    }}
                  />
                </td>
                <td>
                  <select
                    class="select-sm"
                    disabled={state.isRunning}
                    value={encodeBranch(p.branch)}
                    onChange={e =>
                      updateDataPoint(i(), 'branch', decodeBranch(e.currentTarget.value))
                    }
                  >
                    <For each={branchOptions()}>
                      {opt => <option value={opt.value}>{opt.label}</option>}
                    </For>
                  </select>
                </td>
                <td>
                  <button
                    class="btn-delete"
                    disabled={state.isRunning}
                    onClick={() => removeDataPoint(i())}
                  >
                    ×
                  </button>
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
      <button
        class="btn-primary mt-3"
        disabled={state.isRunning}
        onClick={addDataPoint}
      >
        Добавить точку
      </button>
    </div>
  );
};
