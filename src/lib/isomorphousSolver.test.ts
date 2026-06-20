import { describe, it, expect } from 'vitest';
import { CubicSpline, solveIsomorphousPoint, buildIsomorphousProfile } from '@/lib/isomorphousSolver';
import type { PureComponent } from '@/lib/thermodynamics';

describe('Cubic Spline Interpolation', () => {
  it('correctly interpolates a linear function', () => {
    const xs = [0, 0.25, 0.5, 0.75, 1];
    const ys = [100, 200, 300, 400, 500]; // y = 400 * x + 100
    const spline = new CubicSpline(xs, ys);

    expect(spline.interpolate(0)).toBeCloseTo(100, 5);
    expect(spline.interpolate(0.5)).toBeCloseTo(300, 5);
    expect(spline.interpolate(0.1)).toBeCloseTo(140, 5);
    expect(spline.interpolate(0.9)).toBeCloseTo(460, 5);
    expect(spline.interpolate(1)).toBeCloseTo(500, 5);
  });

  it('correctly interpolates a quadratic function', () => {
    const xs = [0, 0.2, 0.4, 0.6, 0.8, 1];
    const ys = xs.map(x => x * x); // y = x^2
    const spline = new CubicSpline(xs, ys);

    expect(spline.interpolate(0)).toBeCloseTo(0, 5);
    expect(spline.interpolate(0.5)).toBeCloseTo(0.25, 2); // сплайн дает небольшую погрешность для x^2
    expect(spline.interpolate(1)).toBeCloseTo(1, 5);
  });
});

describe('Isomorphous Coexistence Solver', () => {
  it('matches analytical formulas for ideal solution (Lv = 0)', () => {
    const compA: PureComponent = { Tfus: 1000, dHfus: 10000, transitions: [] };
    const compB: PureComponent = { Tfus: 800, dHfus: 8000, transitions: [] };

    const T = 900;
    const R = 8.314;

    // K_i(T) = exp( (dHfus_i / R) * (1/Tfus_i - 1/T) )
    const Ka = Math.exp((compA.dHfus / R) * (1 / compA.Tfus - 1 / T));
    const Kb = Math.exp((compB.dHfus / R) * (1 / compB.Tfus - 1 / T));

    // Аналитическое решение:
    const expectedXbSol = (Ka - 1) / (Ka - Kb);
    const expectedXbLiq = Kb * expectedXbSol;

    const coex = solveIsomorphousPoint(expectedXbLiq, compA, compB, [], [], [], []);

    expect(coex.T).toBeCloseTo(T, 4);
    expect(coex.xB_sol).toBeCloseTo(expectedXbSol, 4);
  });

  it('builds isomorphous profile successfully and interpolates temperatures', () => {
    const compA: PureComponent = { Tfus: 1000, dHfus: 10000, transitions: [] };
    const compB: PureComponent = { Tfus: 800, dHfus: 8000, transitions: [] };

    const profile = buildIsomorphousProfile(compA, compB, [], [], [], [], 50);

    expect(profile.points.length).toBeGreaterThan(2);
    // Проверим, что сплайны инициализированы
    expect(profile.liquidusSpline).toBeDefined();
    expect(profile.solidusSpline).toBeDefined();

    // В чистых компонентах температура должна совпадать с точками плавления
    expect(profile.liquidusSpline.interpolate(0)).toBeCloseTo(1000, 3);
    expect(profile.liquidusSpline.interpolate(1)).toBeCloseTo(800, 3);
    expect(profile.solidusSpline.interpolate(0)).toBeCloseTo(1000, 3);
    expect(profile.solidusSpline.interpolate(1)).toBeCloseTo(800, 3);
  });
});
