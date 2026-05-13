import type { Component } from 'solid-js';
import { Show, createSignal } from 'solid-js';
import { DataInput } from './components/DataInput';
import { ParameterPanel } from './components/ParameterPanel';
import { DiagramPlot } from './components/DiagramPlot';
import { ResidualsPlot } from './components/ResidualsPlot';
import { RefinementControl } from './components/RefinementControl';
import { StatisticsPanel } from './components/StatisticsPanel';
import { ReportPanel } from './components/ReportPanel';
import { LogModal } from './components/LogModal';
import { HelpModal } from './components/HelpModal';
import { state } from './store/fitStore';
import './App.css';

const App: Component = () => {
  const [helpOpen, setHelpOpen] = createSignal(false);

  return (
    <div class="app-container">
      <Show when={state.isRunning}>
        <div class="loading-overlay">
          <div class="spinner"></div>
          <div>Выполняется расчёт...</div>
        </div>
      </Show>

      <header>
        <h1>PD-Fit JS</h1>
        <button class="btn-help" onClick={() => setHelpOpen(true)}>
          ? Справка
        </button>
      </header>

      <main>
        <div class="left-panel">
          <section><DataInput /></section>
          <section><ParameterPanel /></section>
          <section><RefinementControl /></section>
        </div>
        <div class="right-panel">
          <section class="plot-section">
            <DiagramPlot />
            <ResidualsPlot />
          </section>
          <section><StatisticsPanel /></section>
          <section><ReportPanel /></section>
        </div>
      </main>

      <LogModal />
      <HelpModal open={helpOpen()} onClose={() => setHelpOpen(false)} />
    </div>
  );
};

export default App;
