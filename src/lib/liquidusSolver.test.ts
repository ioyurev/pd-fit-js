import { describe, it, expect } from 'vitest';
import {
  determineInvariantType,
  getInvariantDisplaySpan,
  getPhaseCompositionX,
  findInvariantPoint,
} from '@/lib/liquidusSolver';
import type { PureComponent } from '@/lib/thermodynamics';
import type { Compound } from '@/lib/types';

const compounds: Compound[] = [
  { id: 'C1', stoichB: 0.4, Tfus: 1000, dHfus: 10000 },
];

describe('Invariant topology helpers', () => {
  it('returns canonical compositions for A, B and compounds', () => {
    expect(getPhaseCompositionX('A', compounds)).toBe(0);
    expect(getPhaseCompositionX('B', compounds)).toBe(1);
    expect(getPhaseCompositionX('C1', compounds)).toBe(0.4);
  });

  it('classifies liquid composition inside solid-phase interval as eutectic', () => {
    expect(determineInvariantType(0.2, ['A', 'C1'], compounds)).toBe('eutectic');
  });

  it('classifies liquid composition outside solid-phase interval as peritectic', () => {
    expect(determineInvariantType(0.7, ['A', 'C1'], compounds)).toBe('peritectic');
  });

  it('extends invariant display span to include liquid composition', () => {
    expect(getInvariantDisplaySpan(0.7, ['A', 'C1'], compounds)).toEqual({
      xLeft: 0,
      xRight: 0.7,
    });
  });
});

describe('findInvariantPoint', () => {
  it('returns NaN when phase pair has no valid intersection', () => {
    const compA: PureComponent = { Tfus: 1000, dHfus: 10000, transitions: [] };
    const compB: PureComponent = { Tfus: 900, dHfus: 9000, transitions: [] };

    const inv = findInvariantPoint(['A', 'UNKNOWN'], compA, compB, [], [], []);
    expect(Number.isNaN(inv.xB)).toBe(true);
    expect(Number.isNaN(inv.T)).toBe(true);
  });

  it('finds a finite pairwise intersection for a valid phase pair', () => {
    const compA: PureComponent = { Tfus: 1000, dHfus: 10000, transitions: [] };
    const compB: PureComponent = { Tfus: 800, dHfus: 8000, transitions: [] };

    const inv = findInvariantPoint(['A', 'C1'], compA, compB, compounds, [0], [0]);

    expect(Number.isFinite(inv.xB)).toBe(true);
    expect(Number.isFinite(inv.T)).toBe(true);
    expect(inv.xB).toBeGreaterThan(0);
    expect(inv.xB).toBeLessThan(1);
    expect(inv.T).toBeGreaterThan(0);
  });
});

describe('findInvariantPoint fallback behaviour', () => {
  it('returns finite closest-approach point when curves do not cross but both are valid', () => {
    const compA: PureComponent = { Tfus: 1000, dHfus: 10000, transitions: [] };
    const compB: PureComponent = { Tfus: 900, dHfus: 9000, transitions: [] };

    const compounds: Compound[] = [
      { id: 'C1', stoichB: 0.5, Tfus: 2000, dHfus: 20000 },
    ];

    const inv = findInvariantPoint(['A', 'C1'], compA, compB, compounds, [], []);

    expect(Number.isFinite(inv.xB)).toBe(true);
    expect(Number.isFinite(inv.T)).toBe(true);
    expect(inv.xB).toBeGreaterThan(0);
    expect(inv.xB).toBeLessThan(1);
    expect(inv.T).toBeGreaterThan(0);
  });

  it('returns NaN only when there is no valid common temperature region at all', () => {
    const compA: PureComponent = { Tfus: 1000, dHfus: 10000, transitions: [] };
    const compB: PureComponent = { Tfus: 900, dHfus: 9000, transitions: [] };

    const inv = findInvariantPoint(['A', 'UNKNOWN'], compA, compB, [], [], []);

    expect(Number.isNaN(inv.xB)).toBe(true);
    expect(Number.isNaN(inv.T)).toBe(true);
  });
});
