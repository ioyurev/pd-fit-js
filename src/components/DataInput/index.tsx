import { For } from 'solid-js';
import type { Component } from 'solid-js';
import { state, addDataPoint, removeDataPoint, updateDataPoint } from '../../store/fitStore';

export const DataInput: Component = () => {
  return (
    <div class="data-input">
      <h3>Экспериментальные данные</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>xA</th>
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
                    class="num-input"
                    style="width: 60px"
                    value={p.xA}
                    disabled={state.isRunning}
                    onInput={(e) => updateDataPoint(i(), 'xA', parseFloat(e.currentTarget.value))}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="1"
                    class="num-input"
                    style="width: 80px"
                    value={p.T}
                    disabled={state.isRunning}
                    onInput={(e) => updateDataPoint(i(), 'T', parseFloat(e.currentTarget.value))}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    class="num-input"
                    style="width: 50px"
                    value={p.sigma}
                    disabled={state.isRunning}
                    onInput={(e) => updateDataPoint(i(), 'sigma', parseFloat(e.currentTarget.value))}
                  />
                </td>
                <td>
                  <select 
                    value={p.branch} 
                    disabled={state.isRunning}
                    onChange={(e) => updateDataPoint(i(), 'branch', e.currentTarget.value)}
                    style="font-size: 0.8rem;"
                  >
                    <option value="A">Ветвь A</option>
                    <option value="B">Ветвь B</option>
                    <option value="eutectic">Эвтектика</option>
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
        class="btn-primary"
        style="margin-top: 10px;"
        disabled={state.isRunning}
      >Добавить точку</button>
    </div>
  );
};
