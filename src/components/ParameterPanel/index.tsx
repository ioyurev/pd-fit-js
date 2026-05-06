import { For } from 'solid-js';
import type { Component } from 'solid-js';
import { state, setParameter, addRKTerm, removeRKTerm } from '../../store/fitStore';

export const ParameterPanel: Component = () => {
  return (
    <div class="parameter-panel">
      <h3>Параметры</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>Имя</th>
            <th>Значение</th>
            <th>Фикс.</th>
            <th>Min</th>
            <th>Max</th>
          </tr>
        </thead>
        <tbody>
          <For each={state.parameters}>
            {(p, i) => (
              <tr>
                <td>{p.name}</td>
                <td>
                  <input
                    type="number"
                    class="num-input input-md"
                    value={p.value}
                    disabled={state.isRunning}
                    onInput={(e) => setParameter(i(), 'value', parseFloat(e.currentTarget.value))}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={p.fixed}
                    disabled={state.isRunning}
                    onChange={(e) => setParameter(i(), 'fixed', e.currentTarget.checked)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    class="num-input input-md"
                    value={p.min}
                    disabled={state.isRunning}
                    onInput={(e) => setParameter(i(), 'min', parseFloat(e.currentTarget.value))}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    class="num-input input-md"
                    value={p.max}
                    disabled={state.isRunning}
                    onInput={(e) => setParameter(i(), 'max', parseFloat(e.currentTarget.value))}
                  />
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
      <div class="actions">
        <button class="btn-primary" onClick={addRKTerm} disabled={state.isRunning}>Добавить пару L_v (H, S)</button>
        <button class="btn-primary" onClick={removeRKTerm} disabled={state.isRunning}>Удалить пару L_v (H, S)</button>
      </div>
    </div>
  );
};
