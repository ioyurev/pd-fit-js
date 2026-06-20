import { For, createMemo, createSignal, Show } from 'solid-js';
import type { Component } from 'solid-js';
import {
  state,
  setParameter,
  setSystemType,
  addRKTerm,
  removeRKTerm,
  addTransition,
  removeTransition,
  addCompound,
  removeCompound,
} from '@/store/fitStore';
import { Katex } from '@/components/Katex';
import { getParameterMeta, isStoichParameter } from '@/lib/parameterSchema';

export const ParameterPanel: Component = () => {
  const [showBounds, setShowBounds] = createSignal(false);

  return (
    <div class="parameter-panel">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; gap:8px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <h3 style="margin:0;">Параметры</h3>
          <select
            style="font-size:0.75rem; padding:2px 4px; border:1px solid #ccc; border-radius:3px;"
            disabled={state.isRunning}
            value={state.systemType}
            onChange={e => setSystemType(e.currentTarget.value as any)}
          >
            <option value="eutectic">Эвтектика</option>
            <option value="isomorphous">Линза</option>
          </select>
        </div>
        <button
          class="btn-primary"
          style="font-size:0.75rem; padding:3px 8px; background:#95a5a6;"
          onClick={() => setShowBounds(v => !v)}
        >
          {showBounds() ? 'Скрыть Min/Max' : 'Min/Max'}
        </button>
      </div>

      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Параметр</th>
              <th>Ед.</th>
              <th>Значение</th>
              <th title="Фиксировать">Фикс.</th>
              <th title="Включить ограничения">Огр.</th>
              {showBounds() && <th>Min</th>}
              {showBounds() && <th>Max</th>}
            </tr>
          </thead>
          <tbody>
            <For each={state.parameters}>
              {(p, i) => {
                const meta = createMemo(() => getParameterMeta(p.name));
                const isStoich = isStoichParameter(p.name);
                return (
                  <tr>
                    <td><Katex math={meta().label} /></td>
                    <td style="font-size:0.75rem;"><Katex math={meta().unit} /></td>
                    <td>
                      <input
                        type="number"
                        class="num-input input-md"
                        value={p.value}
                        disabled={state.isRunning}
                        onInput={e => {
                          const v = e.currentTarget.valueAsNumber;
                          if (Number.isFinite(v)) setParameter(i(), 'value', v);
                        }}
                      />
                    </td>
                    <td style="text-align:center;">
                      <input
                        type="checkbox"
                        checked={p.fixed}
                        disabled={state.isRunning || isStoich}
                        title={isStoich ? 'Стехиометрия фиксирована' : undefined}
                        onChange={e =>
                          setParameter(i(), 'fixed', e.currentTarget.checked)
                        }
                      />
                    </td>
                    <td style="text-align:center;">
                      <input
                        type="checkbox"
                        checked={p.boundsEnabled ?? false}
                        disabled={state.isRunning || p.fixed}
                        onChange={e =>
                          setParameter(i(), 'boundsEnabled', e.currentTarget.checked)
                        }
                      />
                    </td>
                    {showBounds() && (
                      <td>
                        <input
                          type="number"
                          class="num-input input-md"
                          value={p.min}
                          disabled={state.isRunning || !p.boundsEnabled}
                          onInput={e => {
                            const v = e.currentTarget.valueAsNumber;
                            if (Number.isFinite(v)) setParameter(i(), 'min', v);
                          }}
                        />
                      </td>
                    )}
                    {showBounds() && (
                      <td>
                        <input
                          type="number"
                          class="num-input input-md"
                          value={p.max}
                          disabled={state.isRunning || !p.boundsEnabled}
                          onInput={e => {
                            const v = e.currentTarget.valueAsNumber;
                            if (Number.isFinite(v)) setParameter(i(), 'max', v);
                          }}
                        />
                      </td>
                    )}
                  </tr>
                );
              }}
            </For>
          </tbody>
        </table>
      </div>

      {/* Параметры Редлиха–Кистера */}
      <div class="actions">
        <button class="btn-primary" onClick={addRKTerm} disabled={state.isRunning}>
          + <Katex math="L_v^H,\,L_v^S" />
        </button>
        <button class="btn-primary" onClick={removeRKTerm} disabled={state.isRunning}>
          − <Katex math="L_v" />
        </button>
      </div>

      {/* Полиморфные переходы */}
      <Show when={state.systemType === 'eutectic'}>
        <div class="actions">
          <button class="btn-primary" onClick={() => addTransition('A')} disabled={state.isRunning}>
            + Переход A
          </button>
          <button class="btn-primary" onClick={() => removeTransition('A')} disabled={state.isRunning}>
            − Переход A
          </button>
          <button class="btn-primary" onClick={() => addTransition('B')} disabled={state.isRunning}>
            + Переход B
          </button>
          <button class="btn-primary" onClick={() => removeTransition('B')} disabled={state.isRunning}>
            − Переход B
          </button>
        </div>
      </Show>

      {/* Соединения */}
      <Show when={state.systemType === 'eutectic'}>
        <div class="actions">
          <button
            class="btn-primary"
            style="background:#8e44ad;"
            onClick={addCompound}
            disabled={state.isRunning}
          >
            + Соединение
          </button>
          <button
            class="btn-primary"
            style="background:#8e44ad;"
            onClick={removeCompound}
            disabled={state.isRunning}
          >
            − Соединение
          </button>
        </div>
      </Show>
    </div>
  );
};
