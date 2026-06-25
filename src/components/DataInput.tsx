import { For, Show, createMemo, createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import {
  state,
  removeDataPoint,
  updateDataPoint,
  addDataPointWithBranch,
  removeDataPointsByBranch,
} from '@/store/fitStore';
import type { DataPoint } from '@/store/fitStore';
import { encodeBranch, decodeBranch } from '@/lib/types';
import type { BranchDef } from '@/lib/types';
import { buildBranchOptions } from '@/lib/branchCatalog';
import { tempUnit } from '@/store/unitsStore';
import { toDisplay, fromDisplay, unitLabel } from '@/lib/temperatureUnits';

interface DataPointGroupView {
  branchKey: string;
  branch: BranchDef;
  label: string;
  entries: Array<{ point: DataPoint; index: number }>;
}

export const DataInput: Component = () => {
  const branchOptions = createMemo(() =>
    buildBranchOptions(
      state.parameters, state.systemType,
      state.compAName, state.compBName, state.compoundNames,
    )
  );

  let newGroupSelectRef: HTMLSelectElement | undefined;

  const [collapsedKeys, setCollapsedKeys] = createSignal<Set<string>>(new Set());

  const toggleCollapse = (key: string) => {
    setCollapsedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const groups = createMemo((): DataPointGroupView[] => {
    const opts = branchOptions();
    const orderMap = new Map(opts.map((o, i) => [o.value, i]));
    const map = new Map<string, DataPointGroupView>();

    state.dataPoints.forEach((point, index) => {
      const key = encodeBranch(point.branch);
      if (!map.has(key)) {
        const opt = opts.find(o => o.value === key);
        map.set(key, {
          branchKey: key,
          branch: point.branch,
          label: opt?.label ?? key,
          entries: [],
        });
      }
      map.get(key)!.entries.push({ point, index });
    });

    return [...map.values()].sort((a, b) =>
      (orderMap.get(a.branchKey) ?? 999) - (orderMap.get(b.branchKey) ?? 999)
    );
  });

  const handleAddGroup = () => {
    if (!newGroupSelectRef) return;
    addDataPointWithBranch(decodeBranch(newGroupSelectRef.value));
  };

  const unit = () => tempUnit();

  const getResidual = (index: number): string => {
    const r = state.residuals[index];
    return Number.isFinite(r) ? r.toFixed(1) : '—';
  };

  return (
    <div class="data-input">
      <h3 style="margin-bottom: 10px;">Экспериментальные данные</h3>

      <For each={groups()}>
        {(group) => {
          const collapsed = () => collapsedKeys().has(group.branchKey);
          return (
            <div class="data-group">
              <div
                class="data-group-header"
                onClick={() => toggleCollapse(group.branchKey)}
              >
                <span class="data-group-chevron">
                  {collapsed() ? '▸' : '▾'}
                </span>
                <span class="data-group-label">{group.label}</span>
                <span class="data-group-count">{group.entries.length}</span>
                <button
                  class="btn-delete"
                  disabled={state.isRunning}
                  title="Удалить все точки этой группы"
                  onClick={e => {
                    e.stopPropagation();
                    removeDataPointsByBranch(group.branchKey);
                  }}
                >×</button>
              </div>
              <Show when={!collapsed()}>
                <table class="data-table data-table-compact">
                  <thead>
                    <tr>
                      <th>x</th>
                      <th>T ({unitLabel(unit())})</th>
                      <th>σ</th>
                      <th>ΔT</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={group.entries}>
                      {(entry) => (
                        <tr>
                          <td>
                            <input type="number" step="0.01"
                              class="num-input input-sm"
                              value={entry.point.xB}
                              disabled={state.isRunning}
                              onInput={e => {
                                const v = e.currentTarget.valueAsNumber;
                                if (Number.isFinite(v))
                                  updateDataPoint(entry.index, 'xB', v);
                              }}
                            />
                          </td>
                          <td>
                            <input type="number" step="1"
                              class="num-input input-md"
                              value={toDisplay(entry.point.T, unit()).toFixed(1)}
                              disabled={state.isRunning}
                              onInput={e => {
                                const v = e.currentTarget.valueAsNumber;
                                if (Number.isFinite(v))
                                  updateDataPoint(entry.index, 'T', fromDisplay(v, unit()));
                              }}
                            />
                          </td>
                          <td>
                            <input type="number" step="0.1"
                              class="num-input input-xs"
                              value={entry.point.sigma}
                              disabled={state.isRunning}
                              onInput={e => {
                                const v = e.currentTarget.valueAsNumber;
                                if (Number.isFinite(v))
                                  updateDataPoint(entry.index, 'sigma', v);
                              }}
                            />
                          </td>
                          <td class="residual-cell">{getResidual(entry.index)}</td>
                          <td>
                            <button class="btn-delete"
                              disabled={state.isRunning}
                              onClick={() => removeDataPoint(entry.index)}
                            >×</button>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
                <button class="btn-primary btn-add-point"
                  disabled={state.isRunning}
                  onClick={() => addDataPointWithBranch(group.branch)}
                >+ Точку</button>
              </Show>
            </div>
          );
        }}
      </For>

      <div class="data-add-group">
        <select class="select-sm" style="flex: 1;"
          ref={newGroupSelectRef}
          disabled={state.isRunning}
        >
          <For each={branchOptions()}>
            {opt => <option value={opt.value}>{opt.label}</option>}
          </For>
        </select>
        <button class="btn-primary"
          disabled={state.isRunning}
          onClick={handleAddGroup}
        >+ Группу</button>
      </div>
    </div>
  );
};
