import { createStore, produce, unwrap } from 'solid-js/store';
import { createEffect } from 'solid-js';
import { Matrix } from 'ml-matrix';
import { paramsToPhysical } from '@/lib/fitAdapter';
import type { FitParameter, FitPoint } from '@/lib/fitAdapter';
import { calcAllTLiquidus } from '@/lib/liquidusSolver';
import { chiSquared, rwp, correlationMatrix, highCorrelationWarnings } from '@/lib/statistics';
import type { LossType } from '@/lib/numerics';
import type { FitOptions } from '@/lib/fitAdapter';
import type { BranchDef } from '@/lib/types';
import { addToast } from './toastStore';
import { loadPersistedState, debouncedSyncToURL } from './fitPersistence';
import {
  createDefaultParameters,
  createRKTermParams,
  getRKTermNamesToRemove,
  createTransitionParams,
  countTransitions,
  createCompoundParams,
  getCompoundParamNames,
  currentRKOrder,
} from '@/lib/parameterSchema';
import type { SystemType } from '@/lib/parameterSchema';
import { weightFromSigma } from './fitSelectors';
import { markDirty } from '@/store/fileStore';

export type { FitParameter };
export type { BranchDef };

export interface DataPoint {
  xB: number;
  T: number;
  sigma: number;
  branch: BranchDef;
}

interface FitState {
  systemType: 'eutectic' | 'isomorphous';
  lossType: LossType;
  huberBeta: number;
  dataPoints: DataPoint[];
  parameters: FitParameter[];
  calcT: number[];
  residuals: number[];
  chiSq: number;
  rwpVal: number;
  rmseVal: number;
  r2Val: number;
  covMatrix: number[][];
  corrMatrix: number[][];
  corrWarnings: string[];
  compAName: string;
  compBName: string;
  isRunning: boolean;
  prevParameters: FitParameter[] | null;
  prevChiSq: number | null;
  prevRwpVal: number | null;
  progressHistory: { step: number; maxSteps: number; rwpVal: number; chiSq: number; convergenceError: number }[];
}

const savedState = loadPersistedState();

const defaultSystemType = savedState?.systemType ?? 'eutectic';

const [state, setState] = createStore<FitState>({
  systemType: defaultSystemType,
  lossType: (savedState?.lossType as LossType) ?? 'L2',
  huberBeta: savedState?.huberBeta ?? 10,
  dataPoints: savedState?.dataPoints ?? [],
  parameters: savedState?.parameters ?? createDefaultParameters(defaultSystemType),
  compAName: savedState?.compAName ?? 'A',
  compBName: savedState?.compBName ?? 'B',
  calcT: [],
  residuals: [],
  chiSq: 0,
  rwpVal: 0,
  rmseVal: 0,
  r2Val: 0,
  covMatrix: [],
  corrMatrix: [],
  corrWarnings: [],
  isRunning: false,
  prevParameters: null,
  prevChiSq: null,
  prevRwpVal: null,
  progressHistory: [],
});

// Авто-синхронизация с URL
createEffect(() => {
  debouncedSyncToURL({
    systemType: state.systemType,
    lossType: state.lossType,
    huberBeta: state.huberBeta,
    compAName: state.compAName,
    compBName: state.compBName,
    dataPoints: state.dataPoints,
    parameters: state.parameters,
  });
});

// ─── Загрузка проекта ────────────────────────────────────────────────────────

/**
 * Загрузить полный проект в store (из файла или при создании нового).
 */
export function loadProject(data: {
  systemType: SystemType;
  lossType?: LossType;
  huberBeta?: number;
  compAName: string;
  compBName: string;
  parameters: FitParameter[];
  dataPoints: DataPoint[];
}) {
  setState({
    systemType: data.systemType,
    lossType: data.lossType ?? 'L2',
    huberBeta: data.huberBeta ?? 10,
    compAName: data.compAName,
    compBName: data.compBName,
    parameters: data.parameters,
    dataPoints: data.dataPoints,
    calcT: [],
    residuals: [],
    chiSq: 0,
    rwpVal: 0,
    rmseVal: 0,
    r2Val: 0,
    covMatrix: [],
    corrMatrix: [],
    corrWarnings: [],
    isRunning: false,
    prevParameters: null,
    prevChiSq: null,
    prevRwpVal: null,
    progressHistory: [],
  });
  recalculate();
}

function invalidateFitArtifacts() {
  setState({
    covMatrix: [],
    corrMatrix: [],
    corrWarnings: [],
    progressHistory: [],
  });
}

// ─── Действия с точками данных ───────────────────────────────────────────────

export function addDataPoint() {
  const branch: BranchDef =
    state.systemType === 'isomorphous'
      ? { type: 'lens', curve: 'liquidus' }
      : { type: 'pure', comp: 'A' };
  setState('dataPoints', pts => [
    ...pts,
    { xB: 0.5, T: 500, sigma: 1, branch },
  ]);
  invalidateFitArtifacts();
  recalculate();
  markDirty();
}

export function removeDataPoint(index: number) {
  setState('dataPoints', pts => pts.filter((_, i) => i !== index));
  invalidateFitArtifacts();
  recalculate();
  markDirty();
}

export function updateDataPoint<K extends keyof DataPoint>(
  index: number,
  field: K,
  value: DataPoint[K],
) {
  if (field === 'branch') {
    setState('dataPoints', index, 'branch', value as BranchDef);
    invalidateFitArtifacts();
    recalculate();
    markDirty();
    return;
  }

  const num = Number(value);
  if (!Number.isFinite(num)) return;

  if (field === 'xB') {
    setState('dataPoints', index, 'xB', Math.min(1, Math.max(0, num)));
  } else if (field === 'T') {
    setState('dataPoints', index, 'T', num);
  } else if (field === 'sigma') {
    const sigma = Math.max(1e-9, num);
    setState('dataPoints', index, 'sigma', sigma);
  }

  invalidateFitArtifacts();
  recalculate();
  markDirty();
}

// ─── Действия с параметрами ──────────────────────────────────────────────────

export function setSystemType(type: SystemType) {
  setState({
    systemType: type,
    parameters: createDefaultParameters(type),
    dataPoints: [],
  });
  invalidateFitArtifacts();
  recalculate();
  markDirty();
}

export function setLossType(type: LossType) {
  setState('lossType', type);
  invalidateFitArtifacts();
  recalculate();
  markDirty();
}

export function setHuberBeta(beta: number) {
  if (!Number.isFinite(beta) || beta <= 0) return;
  setState('huberBeta', beta);
  invalidateFitArtifacts();
  recalculate();
  markDirty();
}

export function setParameter(index: number, field: keyof FitParameter, value: unknown) {
  setState(produce(s => { (s.parameters[index] as any)[field] = value; }));
  invalidateFitArtifacts();
  recalculate();
  markDirty();
}

export function addRKTerm() {
  const order = currentRKOrder(state.parameters, state.systemType);
  setState('parameters', ps => [
    ...ps,
    ...createRKTermParams(state.systemType, order),
  ]);
  invalidateFitArtifacts();
  markDirty();
}

export function removeRKTerm() {
  const order = currentRKOrder(state.parameters, state.systemType);
  if (order <= 1) return;
  const toRemove = getRKTermNamesToRemove(state.systemType, order - 1);
  setState('parameters', ps => ps.filter(x => !toRemove.includes(x.name)));
  invalidateFitArtifacts();
  recalculate();
  markDirty();
}

export function addTransition(comp: 'A' | 'B') {
  const n = countTransitions(state.parameters, comp);
  setState('parameters', ps => [...ps, ...createTransitionParams(comp, n)]);
  invalidateFitArtifacts();
  markDirty();
}

export function removeTransition(comp: 'A' | 'B') {
  const n = countTransitions(state.parameters, comp);
  if (n === 0) return;
  const lastId = n - 1;
  setState('parameters', ps =>
    ps.filter(x => x.name !== `Ttrans_${comp}_${lastId}` && x.name !== `dHtrans_${comp}_${lastId}`),
  );
  invalidateFitArtifacts();
  recalculate();
  markDirty();
}

export function addCompound() {
  const existing = state.parameters.filter(p => p.name.match(/^Tfus_C\d+$/));
  const id = `C${existing.length + 1}`;
  setState('parameters', ps => [...ps, ...createCompoundParams(id)]);
  invalidateFitArtifacts();
  markDirty();
}

export function removeCompound() {
  const existing = state.parameters.filter(p => p.name.match(/^Tfus_C\d+$/));
  if (existing.length === 0) return;
  const lastId = `C${existing.length}`;
  const toRemove = getCompoundParamNames(lastId);
  setState('parameters', ps => ps.filter(x => !toRemove.includes(x.name)));
  setState('dataPoints', pts =>
    pts.filter(p => !(p.branch.type === 'compound' && p.branch.id === lastId)),
  );
  invalidateFitArtifacts();
  recalculate();
  markDirty();
}

export function setComponentName(comp: 'A' | 'B', name: string) {
  if (comp === 'A') setState('compAName', name);
  else setState('compBName', name);
  invalidateFitArtifacts();
  markDirty();
}

// ─── Пересчёт ────────────────────────────────────────────────────────────────

export function recalculate() {
  const { dataPoints, parameters } = state;
  if (!dataPoints.length) {
    setState({
      calcT: [],
      residuals: [],
      chiSq: 0,
      rwpVal: 0,
      rmseVal: 0,
      r2Val: 0,
      covMatrix: [],
      corrMatrix: [],
      corrWarnings: [],
    });
    return;
  }

  const { compA, compB, compounds, Lv_H, Lv_S, Lv_H_sol, Lv_S_sol } = paramsToPhysical(parameters);
  const pts = dataPoints.filter(p => p.branch.type !== 'invariant');

  if (pts.length === 0) {
    setState({
      calcT: [],
      residuals: [],
      chiSq: 0,
      rwpVal: 0,
      rmseVal: 0,
      r2Val: 0,
      covMatrix: [],
      corrMatrix: [],
      corrWarnings: [],
    });
    return;
  }

  const calcT = calcAllTLiquidus(pts, compA, compB, compounds, Lv_H, Lv_S, Lv_H_sol, Lv_S_sol);
  const obs = pts.map(p => p.T);
  const ws  = pts.map(p => weightFromSigma(p.sigma));
  const res = obs.map((t, i) => t - calcT[i]);

  const rmse = Math.sqrt(res.reduce((s, r) => s + r * r, 0) / res.length);
  const meanObs = obs.reduce((s, y) => s + y, 0) / obs.length;
  const ssRes = res.reduce((s, r) => s + r * r, 0);
  const ssTot = obs.reduce((s, y) => s + Math.pow(y - meanObs, 2), 0);
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  setState({
    calcT,
    residuals: res,
    chiSq: chiSquared(res, ws, state.lossType, state.huberBeta),
    rwpVal: rwp(res, ws, obs, state.lossType, state.huberBeta),
    rmseVal: rmse,
    r2Val: r2,
  });
}

// ─── Уточнение ───────────────────────────────────────────────────────────────

export async function runRefinement() {
  setState({ isRunning: true });
  addToast('Запуск уточнения...', 'info', 2000);

  try {
    const rawDataPoints = unwrap(state.dataPoints)
      .filter(p => p.branch.type !== 'invariant')
      .map(p => ({
        xB: p.xB,
        T: p.T,
        weight: weightFromSigma(p.sigma),
        branch: p.branch,
      })) as FitPoint[];

    if (rawDataPoints.length === 0) {
      throw new Error('Нет точек для оптимизации: все точки являются invariant.');
    }
    const rawParameters = unwrap(state.parameters);

    // Запоминаем состояние перед этим запуском
    setState({
      prevParameters: rawParameters,
      prevChiSq: state.chiSq,
      prevRwpVal: state.rwpVal,
    });

    const worker = new Worker(
      new URL('../workers/fit.worker.ts', import.meta.url),
      { type: 'module' },
    );

    // Очищаем историю шагов перед запуском
    setState('progressHistory', []);

    const workerResult = await new Promise<any>((resolve, reject) => {
      worker.onmessage = e => {
        if (!e.data) return;

        if (e.data.type === 'progress') {
          setState('progressHistory', h => [
            ...h,
            {
              step: e.data.step,
              maxSteps: e.data.maxSteps,
              rwpVal: e.data.rwpVal,
              chiSq: e.data.chiSq,
              convergenceError: e.data.convergenceError,
            },
          ]);
          return;
        }

        if (e.data.success) {
          resolve(e.data.result);
          worker.terminate();
        } else {
          reject(new Error(e.data.error || 'Неизвестная ошибка воркера'));
          worker.terminate();
        }
      };

      worker.onerror = (e: ErrorEvent) => {
        console.error('Системная ошибка Воркера (onerror):', e);

        const msg = e.message || 'Ошибка загрузки/компиляции скрипта воркера';
        const file = e.filename ? `\nФайл: ${e.filename}` : '';
        const line = e.lineno ? `\nСтрока: ${e.lineno}:${e.colno}` : '';

        reject(new Error(`[Worker.onerror] ${msg}${file}${line}`));
        worker.terminate();
      };

      const fitOptions: FitOptions = {
        lossType: state.lossType,
        huberBeta: state.huberBeta,
      };
      worker.postMessage({ points: rawDataPoints, parameters: rawParameters, options: fitOptions });
    });

    const { params: finalParams, covarianceMatrix } = workerResult;
    setState('parameters', finalParams);
    recalculate();
    markDirty();

    // Расчет разностей (дельты) для тоста
    const dChiSq = state.prevChiSq !== null ? state.chiSq - state.prevChiSq : 0;
    const dRwp = state.prevRwpVal !== null ? (state.rwpVal - state.prevRwpVal) * 100 : 0;

    const chiSqText = state.prevChiSq !== null
      ? `${state.chiSq.toFixed(4)} (было ${state.prevChiSq.toFixed(4)}, Δ: ${dChiSq >= 0 ? '+' : ''}${dChiSq.toFixed(4)})`
      : state.chiSq.toFixed(4);

    const rwpText = state.prevRwpVal !== null
      ? `${(state.rwpVal * 100).toFixed(4)}% (было ${(state.prevRwpVal * 100).toFixed(4)}%, Δ: ${dRwp >= 0 ? '+' : ''}${dRwp.toFixed(4)}%)`
      : `${(state.rwpVal * 100).toFixed(4)}%`;

    if (covarianceMatrix?.length > 0) {
      const cov = new Matrix(covarianceMatrix);
      const corr = correlationMatrix(cov);
      const freeNames = finalParams
        .filter((p: FitParameter) => !p.fixed)
        .map((p: FitParameter) => p.name);

      const warnings = highCorrelationWarnings(corr, freeNames);
      setState({
        covMatrix: covarianceMatrix,
        corrMatrix: corr.to2DArray(),
        corrWarnings: warnings,
      });

      if (warnings.length > 0) {
        addToast(`Обнаружены сильные корреляции параметров (${warnings.length})! Подробности во вкладке отчёта.`, 'warning', 8000);
      }
    }

    addToast(
      `Оптимизация завершена!\n\n` +
      `Факторы адекватности:\n` +
      `• χ²: ${chiSqText}\n` +
      `• Rwp: ${rwpText}\n` +
      `• RMSE: ${state.rmseVal.toFixed(3)} K\n` +
      `• R²: ${state.r2Val.toFixed(5)}`,
      'success',
      9000
    );
  } catch (err: any) {
    console.error('Ошибка в runRefinement:', err);

    setState({ covMatrix: [], corrMatrix: [], corrWarnings: [] });

    const errorText = err instanceof Error ? err.message : String(err);
    addToast(`Ошибка расчёта:\n${errorText}`, 'error', 12000);
  } finally {
    setState({ isRunning: false });
  }
}

if (state.dataPoints.length > 0) {
  recalculate();
}

export { state };
