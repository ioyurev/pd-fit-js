import { For, Show, createMemo, createSignal, Switch, Match } from 'solid-js';
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
  setCompoundName,
  setComponentName,
} from '@/store/fitStore';
import { Katex } from '@/components/Katex';
import {
  getParameterMeta,
  getParameterShortLabel,
  isStoichParameter,
  isCompoundTfus,
  groupParameters,
} from '@/lib/parameterSchema';
import { tempUnit } from '@/store/unitsStore';
import { toDisplay, fromDisplay, unitLabelKatex, isTemperatureParameter } from '@/lib/temperatureUnits';

export const ParameterPanel: Component = () => {
  const [showBounds, setShowBounds] = createSignal(false);

  const colCount = () => showBounds() ? 7 : 5;

  const groups = createMemo(() =>
    groupParameters(
      state.parameters,
      state.systemType,
      state.compAName,
      state.compBName,
      state.compoundNames,
    )
  );

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
          <For each={groups()}>
            {(group) => (
              <tbody>
                <tr class="param-group-header">
                  <td colSpan={colCount()}>
                    <Switch fallback={<strong>{group.label}</strong>}>
                      <Match when={group.id === 'compA' || group.id === 'compB'}>
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <strong>Компонент:</strong>
                          <input
                            type="text"
                            class="num-input"
                            style="width: 110px; font-size: 0.8rem;"
                            value={group.id === 'compA' ? state.compAName : state.compBName}
                            disabled={state.isRunning}
                            onInput={e =>
                              setComponentName(
                                group.id === 'compA' ? 'A' : 'B',
                                e.currentTarget.value,
                              )
                            }
                          />
                        </div>
                      </Match>
                      <Match when={/^C\d+$/.test(group.id)}>
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <strong>{group.id}:</strong>
                          <input
                            type="text"
                            class="num-input"
                            style="width: 110px; font-size: 0.8rem;"
                            value={state.compoundNames[group.id] || group.id}
                            disabled={state.isRunning}
                            onInput={e => setCompoundName(group.id, e.currentTarget.value)}
                          />
                        </div>
                      </Match>
                    </Switch>
                  </td>
                </tr>
                <For each={group.entries}>
                  {(entry) => {
                    const p = entry.param;
                    const idx = entry.index;
                    const meta = createMemo(() => getParameterMeta(p.name));
                    const shortLabel = getParameterShortLabel(p.name);
                    const isStoich = isStoichParameter(p.name);
                    const isCompTfus = isCompoundTfus(p.name);
                    return (
                      <tr>
                        <td>
                          <Katex math={shortLabel} />
                          <Show when={isCompTfus}>
                            <span
                              title="Для соединений T_fus — модельный параметр фазы. При инконгруэнтном плавлении он может не совпадать с температурой наблюдаемой инварианты."
                              style="cursor: help; color: var(--text-muted); font-size: 0.75rem; margin-left: 4px;"
                            >
                              (ℹ)
                            </span>
                          </Show>
                        </td>
                        <td style="font-size:0.75rem;">
                          <Katex math={isTemperatureParameter(p.name) ? unitLabelKatex(tempUnit()) : meta().unit} />
                        </td>
                        <td>
                          <input
                            type="number"
                            class="num-input input-md"
                            value={
                              isTemperatureParameter(p.name)
                                ? toDisplay(p.value, tempUnit()).toFixed(1)
                                : p.value
                            }
                            disabled={state.isRunning}
                            onInput={e => {
                              const v = e.currentTarget.valueAsNumber;
                              if (Number.isFinite(v)) {
                                setParameter(
                                  idx,
                                  'value',
                                  isTemperatureParameter(p.name) ? fromDisplay(v, tempUnit()) : v,
                                );
                              }
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
                              setParameter(idx, 'fixed', e.currentTarget.checked)
                            }
                          />
                        </td>
                        <td style="text-align:center;">
                          <input
                            type="checkbox"
                            checked={p.boundsEnabled ?? false}
                            disabled={state.isRunning || p.fixed}
                            onChange={e =>
                              setParameter(idx, 'boundsEnabled', e.currentTarget.checked)
                            }
                          />
                        </td>
                        {showBounds() && (
                          <td>
                            <input
                              type="number"
                              class="num-input input-md"
                              value={
                                isTemperatureParameter(p.name)
                                  ? toDisplay(p.min, tempUnit()).toFixed(1)
                                  : p.min
                              }
                              disabled={state.isRunning || !p.boundsEnabled}
                              onInput={e => {
                                const v = e.currentTarget.valueAsNumber;
                                if (Number.isFinite(v)) {
                                  setParameter(
                                    idx,
                                    'min',
                                    isTemperatureParameter(p.name) ? fromDisplay(v, tempUnit()) : v,
                                  );
                                }
                              }}
                            />
                          </td>
                        )}
                        {showBounds() && (
                          <td>
                            <input
                              type="number"
                              class="num-input input-md"
                              value={
                                isTemperatureParameter(p.name)
                                  ? toDisplay(p.max, tempUnit()).toFixed(1)
                                  : p.max
                              }
                              disabled={state.isRunning || !p.boundsEnabled}
                              onInput={e => {
                                const v = e.currentTarget.valueAsNumber;
                                if (Number.isFinite(v)) {
                                  setParameter(
                                    idx,
                                    'max',
                                    isTemperatureParameter(p.name) ? fromDisplay(v, tempUnit()) : v,
                                  );
                                }
                              }}
                            />
                          </td>
                        )}
                      </tr>
                    );
                  }}
                </For>
              </tbody>
            )}
          </For>
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
