import type { Component } from 'solid-js';
import { state, runRefinement, applyStrategy, toggleLog } from '../../store/fitStore';

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