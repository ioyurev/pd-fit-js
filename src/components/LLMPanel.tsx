import { createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import { state } from '@/store/fitStore';
import { addToast } from '@/store/toastStore';
import { formatLLMText } from '@/lib/llmExport';

export const LLMPanel: Component = () => {
  const formattedText = createMemo(() => {
    const { dataPoints, parameters, chiSq, rwpVal, corrWarnings } = state;
    return formatLLMText(dataPoints, parameters, chiSq, rwpVal, corrWarnings);
  });

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(formattedText());
      addToast('Данные скопированы!', 'success', 3000);
    } catch (e) {
      console.error(e);
      addToast('Ошибка копирования.', 'error', 4000);
    }
  };

  return (
    <div class="llm-panel">
      <h3>Экспорт данных</h3>
      <p class="hint-text">
        Скопируйте текущее состояние расчёта (параметры, точки и невязки) для отправки в нейросеть.
      </p>
      <textarea
        readonly
        class="llm-textarea"
        value={formattedText()}
        placeholder="Генерация данных..."
      />
      <button class="btn-llm-copy" onClick={handleCopy} disabled={state.isRunning}>
        📋 Копировать данные
      </button>
    </div>
  );
};
