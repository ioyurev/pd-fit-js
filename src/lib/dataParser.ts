import Papa from 'papaparse';

export interface RawPoint {
  xA: number;
  T: number;
  sigma?: number;
}

export function parseCSV(text: string): RawPoint[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  return result.data.map(row => ({
    xA: Number(row['xA'] ?? row['x'] ?? row['X']),
    T:  Number(row['T'] ?? row['temperature'] ?? row['Temperature']),
    sigma: row['sigma'] ? Number(row['sigma']) : undefined,
  })).filter(p => isFinite(p.xA) && isFinite(p.T) && p.xA >= 0 && p.xA <= 1);
}

export function assignBranches(
  points: RawPoint[],
): Array<RawPoint & { branch: 'A' | 'B' | 'eutectic' }> {
  if (points.length === 0) return [];
  const eutIdx = points.reduce(
    (minI, p, i) => (p.T < points[minI].T ? i : minI), 0
  );
  const xE = points[eutIdx].xA;

  return points.map((p, i) => ({
    ...p,
    branch: i === eutIdx ? 'eutectic'
          : p.xA >= xE   ? 'A'
          : 'B',
  }));
}

export function defaultWeights(
  points: Array<{ sigma?: number }>,
): number[] {
  return points.map(p => p.sigma ? 1 / (p.sigma ** 2) : 1);
}