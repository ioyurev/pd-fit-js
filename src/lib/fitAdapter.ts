import { levenbergMarquardt } from 'ml-levenberg-marquardt';
import { calcTLiquidus } from './liquidusSolver';
import type { Branch } from './liquidusSolver';
import type { PureComponent } from './thermodynamics';
import { buildCovarianceMatrix } from './statistics';

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

  /**
   * Вычисляем Якобиан численно для построения ковариационной матрицы.
   * Это необходимо, так как библиотека ml-levenberg-marquardt не возвращает 
   * итоговую матрицу Якоби в результате выполнения (только параметры и ошибку).
   */
  let covMatrix: number[][] = [];
  const freeParams = finalParams.filter(p => !p.fixed);
  
  if (freeParams.length > 0) {
    const h = 1e-6; // Шаг для численного дифференцирования
    const jacobian: number[][] = [];
    const physicalFinal = paramsToPhysical(finalParams);

    for (const p of points) {
      const row: number[] = [];
      for (let i = 0; i < freeParams.length; i++) {
        const originalValue = freeParams[i].value;
        
        // f(p + h)
        freeParams[i].value = originalValue + h;
        const physicalPlus = paramsToPhysical(finalParams);
        const valPlus = calcTLiquidus(p.xA, p.branch, physicalPlus.compA, physicalPlus.compB, physicalPlus.Lv);
        
        // f(p)
        freeParams[i].value = originalValue;
        const val = calcTLiquidus(p.xA, p.branch, physicalFinal.compA, physicalFinal.compB, physicalFinal.Lv);
        
        row.push((valPlus - val) / h);
      }
      jacobian.push(row);
    }

    const calcT = points.map(p => calcTLiquidus(p.xA, p.branch, physicalFinal.compA, physicalFinal.compB, physicalFinal.Lv));
    const residuals = ys.map((y, i) => y - calcT[i]);
    const cov = buildCovarianceMatrix(jacobian, residuals, ws);
    covMatrix = cov.to2DArray();
  }

  return { params: finalParams, covarianceMatrix: covMatrix };
}