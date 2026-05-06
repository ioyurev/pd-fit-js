import { runLM } from '../lib/fitAdapter';
import type { FitPoint, FitParameter } from '../lib/fitAdapter';

self.onmessage = (e: MessageEvent<{ points: FitPoint[], parameters: FitParameter[] }>) => {
  try {
    const { points, parameters } = e.data;
    const result = runLM(points, parameters);
    self.postMessage({ success: true, result });
  } catch (error: any) {
    self.postMessage({ success: false, error: error.message || String(error) });
  }
};
