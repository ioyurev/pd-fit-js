import type { Component } from 'solid-js';
import { Show, createSignal } from 'solid-js';
import { DataInput } from './components/DataInput';
import { ParameterPanel } from './components/ParameterPanel';
import { DiagramPlot } from './components/DiagramPlot';
import { ResidualsPlot } from './components/ResidualsPlot';
import { RefinementControl } from './components/RefinementControl';
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
        <div class="header-actions">
          <button class="btn-help" onClick={() => setHelpOpen(true)}>? Справка</button>
        </div>
      </header>

      <main>
        {/* ЛЕВАЯ ПАНЕЛЬ */}
        <div class="left-panel">
          <section class="section-data">
            <DataInput />
          </section>
          <section class="section-params">
            <ParameterPanel />
          </section>
          <section class="section-run">
            <RefinementControl />
          </section>
        </div>

        {/* ПРАВАЯ ПАНЕЛЬ */}
        <div class="right-panel">
          <div class="right-grid">
            <div class="pane-diagram">
              <DiagramPlot />
            </div>
            <div class="pane-residuals">
              <ResidualsPlot />
            </div>
            <div class="pane-report">
              <ReportPanel />
            </div>
          </div>
        </div>
      </main>

      <LogModal />
      <HelpModal open={helpOpen()} onClose={() => setHelpOpen(false)} />
    </div>
  );
};

export default App;
