import { For, createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import { state, addDataPoint, removeDataPoint, updateDataPoint } from '../../store/fitStore';

export const DataInput: Component = () => {
  // Динамически получаем существующие переходы для выпадающего списка
  const transABranches = createMemo(() => state.parameters.filter(p => p.name.startsWith('Ttrans_A_')).map(p => p.name));
  const transBBranches = createMemo(() => state.parameters.filter(p => p.name.startsWith('Ttrans_B_')).map(p => p.name));

  return (
    <div class="data-input">
      <h3>Экспериментальные данные</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>xB</th>
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
                    onInput={(e) => updateDataPoint(i(), 'xB', parseFloat(e.currentTarget.value))}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="1"
                    class="num-input input-md"
                    value={p.T}
                    disabled={state.isRunning}
                    onInput={(e) => updateDataPoint(i(), 'T', parseFloat(e.currentTarget.value))}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    class="num-input input-xs"
                    value={p.sigma}
                    disabled={state.isRunning}
                    onInput={(e) => updateDataPoint(i(), 'sigma', parseFloat(e.currentTarget.value))}
                  />
                </td>
                <td>
                  <select 
                    value={p.branch} 
                    disabled={state.isRunning}
                    class="select-sm"
                    onChange={(e) => updateDataPoint(i(), 'branch', e.currentTarget.value)}
                  >
                    <option value="A">Ветвь A</option>
                    <option value="B">Ветвь B</option>
                    <option value="eutectic">Эвтектика</option>
                    <For each={transABranches()}>
                      {(name) => <option value={name}>Переход A ({name.split('_')[2]})</option>}
                    </For>
                    <For each={transBBranches()}>
                      {(name) => <option value={name}>Переход B ({name.split('_')[2]})</option>}
                    </For>
                  </select>
                </td>
                <td>
                  <button 
                    onClick={() => removeDataPoint(i())}
                    class="btn-delete"
                    disabled={state.isRunning}
                  >×</button>
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
      <button 
        onClick={addDataPoint}
        class="btn-primary mt-3"
        disabled={state.isRunning}
      >Добавить точку</button>
    </div>
  );
};
