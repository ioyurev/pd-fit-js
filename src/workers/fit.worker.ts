import { runLM } from '@/lib/fitAdapter';
import type { FitPoint, FitParameter, FitOptions } from '@/lib/fitAdapter';

self.onmessage = (e: MessageEvent<{ points: FitPoint[], parameters: FitParameter[], options?: FitOptions }>) => {
  try {
    const { points, parameters, options } = e.data;
    const result = runLM(points, parameters, options);
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

