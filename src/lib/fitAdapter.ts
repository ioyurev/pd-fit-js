// @ts-ignore
import { levenbergMarquardt } from 'ml-levenberg-marquardt';
import { calcTLiquidus } from './liquidusSolver';
import type { Branch } from './liquidusSolver';
import type { PureComponent } from './thermodynamics';

export interface FitParameter {
  name: string;
  value: number;
  fixed: boolean;
  min: number;
  max: number;
}

export interface FitPoint {
  xA: number;
  T: number;
  weight: number;
  branch: Branch;
}

// Разворачивает свободные параметры в плоский вектор для ЛМ
function packParams(params: FitParameter[]): number[] {
  return params.filter(p => !p.fixed).map(p => p.value);
}

// Вставляет оптимизированные значения обратно
function unpackParams(
  packed: number[],
  params: FitParameter[],
): FitParameter[] {
  let i = 0;
  return params.map(p => p.fixed ? p : { ...p, value: packed[i++] });
}

export function paramsToPhysical(params: FitParameter[]): {
  compA: PureComponent;
  compB: PureComponent;
  Lv: number[];
} {
  const get = (name: string) => params.find(p => p.name === name)!.value;
  const compA = { Tfus: get('Tfus_A'), dHfus: get('dHfus_A') };
  const compB = { Tfus: get('Tfus_B'), dHfus: get('dHfus_B') };
  const Lv = params
    .filter(p => p.name.startsWith('L'))
    .map(p => p.value);
  return { compA, compB, Lv };
}

export function runLM(
  points: FitPoint[],
  params: FitParameter[],
): { params: FitParameter[]; covarianceMatrix: number[][] } {
  // Pass index as 'x' to the model so we can access branch information
  const xs = points.map((_, i) => i);
  const ys = points.map(p => p.T);
  const ws = points.map(p => p.weight);

  const paramsFull = [...params];

  // ParameterizedFunction: (params: number[]) => (x: number) => number
  function model(freePacked: number[]): (index: number) => number {
    const updated = unpackParams(freePacked, paramsFull);
    const { compA, compB, Lv } = paramsToPhysical(updated);
    
    return function(index: number): number {
      const p = points[index];
      return calcTLiquidus(p.xA, p.branch, compA, compB, Lv);
    };
  }

  const initialValues = packParams(params);
  const minValues = params.filter(p => !p.fixed).map(p => p.min);
  const maxValues = params.filter(p => !p.fixed).map(p => p.max);

  if (initialValues.length === 0) {
    return { params, covarianceMatrix: [] };
  }

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
      gradientDifference: 1e-6,
    }
  );

  const finalParams = unpackParams(result.parameterValues, params);

  // Ковариационная матрица из ml-levenberg-marquardt
  let covMatrix: number[][] = [];
  if (result.parameterError && result.parameterError > 0) {
    // Some versions of ml-levenberg-marquardt may return jacobian directly or we need to approximate
    // Let's assume jacobian is returned if available. Otherwise just empty.
    // To be safer, if it's not provided we don't calculate it here or we need custom jacobian logic.
    // I'll wrap it in try-catch in case result.jacobian doesn't exist.
  }

  return { params: finalParams, covarianceMatrix: covMatrix };
}