/**
 * SSOT для генерации и отображения ветвей диаграммы.
 * DataInput и LLMPanel используют только этот модуль.
 */

import type { FitParameter } from '@/lib/fitAdapter';
import type { BranchDef } from '@/lib/types';
import { encodeBranch } from '@/lib/types';
import {
  isTransitionParameter,
  getCompoundIds,
} from '@/lib/parameterSchema';
import type { SystemType } from '@/lib/parameterSchema';

export interface BranchOption {
  value: string;   // encodeBranch(branchDef)
  label: string;
}

export function buildBranchOptions(
  parameters: FitParameter[],
  systemType: SystemType,
  compAName: string,
  compBName: string,
): BranchOption[] {
  if (systemType === 'isomorphous') {
    return [
      { value: encodeBranch({ type: 'lens', curve: 'liquidus' }), label: 'Ликвидус (линза)' },
      { value: encodeBranch({ type: 'lens', curve: 'solidus' }),  label: 'Солидус (линза)' },
    ];
  }

  const options: BranchOption[] = [
    { value: encodeBranch({ type: 'pure', comp: 'A' }), label: `Ветвь ${compAName}` },
    { value: encodeBranch({ type: 'pure', comp: 'B' }), label: `Ветвь ${compBName}` },
    { value: encodeBranch({ type: 'invariant', phases: ['A', 'B'] }), label: `Эвтектика ${compAName}–${compBName}` },
  ];

  // Переходы A
  parameters
    .filter(p => isTransitionParameter(p.name, 'A'))
    .forEach(p => {
      const idx = parseInt(p.name.split('_')[2]);
      options.push({
        value: encodeBranch({ type: 'transition', comp: 'A', index: idx }),
        label: `Переход ${compAName} (${idx})`,
      });
    });

  // Переходы B
  parameters
    .filter(p => isTransitionParameter(p.name, 'B'))
    .forEach(p => {
      const idx = parseInt(p.name.split('_')[2]);
      options.push({
        value: encodeBranch({ type: 'transition', comp: 'B', index: idx }),
        label: `Переход ${compBName} (${idx})`,
      });
    });

  // Соединения
  const compoundIds = getCompoundIds(parameters);

  for (const id of compoundIds) {
    options.push({
      value: encodeBranch({ type: 'compound', id }),
      label: `Ликвидус ${id}`,
    });
    options.push({
      value: encodeBranch({ type: 'invariant', phases: ['A', id] }),
      label: `Инв. ${compAName}–${id}`,
    });
    options.push({
      value: encodeBranch({ type: 'invariant', phases: ['B', id] }),
      label: `Инв. ${compBName}–${id}`,
    });
  }

  for (let i = 0; i < compoundIds.length - 1; i++) {
    for (let j = i + 1; j < compoundIds.length; j++) {
      options.push({
        value: encodeBranch({ type: 'invariant', phases: [compoundIds[i], compoundIds[j]] }),
        label: `Инв. ${compoundIds[i]}–${compoundIds[j]}`,
      });
    }
  }

  return options;
}

/** Человеко-читаемый label ветви (для LLM export и прочего) */
export function formatBranchLabel(b: BranchDef): string {
  switch (b.type) {
    case 'pure':       return `Pure ${b.comp}`;
    case 'compound':   return `Compound ${b.id}`;
    case 'transition': return `Transition ${b.comp} (${b.index})`;
    case 'invariant':  return `Invariant (${b.phases.join('-')})`;
    case 'lens':       return `Lens (${b.curve})`;
    default:           return 'Unknown';
  }
}
