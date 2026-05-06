import { createStore, produce, unwrap } from 'solid-js/store';
import { paramsToPhysical } from '../lib/fitAdapter';
import type { FitParameter, FitPoint } from '../lib/fitAdapter';
import { calcAllTLiquidus } from '../lib/liquidusSolver';
import { chiSquared, rwp, correlationMatrix, highCorrelationWarnings } from '../lib/statistics';
import { Matrix } from 'ml-matrix';
import { syncToURL, loadFromURL } from '../lib/urlState';
import { createEffect } from 'solid-js';

// ---------- типы ----------
export type { FitParameter };

export interface DataPoint {
  xB: number;
  T: number;
  weight: number;
  sigma: number;
  branch: string;
}

interface FitState {
  dataPoints: DataPoint[];
  parameters: FitParameter[];
  calcT: number[];
  residuals: number[];
  chiSq: number;
  rwpVal: number;
  covMatrix: number[][];
  corrMatrix: number[][];
  corrWarnings: string[];
  isRunning: boolean;
  log: string[];
  isLogOpen: boolean;
}

// ---------- начальные параметры ----------
const defaultParams: FitParameter[] = [
  { name: 'Tfus_A',    value: 1000,  fixed: true,  min: 800,  max: 1200 },
  { name: 'dHfus_A',   value: 10000, fixed: true,  min: 1000, max: 50000 },
  { name: 'Tfus_B',    value: 900,   fixed: true,  min: 700,  max: 1100 },
  { name: 'dHfus_B',   value: 8000,  fixed: true,  min: 1000, max: 50000 },
  { name: 'L0_H',      value: 0,     fixed: false, min: -100000, max: 100000 },
  { name: 'L0_S',      value: 0,     fixed: false, min: -200,    max: 200 },
];

const savedState = loadFromURL();

// Миграция для старых ссылок, если в них были "Ttrans_A" без суффикса
if (savedState?.parameters) {
  savedState.parameters.forEach((p: FitParameter) => {
    if (p.name === 'Ttrans_A') p.name = 'Ttrans_A_0';
    if (p.name === 'dHtrans_A') p.name = 'dHtrans_A_0';
    if (p.name === 'Ttrans_B') p.name = 'Ttrans_B_0';
    if (p.name === 'dHtrans_B') p.name = 'dHtrans_B_0';
  });
  savedState.dataPoints.forEach((p: DataPoint) => {
    if (p.branch === 'trans_A') p.branch = 'Ttrans_A_0';
    if (p.branch === 'trans_B') p.branch = 'Ttrans_B_0';
  });
}

const [state, setState] = createStore<FitState>({
  dataPoints: savedState?.dataPoints || [],
  parameters: savedState?.parameters || defaultParams,
  calcT: [],
  residuals: [],
  chiSq: 0,
  rwpVal: 0,
  covMatrix: [],
  corrMatrix: [],
  corrWarnings: [],
  isRunning: false,
  log: [],
  isLogOpen: false,
});

// Авто-синхронизация с URL при изменении данных или параметров
createEffect(() => {
  syncToURL({
    dataPoints: state.dataPoints,
    parameters: state.parameters,
  });
});

// ---------- действия ----------

export function addDataPoint() {
  setState('dataPoints', p => [
    ...p,
    { xB: 0.5, T: 500, sigma: 1, weight: 1, branch: 'A' }
  ]);
  recalculate();
}

export function removeDataPoint(index: number) {
  setState('dataPoints', p => p.filter((_, i) => i !== index));
  recalculate();
}

export function updateDataPoint(index: number, field: keyof DataPoint, value: any) {
  setState('dataPoints', index, field as any, value);
  if (field === 'sigma') {
    setState('dataPoints', index, 'weight', 1 / (value * value));
  }
  recalculate();
}

export function setParameter(index: number, field: keyof FitParameter, value: unknown) {
  setState(produce(s => { (s.parameters[index] as any)[field] = value; }));
  recalculate();
}

export function addRKTerm() {
  const v = state.parameters.filter(p => p.name.startsWith('L') && p.name.endsWith('_H')).length;
  setState('parameters', p => [
    ...p,
    { name: `L${v}_H`, value: 0, fixed: false, min: -100000, max: 100000 },
    { name: `L${v}_S`, value: 0, fixed: false, min: -200,    max: 200 },
  ]);
}

export function removeRKTerm() {
  const L_Hs = state.parameters.filter(p => p.name.startsWith('L') && p.name.endsWith('_H'));
  if (L_Hs.length <= 1) return;
  const lastIndex = L_Hs.length - 1;
  setState('parameters', p => p.filter(x => x.name !== `L${lastIndex}_H` && x.name !== `L${lastIndex}_S`));
}

export function addTransition(comp: 'A'|'B') {
  setState('parameters', p => {
    const transParams = p.filter(x => x.name.startsWith(`Ttrans_${comp}_`));
    const nextId = transParams.length;
    return [
      ...p,
      { name: `Ttrans_${comp}_${nextId}`, value: 800, fixed: true, min: 0, max: 3000 },
      { name: `dHtrans_${comp}_${nextId}`, value: 2000, fixed: true, min: 0, max: 20000 },
    ];
  });
}

export function removeTransition(comp: 'A'|'B') {
  setState('parameters', p => {
    const transParams = p.filter(x => x.name.startsWith(`Ttrans_${comp}_`));
    if (transParams.length === 0) return p;
    const lastId = transParams.length - 1;
    return p.filter(x => x.name !== `Ttrans_${comp}_${lastId}` && x.name !== `dHtrans_${comp}_${lastId}`);
  });
}

export function applyStrategy(strategy: 'rk-only' | 'rk-tfus' | 'rk-tfus-dhfus' | 'full') {
  setState('parameters', produce(params => {
    for (const p of params) {
      if (p.name.startsWith('L')) { p.fixed = false; continue; }
      p.fixed = !(
        (strategy === 'rk-tfus' && p.name.startsWith('Tfus')) ||
        (strategy === 'rk-tfus-dhfus') ||
        (strategy === 'full')
      );
    }
  }));
}

export function recalculate() {
  const { dataPoints, parameters } = state;
  if (!dataPoints.length) return;

  const { compA, compB, Lv_H, Lv_S } = paramsToPhysical(parameters);
  const pts = dataPoints.filter(p => p.branch !== 'eutectic');

  const calcT = calcAllTLiquidus(pts as any, compA, compB, Lv_H, Lv_S);
  const obs   = pts.map(p => p.T);
  const ws    = pts.map(p => p.weight);
  const res   = obs.map((t, i) => t - calcT[i]);

  setState({
    calcT,
    residuals: res,
    chiSq: chiSquared(res, ws),
    rwpVal: rwp(res, ws, obs),
  });
}

export function toggleLog() {
  setState('isLogOpen', v => !v);
}

export async function runRefinement() {
  setState({ isRunning: true });
  addLog('Запуск уточнения в фоне...');

  try {
    // Валидация входных данных
    for (const p of state.dataPoints) {
      if (p.xB < 0 || p.xB > 1) {
        throw new Error(`Недопустимое значение xB: ${p.xB}. Должно быть от 0 до 1.`);
      }
      if (p.T <= 0) {
        throw new Error(`Недопустимое значение T: ${p.T}. Должно быть > 0 K.`);
      }
    }

    // Используем unwrap, чтобы снять Proxy-обертки SolidJS перед отправкой в Worker
    const rawDataPoints = unwrap(state.dataPoints);
    const rawParameters = unwrap(state.parameters);

    // Точки эвтектики теперь тоже участвуют в фиттинге!
    const pts = rawDataPoints as unknown as FitPoint[];
    
    const freeParamsCount = rawParameters.filter(p => !p.fixed).length;
    if (freeParamsCount >= pts.length) {
      throw new Error(`Количество свободных параметров (${freeParamsCount}) должно быть меньше количества точек (${pts.length}). Degrees of freedom > 0.`);
    }

    const worker = new Worker(new URL('../workers/fit.worker.ts', import.meta.url), { type: 'module' });
    
    const workerResult = await new Promise<any>((resolve, reject) => {
      worker.onmessage = (e) => {
        if (e.data.success) {
          resolve(e.data.result);
        } else {
          reject(new Error(e.data.error));
        }
        worker.terminate();
      };
      worker.onerror = (e) => {
        reject(new Error('Worker error: ' + e.message));
        worker.terminate();
      };
      worker.postMessage({ points: pts, parameters: rawParameters });
    });

    const { params: finalParams, covarianceMatrix } = workerResult;

    setState('parameters', finalParams);
    recalculate();

    // Корреляционная матрица
    if (covarianceMatrix && covarianceMatrix.length > 0) {
      const cov = new Matrix(covarianceMatrix);
      const corr = correlationMatrix(cov);
      const freeNames = finalParams.filter((p: FitParameter) => !p.fixed).map((p: FitParameter) => p.name);
      setState({
        covMatrix: covarianceMatrix,
        corrMatrix: corr.to2DArray(),
        corrWarnings: highCorrelationWarnings(corr, freeNames),
      });
    } else {
      setState({ covMatrix: [], corrMatrix: [], corrWarnings: [] });
    }

    addLog(`Готово. χ²=${state.chiSq.toFixed(4)}, Rwp=${state.rwpVal.toFixed(4)}`);
  } catch (err: any) {
    addLog(`Ошибка: ${err.message || String(err)}`);
  } finally {
    setState({ isRunning: false });
  }
}

function addLog(msg: string) {
  setState('log', l => [...l.slice(-49), `${new Date().toLocaleTimeString()} ${msg}`]);
}

if (state.dataPoints.length > 0) {
  recalculate();
}

export { state };
