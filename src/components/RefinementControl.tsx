import type { Component } from 'solid-js';
import { state, runRefinement } from '@/store/fitStore';

export const RefinementControl: Component = () => {
  return (
    <div class="refinement-control">
      <p class="hint-text">
        Снимите флажок «Фикс.» у параметров, которые нужно уточнить.
      </p>
      <button
        class="run-btn"
        onClick={runRefinement}
        disabled={state.isRunning || state.dataPoints.length === 0}
      >
        {state.isRunning ? 'Выполняется...' : '\u25B6 Запустить уточнение'}
      </button>
    </div>
  );
};
