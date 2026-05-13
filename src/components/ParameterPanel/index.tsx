import { For, createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import { state, setParameter, addRKTerm, removeRKTerm, addTransition, removeTransition } from '../../store/fitStore';
import { Katex } from '../Katex';

function getParamMeta(name: string): { label: string; unit: string } {
  if (name === 'Tfus_A')  return { label: 'T_{\\mathrm{fus},A}',  unit: '\\text{К}' };
  if (name === 'dHfus_A') return { label: '\\Delta H_{\\mathrm{fus},A}', unit: '\\text{Дж/моль}' };
  if (name === 'Tfus_B')  return { label: 'T_{\\mathrm{fus},B}',  unit: '\\text{К}' };
  if (name === 'dHfus_B') return { label: '\\Delta H_{\\mathrm{fus},B}', unit: '\\text{Дж/моль}' };

  const lhMatch = name.match(/^L(\d+)_H$/);
  if (lhMatch) return { label: `L_{${lhMatch[1]}}^{H}`, unit: '\\text{Дж/моль}' };

  const lsMatch = name.match(/^L(\d+)_S$/);
  if (lsMatch) return { label: `L_{${lsMatch[1]}}^{S}`, unit: '\\text{Дж/(моль{\\cdot}К)}' };

  const ttaMatch = name.match(/^Ttrans_A_(\d+)$/);
  if (ttaMatch) return { label: `T_{\\mathrm{tr},A,${ttaMatch[1]}}`, unit: '\\text{К}' };

  const dhtaMatch = name.match(/^dHtrans_A_(\d+)$/);
  if (dhtaMatch) return { label: `\\Delta H_{\\mathrm{tr},A,${dhtaMatch[1]}}`, unit: '\\text{Дж/моль}' };

  const ttbMatch = name.match(/^Ttrans_B_(\d+)$/);
  if (ttbMatch) return { label: `T_{\\mathrm{tr},B,${ttbMatch[1]}}`, unit: '\\text{К}' };

  const dhtbMatch = name.match(/^dHtrans_B_(\d+)$/);
  if (dhtbMatch) return { label: `\\Delta H_{\\mathrm{tr},B,${dhtbMatch[1]}}`, unit: '\\text{Дж/моль}' };

  return { label: name, unit: '' };
}

export const ParameterPanel: Component = () => {
  return (
    <div class="parameter-panel">
      <h3>Параметры</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>Параметр</th>
            <th>Ед.</th>
            <th>Значение</th>
            <th>Фикс.</th>
            <th>Min</th>
            <th>Max</th>
          </tr>
        </thead>
        <tbody>
          <For each={state.parameters}>
            {(p, i) => {
              const meta = createMemo(() => getParamMeta(p.name));
              return (
                <tr>
                  <td><Katex math={meta().label} /></td>
                  <td><Katex math={meta().unit} /></td>
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
              );
            }}
          </For>
        </tbody>
      </table>
      <div class="actions">
        <button class="btn-primary" onClick={addRKTerm} disabled={state.isRunning}>
          + пара <Katex math="L_v^H, L_v^S" />
        </button>
        <button class="btn-primary" onClick={removeRKTerm} disabled={state.isRunning}>
          − пара <Katex math="L_v" />
        </button>
      </div>
      <div class="actions mt-3">
        <button class="btn-primary" onClick={() => addTransition('A')} disabled={state.isRunning}>+ Переход A</button>
        <button class="btn-primary" onClick={() => removeTransition('A')} disabled={state.isRunning}>− Переход A</button>
        <button class="btn-primary" onClick={() => addTransition('B')} disabled={state.isRunning}>+ Переход B</button>
        <button class="btn-primary" onClick={() => removeTransition('B')} disabled={state.isRunning}>− Переход B</button>
      </div>
    </div>
  );
};
