import { describe, it, expect } from 'vitest';
import {
  CURRENT_VERSION,
  detectVersion,
  migrateToLatest,
  normalizeProjectData,
  UnsupportedVersionError,
} from '@/lib/migrations';

describe('Version Detection', () => {
  it('returns 0 for null/undefined', () => {
    expect(detectVersion(null)).toBe(0);
    expect(detectVersion(undefined)).toBe(0);
  });

  it('returns 0 for object without version', () => {
    expect(detectVersion({ parameters: [] })).toBe(0);
  });

  it('returns version number when present', () => {
    expect(detectVersion({ version: 1 })).toBe(1);
    expect(detectVersion({ version: 42 })).toBe(42);
  });
});

describe('Migration v0 → v1', () => {
  const legacyData = {
    dataPoints: [
      { xB: 0.3, T: 800, sigma: 2, weight: 0.25, branch: 'A' },
      { xB: 0.7, T: 750, sigma: 1, weight: 1, branch: 'B' },
      { xB: 0.5, T: 600, sigma: 5, weight: 0.04, branch: 'eutectic' },
      { xB: 0.2, T: 780, sigma: 1, weight: 1, branch: 'Ttrans_A_0' },
    ],
    parameters: [
      { name: 'Tfus_A', value: 1000, fixed: true },
      { name: 'dHfus_A', value: 10000, fixed: true },
      { name: 'Ttrans_A', value: 800, fixed: true },
      { name: 'dHtrans_A', value: 2000, fixed: true },
      { name: 'L0_H', value: -5000, fixed: false },
      { name: 'L0_S', value: 10, fixed: false },
    ],
  };

  it('migrates to version 1', () => {
    const result = migrateToLatest(legacyData);
    expect(result.version).toBe(1);
  });

  it('converts string branches to BranchDef', () => {
    const result = migrateToLatest(legacyData);
    expect(result.dataPoints[0].branch).toEqual({ type: 'pure', comp: 'A' });
    expect(result.dataPoints[1].branch).toEqual({ type: 'pure', comp: 'B' });
    expect(result.dataPoints[2].branch).toEqual({ type: 'invariant', phases: ['A', 'B'] });
    expect(result.dataPoints[3].branch).toEqual({ type: 'transition', comp: 'A', index: 0 });
  });

  it('removes weight from data points', () => {
    const result = migrateToLatest(legacyData);
    for (const dp of result.dataPoints) {
      expect(dp).not.toHaveProperty('weight');
    }
  });

  it('renames legacy parameter names', () => {
    const result = migrateToLatest(legacyData);
    const names = result.parameters.map((p: any) => p.name);
    expect(names).toContain('Ttrans_A_0');
    expect(names).toContain('dHtrans_A_0');
    expect(names).not.toContain('Ttrans_A');
    expect(names).not.toContain('dHtrans_A');
  });

  it('adds boundsEnabled to parameters', () => {
    const result = migrateToLatest(legacyData);
    for (const p of result.parameters) {
      expect(p).toHaveProperty('boundsEnabled');
    }
  });

  it('detects systemType as eutectic for legacy data', () => {
    const result = migrateToLatest(legacyData);
    expect(result.systemType).toBe('eutectic');
  });

  it('detects systemType as isomorphous when _liq params present', () => {
    const data = {
      parameters: [
        { name: 'L0_H_liq', value: 0 },
        { name: 'L0_S_liq', value: 0 },
      ],
      dataPoints: [],
    };
    const result = migrateToLatest(data);
    expect(result.systemType).toBe('isomorphous');
  });

  it('adds default component names', () => {
    const result = migrateToLatest(legacyData);
    expect(result.compAName).toBe('A');
    expect(result.compBName).toBe('B');
  });
});

describe('Already Current Version', () => {
  it('passes through data at current version', () => {
    const data = {
      version: CURRENT_VERSION,
      systemType: 'eutectic',
      compAName: 'Pb',
      compBName: 'Sn',
      parameters: [{ name: 'Tfus_A', value: 600, fixed: true, min: 0, max: 1000, boundsEnabled: false }],
      dataPoints: [],
    };
    const result = migrateToLatest(data);
    expect(result.version).toBe(CURRENT_VERSION);
    expect(result.compAName).toBe('Pb');
  });
});

describe('Future Version', () => {
  it('throws UnsupportedVersionError for newer versions', () => {
    const futureData = { version: 999, parameters: [] };
    expect(() => migrateToLatest(futureData)).toThrow(UnsupportedVersionError);
  });
});

describe('normalizeProjectData', () => {
  it('normalizes legacy data into full structure', () => {
    const result = normalizeProjectData({ dataPoints: [], parameters: [] });
    expect(result.version).toBe(CURRENT_VERSION);
    expect(result.systemType).toBe('eutectic');
    expect(result.compAName).toBe('A');
    expect(result.compBName).toBe('B');
    expect(result.parameters).toEqual([]);
    expect(result.dataPoints).toEqual([]);
  });
});
