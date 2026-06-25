import type { Component } from 'solid-js';
import { Show, createSignal, onMount, onCleanup, createEffect } from 'solid-js';
import { DataInput } from '@/components/DataInput';
import { ParameterPanel } from '@/components/ParameterPanel';
import { DiagramPlot } from '@/components/DiagramPlot';
import { ResidualsPlot } from '@/components/ResidualsPlot';
import { RefinementControl } from '@/components/RefinementControl';
import { ReportPanel } from '@/components/ReportPanel';
import { ToastContainer } from '@/components/ToastContainer';
import { HelpModal } from '@/components/HelpModal';
import { ProgressPlot } from '@/components/ProgressPlot';
import { ConvergencePlot } from '@/components/ConvergencePlot';
import { GExPlot } from '@/components/GExPlot';
import { FileMenu } from '@/components/FileMenu';
import { state, stopRefinement } from '@/store/fitStore';
import { windowTitle, isDirty } from '@/store/fileStore';
import { hasFileSystemAccess } from '@/lib/projectFile';
import { tempUnit, setTempUnit } from '@/store/unitsStore';
import './App.css';

const App: Component = () => {
  const [helpOpen, setHelpOpen] = createSignal(false);

  // ── Обновление заголовка окна ──
  createEffect(() => {
    document.title = windowTitle();
  });

  // ── Предупреждение при закрытии с несохранёнными изменениями ──
  const beforeUnload = (e: BeforeUnloadEvent) => {
    if (isDirty()) {
      e.preventDefault();
      e.returnValue = '';
    }
  };

  onMount(() => {
    window.addEventListener('beforeunload', beforeUnload);
  });

  onCleanup(() => {
    window.removeEventListener('beforeunload', beforeUnload);
  });

  // ── Горячие клавиши ──
  const handleKeyboard = (e: KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;

    if (e.key === 's' && !e.shiftKey) {
      e.preventDefault();
      // Если FSA доступен → Сохранить, иначе → Скачать
      if (hasFileSystemAccess()) {
        document.dispatchEvent(new CustomEvent('pdfit:save'));
      } else {
        document.dispatchEvent(new CustomEvent('pdfit:download'));
      }
    } else if (e.key === 's' && e.shiftKey) {
      e.preventDefault();
      if (hasFileSystemAccess()) {
        document.dispatchEvent(new CustomEvent('pdfit:save-as'));
      } else {
        document.dispatchEvent(new CustomEvent('pdfit:download'));
      }
    } else if (e.key === 'o') {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('pdfit:open'));
    } else if (e.key === 'n') {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('pdfit:new'));
    } else if (e.key === 'w') {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('pdfit:close'));
    }
  };

  onMount(() => {
    document.addEventListener('keydown', handleKeyboard);
  });

  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyboard);
  });

  return (
    <div class="app-container">
      <Show when={state.isRunning}>
        <div class="loading-overlay">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div class="spinner"></div>
            <div style="font-size: 1.2rem; font-weight: 600;">Выполняется оптимизация...</div>
            <button class="btn-stop" onClick={stopRefinement}>
              ◼ Остановить
            </button>
          </div>

          <Show when={state.progressHistory.length > 0}>
            {(() => {
              const last = () => state.progressHistory[state.progressHistory.length - 1];
              const improvementCount = () => last()?.step ?? 0;
              const maxIterations = () => last()?.maxSteps ?? 120;
              const modelEvalCount = () => last()?.modelEvalCount ?? 0;
              const maxModelEvaluations = () => last()?.maxModelEvaluations ?? 0;
              const pct = () =>
                maxModelEvaluations() > 0
                  ? Math.min(100, (modelEvalCount() / maxModelEvaluations()) * 100)
                  : 0;

              return (
                <div style="width: 90%; max-width: 800px; margin-top: 1rem;">
                  <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px; gap: 1rem;">
                    <span>Улучшений модели: {improvementCount()}</span>
                    <span>Вызовов модели: {modelEvalCount()} / {maxModelEvaluations()}</span>
                    <span>Лимит итераций LM: {maxIterations()}</span>
                  </div>
                  <div style="width: 100%; height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                    <div
                      style={{
                        width: `${pct()}%`,
                        height: '100%',
                        background: '#2ecc71',
                        transition: 'width 0.2s ease-out',
                      }}
                    ></div>
                  </div>
                </div>
              );
            })()}

            <div style="display: flex; gap: 1rem; width: 90%; max-width: 1000px; margin-top: 0.5rem;">
              <div style="flex: 1; min-width: 0;">
                <ProgressPlot />
              </div>
              <div style="flex: 1; min-width: 0;">
                <ConvergencePlot />
              </div>
            </div>
          </Show>
        </div>
      </Show>

      <header>
        <div class="header-left">
          <span style="font-weight: 700; letter-spacing: 0.02em;">PD-Fit JS</span>
          <FileMenu />
        </div>
        <div class="header-actions">
          <div class="temp-unit-toggle">
            <button
              class={`unit-btn ${tempUnit() === 'K' ? 'unit-active' : ''}`}
              onClick={() => setTempUnit('K')}
            >K</button>
            <button
              class={`unit-btn ${tempUnit() === 'C' ? 'unit-active' : ''}`}
              onClick={() => setTempUnit('C')}
            >°C</button>
          </div>
          <button class="btn-help" onClick={() => setHelpOpen(true)}>? Справка</button>
        </div>
      </header>

      <main>
        <div class="left-panel">
          <section class="section-data">
            <DataInput />
          </section>
        </div>

        <div class="center-panel">
          <div class="center-grid">
            <div class="pane-diagram">
              <DiagramPlot />
            </div>
            <div class="pane-residuals">
              <ResidualsPlot />
            </div>
            <div class="pane-gex">
              <GExPlot />
            </div>
            <div class="pane-report">
              <ReportPanel />
            </div>
          </div>
        </div>

        <div class="right-panel">
          <section class="section-params">
            <ParameterPanel />
          </section>
          <section class="section-run">
            <RefinementControl />
          </section>
        </div>
      </main>

      <ToastContainer />
      <HelpModal open={helpOpen()} onClose={() => setHelpOpen(false)} />
    </div>
  );
};

export default App;
