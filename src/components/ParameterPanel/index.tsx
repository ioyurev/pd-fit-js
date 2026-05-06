import { For } from 'solid-js';
import type { Component } from 'solid-js';
import { state, setParameter, addRKTerm, removeRKTerm } from '../../store/fitStore';

export const ParameterPanel: Component = () => {
  return (
    <div class="parameter-panel">
      <h3>Параметры</h3>
      <table>
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
                    value={p.value}
                    onInput={(e) => setParameter(i(), 'value', parseFloat(e.currentTarget.value))}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={p.fixed}
                    onChange={(e) => setParameter(i(), 'fixed', e.currentTarget.checked)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={p.min}
                    onInput={(e) => setParameter(i(), 'min', parseFloat(e.currentTarget.value))}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={p.max}
                    onInput={(e) => setParameter(i(), 'max', parseFloat(e.currentTarget.value))}
                  />
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
      <div class="actions">
        <button onClick={addRKTerm}>Добавить L_v</button>
        <button onClick={removeRKTerm}>Удалить L_v</button>
      </div>
    </div>
  );
};