// Типизированный discriminated union для ветвей ликвидуса.
// Заменяет хрупкие строки вида "Ttrans_A_0", "intersect_A_C1" и т.д.

export type BranchDef =
  | { type: 'pure'; comp: 'A' | 'B' }
  | { type: 'compound'; id: string }
  | { type: 'transition'; comp: 'A' | 'B'; index: number }
  | { type: 'invariant'; phases: string[] } // фазы, пересекающиеся в инвариантной точке
  | { type: 'lens'; curve: 'liquidus' | 'solidus' };

// Сериализация/десериализация BranchDef для хранения в store и URL
export function encodeBranch(b: BranchDef): string {
  return JSON.stringify(b);
}

export function decodeBranch(s: string): BranchDef {
  try {
    return JSON.parse(s) as BranchDef;
  } catch {
    // Миграция legacy-строк из старых URL
    if (s === 'A') return { type: 'pure', comp: 'A' };
    if (s === 'B') return { type: 'pure', comp: 'B' };
    if (s === 'eutectic') return { type: 'invariant', phases: ['A', 'B'] };
    const ttaMatch = s.match(/^Ttrans_A_(\d+)$/);
    if (ttaMatch) return { type: 'transition', comp: 'A', index: parseInt(ttaMatch[1]) };
    const ttbMatch = s.match(/^Ttrans_B_(\d+)$/);
    if (ttbMatch) return { type: 'transition', comp: 'B', index: parseInt(ttbMatch[1]) };
    // Fallback
    return { type: 'pure', comp: 'A' };
  }
}

export interface Compound {
  id: string;       // 'C1', 'C2', …
  // TODO: В будущем, если автор сочтёт необходимым, stoichB можно сделать
  // свободным параметром FitParameter (для нестехиометрических фаз).
  // Сейчас жёстко фиксируется пользователем и не участвует в оптимизации.
  stoichB: number;  // x_c ∈ (0, 1), фиксирован
  Tfus: number;     // K
  dHfus: number;    // Дж/моль
}
