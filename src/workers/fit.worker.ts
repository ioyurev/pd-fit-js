import { runLM } from '@/lib/fitAdapter';
import type { FitPoint, FitParameter } from '@/lib/fitAdapter';

self.onmessage = (e: MessageEvent<{ points: FitPoint[], parameters: FitParameter[] }>) => {
  try {
    const { points, parameters } = e.data;
    const result = runLM(points, parameters);
    self.postMessage({ success: true, result });
  } catch (error: any) {
    // 1. Выводим ошибку в консоль прямо из Воркера.
    // В консоли DevTools появится точная кликабельная ссылка на файл и строку ошибки!
    console.error('Ошибка в фоновом потоке:', error);

    self.postMessage({ 
      success: false, 
      error: error instanceof Error ? `${error.message}\n${error.stack}` : String(error)
    });
  }
};

