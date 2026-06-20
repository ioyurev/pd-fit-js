/**
 * SSOT для параметров модели.
 * Единственный источник правды для: имён, regex, labels, units,
 * defaults, bounds, группировки, compound ids, transition ids, RK series.
 */

import type { FitParameter } from '@/lib/fitAdapter';
import type { PureComponent, PhaseTransition } from '@/lib/thermodynamics';
import type { Compound } from '@/lib/types';

// ─── Метаданные ──────────────────────────────────────────────────────────────

export interface ParameterMeta {
  label: string;  // KaTeX-совместимая строка
  unit: string;   // KaTeX-совместимая строка
}

const META_RULES: Array<{
  pattern: RegExp;
  meta: (match: RegExpMatchArray) => ParameterMeta;
}> = [
  { pattern: /^Tfus_A$/,             meta: () => ({ label: 'T_{\\mathrm{fus},A}',         unit: '\\text{К}' }) },
  { pattern: /^dHfus_A$/,            meta: () => ({ label: '\\Delta H_{\\mathrm{fus},A}', unit: '\\text{Дж/моль}' }) },
  { pattern: /^Tfus_B$/,             meta: () => ({ label: 'T_{\\mathrm{fus},B}',         unit: '\\text{К}' }) },
  { pattern: /^dHfus_B$/,            meta: () => ({ label: '\\Delta H_{\\mathrm{fus},B}', unit: '\\text{Дж/моль}' }) },
  { pattern: /^L(\d+)_H$/,          meta: m => ({ label: `L_{${m[1]}}^{H}`,              unit: '\\text{Дж/моль}' }) },
  { pattern: /^L(\d+)_S$/,          meta: m => ({ label: `L_{${m[1]}}^{S}`,              unit: '\\text{Дж/(моль}\\cdot\\text{К)}' }) },
  { pattern: /^L(\d+)_H_liq$/,      meta: m => ({ label: `L_{${m[1]}}^{H,\\text{liq}}`,  unit: '\\text{Дж/моль}' }) },
  { pattern: /^L(\d+)_S_liq$/,      meta: m => ({ label: `L_{${m[1]}}^{S,\\text{liq}}`,  unit: '\\text{Дж/(моль}\\cdot\\text{К)}' }) },
  { pattern: /^L(\d+)_H_sol$/,      meta: m => ({ label: `L_{${m[1]}}^{H,\\text{sol}}`,  unit: '\\text{Дж/моль}' }) },
  { pattern: /^L(\d+)_S_sol$/,      meta: m => ({ label: `L_{${m[1]}}^{S,\\text{sol}}`,  unit: '\\text{Дж/(моль}\\cdot\\text{К)}' }) },
  { pattern: /^Ttrans_A_(\d+)$/,    meta: m => ({ label: `T_{\\mathrm{tr},A,${m[1]}}`,             unit: '\\text{К}' }) },
  { pattern: /^dHtrans_A_(\d+)$/,   meta: m => ({ label: `\\Delta H_{\\mathrm{tr},A,${m[1]}}`,     unit: '\\text{Дж/моль}' }) },
  { pattern: /^Ttrans_B_(\d+)$/,    meta: m => ({ label: `T_{\\mathrm{tr},B,${m[1]}}`,             unit: '\\text{К}' }) },
  { pattern: /^dHtrans_B_(\d+)$/,   meta: m => ({ label: `\\Delta H_{\\mathrm{tr},B,${m[1]}}`,     unit: '\\text{Дж/моль}' }) },
  { pattern: /^stoich_(C\d+)$/,     meta: m => ({ label: `x_{c,${m[1]}}`,                          unit: '' }) },
  { pattern: /^Tfus_(C\d+)$/,       meta: m => ({ label: `T_{\\mathrm{fus},${m[1]}}`,              unit: '\\text{К}' }) },
  { pattern: /^dHfus_(C\d+)$/,      meta: m => ({ label: `\\Delta H_{\\mathrm{fus},${m[1]}}`,      unit: '\\text{Дж/моль}' }) },
];

export function getParameterMeta(name: string): ParameterMeta {
  for (const rule of META_RULES) {
    const match = name.match(rule.pattern);
    if (match) return rule.meta(match);
  }
  return { label: name, unit: '' };
}

// ─── Проверки на принадлежность к группе ─────────────────────────────────────

export function isStoichParameter(name: string): boolean {
  return /^stoich_C\d+$/.test(name);
}

export function isTransitionParameter(name: string, comp: 'A' | 'B'): boolean {
  return name.startsWith(`Ttrans_${comp}_`);
}

export function isRKParameter_H_liq(name: string): boolean {
  return /^L\d+_H_liq$/.test(name);
}

export function isRKParameter_H_eutectic(name: string): boolean {
  return /^L\d+_H$/.test(name) && !name.includes('_sol') && !name.includes('_liq');
}

export function isRKParameter_H_sol(name: string): boolean {
  return /^L\d+_H_sol$/.test(name);
}

export function isCompoundTfus(name: string): boolean {
  return /^Tfus_C\d+$/.test(name);
}

// ─── Подсчёт количеств ──────────────────────────────────────────────────────

export function countRKTermsLiq(params: FitParameter[]): number {
  return params.filter(p => isRKParameter_H_liq(p.name)).length;
}

export function countRKTermsEutectic(params: FitParameter[]): number {
  return params.filter(p => isRKParameter_H_eutectic(p.name)).length;
}

export function countRKTermsSol(params: FitParameter[]): number {
  return params.filter(p => isRKParameter_H_sol(p.name)).length;
}

export function countTransitions(params: FitParameter[], comp: 'A' | 'B'): number {
  return params.filter(p => isTransitionParameter(p.name, comp)).length;
}

export function getCompoundIds(params: FitParameter[]): string[] {
  return [
    ...new Set(
      params
        .filter(p => isCompoundTfus(p.name))
        .map(p => p.name.replace('Tfus_', '')),
    ),
  ];
}

// ─── Извлечение физических сущностей ─────────────────────────────────────────

export function extractTransitions(
  params: FitParameter[],
  comp: 'A' | 'B',
): PhaseTransition[] {
  const trans: PhaseTransition[] = [];
  const get = (name: string) => params.find(p => p.name === name)?.value ?? 0;

  for (const p of params.filter(pp => isTransitionParameter(pp.name, comp))) {
    const idx = p.name.split('_')[2];
    const T = p.value;
    const dH = get(`dHtrans_${comp}_${idx}`);
    if (T > 0) trans.push({ id: p.name, T, dH });
  }
  return trans;
}

export function extractCompounds(params: FitParameter[]): Compound[] {
  const get = (name: string) => params.find(p => p.name === name)?.value ?? 0;
  return getCompoundIds(params).map(id => ({
    id,
    stoichB: get(`stoich_${id}`),
    Tfus: get(`Tfus_${id}`),
    dHfus: get(`dHfus_${id}`),
  }));
}

export function extractPureComponent(
  params: FitParameter[],
  comp: 'A' | 'B',
): PureComponent {
  const get = (name: string) => params.find(p => p.name === name)?.value ?? 0;
  return {
    Tfus: get(`Tfus_${comp}`),
    dHfus: get(`dHfus_${comp}`),
    transitions: extractTransitions(params, comp),
  };
}

export function extractRKSeries(
  params: FitParameter[],
  suffix: '_H' | '_S' | '_H_liq' | '_S_liq' | '_H_sol' | '_S_sol',
): number[] {
  const get = (name: string) => params.find(p => p.name === name)?.value ?? 0;
  let count = 0;

  if (suffix === '_H' || suffix === '_S') {
    count = countRKTermsEutectic(params);
  } else if (suffix.endsWith('_liq')) {
    count = countRKTermsLiq(params);
  } else {
    count = countRKTermsSol(params);
  }

  return Array.from({ length: count }, (_, v) => get(`L${v}${suffix}`));
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export type SystemType = 'eutectic' | 'isomorphous';

function fp(
  name: string,
  value: number,
  fixed: boolean,
  min: number,
  max: number,
): FitParameter {
  return { name, value, fixed, min, max, boundsEnabled: false };
}

export function createDefaultParameters(systemType: SystemType): FitParameter[] {
  const base = [
    fp('Tfus_A',  1000,  true,  800,     1200),
    fp('dHfus_A', 10000, true,  1000,    50000),
    fp('Tfus_B',  900,   true,  700,     1100),
    fp('dHfus_B', 8000,  true,  1000,    50000),
  ];

  if (systemType === 'isomorphous') {
    return [
      ...base,
      fp('L0_H_liq', 0, false, -100000, 100000),
      fp('L0_S_liq', 0, false, -200,    200),
      fp('L0_H_sol', 0, false, -100000, 100000),
      fp('L0_S_sol', 0, false, -200,    200),
    ];
  }

  return [
    ...base,
    fp('L0_H', 0, false, -100000, 100000),
    fp('L0_S', 0, false, -200,    200),
  ];
}

export function createRKTermParams(systemType: SystemType, order: number): FitParameter[] {
  if (systemType === 'isomorphous') {
    return [
      fp(`L${order}_H_liq`, 0, false, -100000, 100000),
      fp(`L${order}_S_liq`, 0, false, -200,    200),
      fp(`L${order}_H_sol`, 0, false, -100000, 100000),
      fp(`L${order}_S_sol`, 0, false, -200,    200),
    ];
  }
  return [
    fp(`L${order}_H`, 0, false, -100000, 100000),
    fp(`L${order}_S`, 0, false, -200,    200),
  ];
}

export function getRKTermNamesToRemove(systemType: SystemType, order: number): string[] {
  if (systemType === 'isomorphous') {
    return [
      `L${order}_H_liq`, `L${order}_S_liq`,
      `L${order}_H_sol`, `L${order}_S_sol`,
    ];
  }
  return [`L${order}_H`, `L${order}_S`];
}

export function createTransitionParams(comp: 'A' | 'B', index: number): FitParameter[] {
  return [
    fp(`Ttrans_${comp}_${index}`,  800,  true, 0, 3000),
    fp(`dHtrans_${comp}_${index}`, 2000, true, 0, 20000),
  ];
}

export function createCompoundParams(id: string): FitParameter[] {
  return [
    fp(`stoich_${id}`, 0.5,   true,  0.01, 0.99),
    fp(`Tfus_${id}`,   1100,  false, 500,  3000),
    fp(`dHfus_${id}`,  15000, false, 1000, 100000),
  ];
}

export function getCompoundParamNames(id: string): string[] {
  return [`stoich_${id}`, `Tfus_${id}`, `dHfus_${id}`];
}

// ─── Подсчёт RK для определения текущего порядка ─────────────────────────────

export function currentRKOrder(params: FitParameter[], systemType: SystemType): number {
  if (systemType === 'isomorphous') return countRKTermsLiq(params);
  return countRKTermsEutectic(params);
}
