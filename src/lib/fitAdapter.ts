import { levenbergMarquardt } from 'ml-levenberg-marquardt';
import { calcTForBranch } from '@/lib/liquidusSolver';
import type { BranchDef, Compound } from '@/lib/types';
import type { PureComponent } from '@/lib/thermodynamics';
import { buildCovarianceMatrix } from '@/lib/statistics';
import { buildIsomorphousProfile } from '@/lib/isomorphousSolver';
import { finiteDiffStep } from '@/lib/numerics';
import {
  extractPureComponent,
  extractCompounds,
  extractRKSeries,
} from '@/lib/parameterSchema';

export interface FitParameter {
  name: string;
  value: number;
  fixed: boolean;
  min: number;
  max: number;
  boundsEnabled?: boolean;
}

export interface FitPoint {
  xB: number;
  T: number;
  weight: number;
  branch: BranchDef;
}

const PROFILE_STEPS_MODEL = 60;
const PROFILE_STEPS_JACOBIAN = 35;

function packParams(params: FitParameter[]): number[] {
  return params.filter(p => !p.fixed).map(p => p.value);
}

function unpackParams(packed: number[], params: FitParameter[]): FitParameter[] {
  let i = 0;
  return params.map(p => (p.fixed ? p : { ...p, value: packed[i++] }));
}

/**
 * Извлечение физических параметров из массива FitParameter.
 * Теперь делегирует парсинг parameterSchema — единственному источнику правды.
 */
export function paramsToPhysical(params: FitParameter[]): {
  compA: PureComponent;
  compB: PureComponent;
  compounds: Compound[];
  Lv_H: number[];
  Lv_S: number[];
  Lv_H_sol: number[];
  Lv_S_sol: number[];
} {
  const compA = extractPureComponent(params, 'A');
  const compB = extractPureComponent(params, 'B');
  const compounds = extractCompounds(params);

  const hasLiqSuffix = params.some(p => p.name === 'L0_H_liq');

  let Lv_H: number[];
  let Lv_S: number[];

  if (hasLiqSuffix) {
    Lv_H = extractRKSeries(params, '_H_liq');
    Lv_S = extractRKSeries(params, '_S_liq');
  } else {
    Lv_H = extractRKSeries(params, '_H');
    Lv_S = extractRKSeries(params, '_S');
  }

  const Lv_H_sol = extractRKSeries(params, '_H_sol');
  const Lv_S_sol = extractRKSeries(params, '_S_sol');

  return { compA, compB, compounds, Lv_H, Lv_S, Lv_H_sol, Lv_S_sol };
}

export function runLM(
  points: FitPoint[],
  params: FitParameter[],
): { params: FitParameter[]; covarianceMatrix: number[][] } {
  const xs = points.map((_, i) => i);
  const ys = points.map(p => p.T);
  const ws = points.map(p => p.weight);

  const paramsFull = [...params];

  let bestRwp = Infinity;
  let prevChiSq = -1;
  let stepCounter = 0;

  function model(freePacked: number[]): (index: number) => number {
    const updated = unpackParams(freePacked, paramsFull);
    const { compA, compB, compounds, Lv_H, Lv_S, Lv_H_sol, Lv_S_sol } = paramsToPhysical(updated);

    let isomorphousProfile: any = null;
    if (points.some(p => p.branch.type === 'lens')) {
      isomorphousProfile = buildIsomorphousProfile(
        compA, compB, Lv_H, Lv_S, Lv_H_sol, Lv_S_sol, PROFILE_STEPS_MODEL,
      );
    }

    // Промежуточная невязка для progress-трекинга
    const tempT = points.map(p => {
      if (p.branch.type === 'lens' && isomorphousProfile) {
        const spline = p.branch.curve === 'liquidus' ? isomorphousProfile.liquidusSpline : isomorphousProfile.solidusSpline;
        return spline.interpolate(p.xB);
      }
      return calcTForBranch(p.xB, p.branch, compA, compB, compounds, Lv_H, Lv_S);
    });
    const tempRes = points.map((p, i) => p.T - tempT[i]);
    const tempChi = tempRes.reduce((s, r, i) => s + ws[i] * r * r, 0);
    const tempRwp = Math.sqrt(tempChi / ys.reduce((s, y, i) => s + ws[i] * y * y, 0));

    if (tempRwp < bestRwp) {
      bestRwp = tempRwp;
      stepCounter++;

      let dChiRel = 1.0;
      if (prevChiSq !== -1 && prevChiSq > 0) {
        dChiRel = Math.abs(tempChi - prevChiSq) / prevChiSq;
      }
      prevChiSq = tempChi;

      if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function') {
        (self as any).postMessage({
          type: 'progress',
          step: stepCounter,
          chiSq: tempChi,
          rwpVal: tempRwp,
          convergenceError: dChiRel,
        });
      }
    }

    return (index: number) => {
      const p = points[index];
      if (p.branch.type === 'lens' && isomorphousProfile) {
        const spline = p.branch.curve === 'liquidus' ? isomorphousProfile.liquidusSpline : isomorphousProfile.solidusSpline;
        return spline.interpolate(p.xB);
      }
      return calcTForBranch(p.xB, p.branch, compA, compB, compounds, Lv_H, Lv_S);
    };
  }

  const initialValues = packParams(params);
  const minValues = params.filter(p => !p.fixed).map(p => p.boundsEnabled ? p.min : -Infinity);
  const maxValues = params.filter(p => !p.fixed).map(p => p.boundsEnabled ? p.max : Infinity);

  if (initialValues.length === 0) {
    return { params, covarianceMatrix: [] };
  }

  const adaptiveGradients = initialValues.map(val => finiteDiffStep(val));

  const result = levenbergMarquardt(
    { x: xs, y: ys },
    model,
    {
      initialValues,
      minValues,
      maxValues,
      weights: ws,
      maxIterations: 500,
      errorTolerance: 1e-4,
      gradientDifference: adaptiveGradients,
    },
  );

  const finalParams = unpackParams(result.parameterValues, params);
  const freeParams = finalParams.filter(p => !p.fixed);

  let covMatrix: number[][] = [];

  if (freeParams.length > 0) {
    const jacobian: number[][] = Array.from({ length: points.length }, () => []);
    const physicalFinal = paramsToPhysical(finalParams);

    for (let j = 0; j < freeParams.length; j++) {
      const fp = freeParams[j];
      const h = finiteDiffStep(fp.value);

      const paramsPlus  = finalParams.map(p => p.name === fp.name ? { ...p, value: p.value + h } : p);
      const paramsMinus = finalParams.map(p => p.name === fp.name ? { ...p, value: p.value - h } : p);

      const physPlus  = paramsToPhysical(paramsPlus);
      const physMinus = paramsToPhysical(paramsMinus);

      let profPlus: any = null;
      let profMinus: any = null;
      if (points.some(p => p.branch.type === 'lens')) {
        profPlus = buildIsomorphousProfile(
          physPlus.compA, physPlus.compB,
          physPlus.Lv_H, physPlus.Lv_S,
          physPlus.Lv_H_sol, physPlus.Lv_S_sol,
          PROFILE_STEPS_JACOBIAN,
        );
        profMinus = buildIsomorphousProfile(
          physMinus.compA, physMinus.compB,
          physMinus.Lv_H, physMinus.Lv_S,
          physMinus.Lv_H_sol, physMinus.Lv_S_sol,
          PROFILE_STEPS_JACOBIAN,
        );
      }

      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        let vPlus = 0;
        let vMinus = 0;
        if (pt.branch.type === 'lens') {
          const splinePlus  = pt.branch.curve === 'liquidus' ? profPlus.liquidusSpline : profPlus.solidusSpline;
          const splineMinus = pt.branch.curve === 'liquidus' ? profMinus.liquidusSpline : profMinus.solidusSpline;
          vPlus  = splinePlus.interpolate(pt.xB);
          vMinus = splineMinus.interpolate(pt.xB);
        } else {
          vPlus  = calcTForBranch(pt.xB, pt.branch, physPlus.compA, physPlus.compB, physPlus.compounds, physPlus.Lv_H, physPlus.Lv_S);
          vMinus = calcTForBranch(pt.xB, pt.branch, physMinus.compA, physMinus.compB, physMinus.compounds, physMinus.Lv_H, physMinus.Lv_S);
        }
        jacobian[i].push((vPlus - vMinus) / (2 * h));
      }
    }

    let finalProfile: any = null;
    if (points.some(p => p.branch.type === 'lens')) {
      finalProfile = buildIsomorphousProfile(
        physicalFinal.compA, physicalFinal.compB,
        physicalFinal.Lv_H, physicalFinal.Lv_S,
        physicalFinal.Lv_H_sol, physicalFinal.Lv_S_sol,
        PROFILE_STEPS_MODEL,
      );
    }

    const calcT = points.map(pt => {
      if (pt.branch.type === 'lens' && finalProfile) {
        const spline = pt.branch.curve === 'liquidus' ? finalProfile.liquidusSpline : finalProfile.solidusSpline;
        return spline.interpolate(pt.xB);
      }
      return calcTForBranch(pt.xB, pt.branch, physicalFinal.compA, physicalFinal.compB, physicalFinal.compounds, physicalFinal.Lv_H, physicalFinal.Lv_S);
    });

    const residuals = ys.map((y, i) => y - calcT[i]);

    try {
      const cov = buildCovarianceMatrix(jacobian, residuals, ws);
      covMatrix = cov.to2DArray();
    } catch {
      covMatrix = [];
    }
  }

  return { params: finalParams, covarianceMatrix: covMatrix };
}
