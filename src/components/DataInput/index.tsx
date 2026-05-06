import { For } from 'solid-js';
import type { Component } from 'solid-js';
import { state, addDataPoint, removeDataPoint, updateDataPoint } from '../../store/fitStore';

export const DataInput: Component = () => {
  return (
    <div class="data-input">
      <h3>Экспериментальные данные</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="text-align: left; border-bottom: 1px solid #ddd;">
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
                    style="width: 60px"
                    value={p.xA}
                    onInput={(e) => updateDataPoint(i(), 'xA', parseFloat(e.currentTarget.value))}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="1"
                    style="width: 80px"
                    value={p.T}
                    onInput={(e) => updateDataPoint(i(), 'T', parseFloat(e.currentTarget.value))}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    style="width: 50px"
                    value={p.sigma}
                    onInput={(e) => updateDataPoint(i(), 'sigma', parseFloat(e.currentTarget.value))}
                  />
                </td>
                <td style="font-size: 0.8rem; color: #666;">{p.branch}</td>
                <td>
                  <button 
                    onClick={() => removeDataPoint(i())}
                    style="background: #e74c3c; color: white; border: none; border-radius: 4px; padding: 2px 6px; cursor: pointer;"
                  >×</button>
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
      <button 
        onClick={addDataPoint}
        style="margin-top: 10px; padding: 5px 10px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;"
      >Добавить точку</button>
    </div>
  );
};
