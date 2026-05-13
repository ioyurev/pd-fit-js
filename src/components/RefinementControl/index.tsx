import type { Component } from 'solid-js';
import { state, runRefinement, toggleLog } from '../../store/fitStore';

export const RefinementControl: Component = () => {
  return (
    <div class="refinement-control">
      <h3>Управление уточнением</h3>
      <p class="text-muted" style="font-size:0.85rem; margin: 0 0 0.75rem 0;">
        Выберите уточняемые параметры в таблице выше (снимите флажок «Фикс.»).
      </p>
      <button
        class="run-btn"
        onClick={runRefinement}
        disabled={state.isRunning || state.dataPoints.length === 0}
      >
        {state.isRunning ? 'Выполняется...' : 'Запустить уточнение'}
      </button>

      <button
        class="btn-primary mt-3"
        onClick={toggleLog}
        style="width: 100%; background-color: #7f8c8d;"
      >
        Показать лог ({state.log.length} записей)
      </button>
    </div>
  );
};
