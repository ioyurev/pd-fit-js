import { For } from 'solid-js';
import type { Component } from 'solid-js';
import { state, runRefinement, applyStrategy } from '../../store/fitStore';

export const RefinementControl: Component = () => {
  return (
    <div class="refinement-control">
      <h3>Управление уточнением</h3>
      <div class="strategies">
        <button onClick={() => applyStrategy('rk-only')}>Только RK</button>
        <button onClick={() => applyStrategy('rk-tfus')}>RK + Tfus</button>
        <button onClick={() => applyStrategy('rk-tfus-dhfus')}>RK + Tfus + dHfus</button>
      </div>
      <button 
        class="run-btn" 
        onClick={runRefinement} 
        disabled={state.isRunning || state.dataPoints.length === 0}
      >
        {state.isRunning ? 'Выполняется...' : 'Запустить уточнение'}
      </button>
      
      <div class="log">
        <h4>Лог</h4>
        <pre>
          <For each={state.log}>
            {(msg) => <div>{msg}</div>}
          </For>
        </pre>
      </div>
    </div>
  );
};