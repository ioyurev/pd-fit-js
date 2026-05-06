import { For } from 'solid-js';
import type { Component } from 'solid-js';
import { state } from '../../store/fitStore';

export const StatisticsPanel: Component = () => {
  return (
    <div class="statistics-panel">
      <h3>Статистика</h3>
      <dl>
        <dt>χ²</dt>
        <dd>{state.chiSq.toFixed(4)}</dd>
        <dt>Rwp</dt>
        <dd>{(state.rwpVal * 100).toFixed(2)}%</dd>
      </dl>
      
      {state.corrWarnings.length > 0 && (
        <div class="warnings">
          <h4>Предупреждения</h4>
          <ul>
            <For each={state.corrWarnings}>
              {(w) => <li>{w}</li>}
            </For>
          </ul>
        </div>
      )}
    </div>
  );
};