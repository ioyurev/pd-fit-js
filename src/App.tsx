import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { DataInput } from './components/DataInput';
import { ParameterPanel } from './components/ParameterPanel';
import { DiagramPlot } from './components/DiagramPlot';
import { ResidualsPlot } from './components/ResidualsPlot';
import { RefinementControl } from './components/RefinementControl';
import { StatisticsPanel } from './components/StatisticsPanel';
import { ReportPanel } from './components/ReportPanel';
import { state } from './store/fitStore';
import './App.css';

const App: Component = () => {
  return (
    <div class="app-container">
      <Show when={state.isRunning}>
        <div class="loading-overlay">
          <div class="spinner"></div>
          <div>Выполняется расчет...</div>
        </div>
      </Show>
      <header>
        <h1>PD-Fit JS</h1>
      </header>
      <main>
        <div class="left-panel">
          <section>
            <DataInput />
          </section>
          <section>
            <ParameterPanel />
          </section>
          <section>
            <RefinementControl />
          </section>
        </div>
        <div class="right-panel">
          <section class="plot-section">
            <DiagramPlot />
            <ResidualsPlot />
          </section>
          <section>
            <StatisticsPanel />
          </section>
          <section>
            <ReportPanel />
          </section>
        </div>
      </main>
    </div>
  );
};

export default App;