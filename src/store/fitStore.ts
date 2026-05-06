import { createStore, produce } from 'solid-js/store';
import { runLM, paramsToPhysical } from '../lib/fitAdapter';
import type { FitParameter, FitPoint } from '../lib/fitAdapter';
import { calcAllTLiquidus } from '../lib/liquidusSolver';
import { chiSquared, rwp, correlationMatrix, highCorrelationWarnings } from '../lib/statistics';
import { Matrix } from 'ml-matrix';
import { syncToURL, loadFromURL } from '../lib/urlState';
import { createEffect } from 'solid-js';

// ---------- типы ----------
export type { FitParameter };

export interface DataPoint {
  xA: number;
  T: number;
  weight: number;
  sigma: number;
  branch: 'A' | 'B' | 'eutectic';
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
}

// ---------- начальные параметры ----------
const defaultParams: FitParameter[] = [
  { name: 'Tfus_A',  value: 1000, fixed: true,  min: 800,  max: 1200 },
  { name: 'dHfus_A', value: 10000, fixed: true, min: 1000, max: 50000 },
  { name: 'Tfus_B',  value: 900,  fixed: true,  min: 700,  max: 1100 },
  { name: 'dHfus_B', value: 8000, fixed: true,  min: 1000, max: 50000 },
  { name: 'L0',      value: 0,    fixed: false, min: -50000, max: 50000 },
];

const savedState = loadFromURL();

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
});

// Авто-синхронизация с URL при изменении данных или параметров
createEffect(() => {
  syncToURL({
    dataPoints: state.dataPoints,
    parameters: state.parameters,
  });
});

// ---------- действия ----------

export function assignBranches() {
  setState(produce(s => {
    if (s.dataPoints.length === 0) return;
    const eutIdx = s.dataPoints.reduce(
      (minI, p, i) => (p.T < s.dataPoints[minI].T ? i : minI), 0
    );
    const xE = s.dataPoints[eutIdx].xA;
    s.dataPoints.forEach((p, i) => {
      p.branch = i === eutIdx ? 'eutectic' : p.xA >= xE ? 'A' : 'B';
    });
  }));
}

export function addDataPoint() {
  setState('dataPoints', p => [
    ...p,
    { xA: 0.5, T: 500, sigma: 1, weight: 1, branch: 'A' }
  ]);
  assignBranches();
  recalculate();
}

export function removeDataPoint(index: number) {
  setState('dataPoints', p => p.filter((_, i) => i !== index));
  assignBranches();
  recalculate();
}

export function updateDataPoint(index: number, field: keyof DataPoint, value: number) {
  setState('dataPoints', index, field as any, value);
  if (field === 'sigma') {
    setState('dataPoints', index, 'weight', 1 / (value * value));
  }
  if (field === 'xA' || field === 'T') {
    assignBranches();
  }
  recalculate();
}

export function setParameter(index: number, field: keyof FitParameter, value: unknown) {
  setState(produce(s => { (s.parameters[index] as any)[field] = value; }));
  recalculate();
}

export function addRKTerm() {
  const v = state.parameters.filter(p => p.name.startsWith('L')).length;
  setState('parameters', p => [
    ...p,
    { name: `L${v}`, value: 0, fixed: false, min: -50000, max: 50000 },
  ]);
}

export function removeRKTerm() {
  const Ls = state.parameters.filter(p => p.name.startsWith('L'));
  if (Ls.length <= 1) return;
  setState('parameters', p => p.filter(x => x.name !== `L${Ls.length - 1}`));
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

  const { compA, compB, Lv } = paramsToPhysical(parameters);
  const pts = dataPoints.filter(p => p.branch !== 'eutectic');

  const calcT = calcAllTLiquidus(pts as any, compA, compB, Lv);
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

export async function runRefinement() {
  setState({ isRunning: true });
  addLog('Запуск уточнения...');

  try {
    const pts = state.dataPoints.filter(p => p.branch !== 'eutectic') as unknown as FitPoint[];
    const { params: finalParams, covarianceMatrix } = runLM(pts, state.parameters);

    setState('parameters', finalParams);
    recalculate();

    // Корреляционная матрица
    if (covarianceMatrix && covarianceMatrix.length > 0) {
      const cov = new Matrix(covarianceMatrix);
      const corr = correlationMatrix(cov);
      const freeNames = finalParams.filter(p => !p.fixed).map(p => p.name);
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