import { describe, it, expect } from 'vitest';
import { R, schroederRHS, liquidusResidualA } from './thermodynamics';

describe('Thermodynamics Core', () => {
  it('calculates Schroeder-Le Chatelier RHS correctly', () => {
    const comp = { Tfus: 1000, dHfus: 10000, transitions: [] };
    const T = 800;
    // (10000 / 8.314) * (1/1000 - 1/800) = 1202.79... * (0.001 - 0.00125) = 1202.79 * -0.00025 = -0.30069
    const expected = (comp.dHfus / R) * (1 / comp.Tfus - 1 / T);
    expect(schroederRHS(T, comp)).toBeCloseTo(expected, 5);
  });

  it('calculates ideal liquidus residual correctly', () => {
    const comp = { Tfus: 1000, dHfus: 10000, transitions: [] };
    const xA = 0.8;
    const gammaA = 1.0; // Ideal solution
    const T = 900;
    
    // residual = ln(x * gamma) - RHS
    const expected = Math.log(xA * gammaA) - schroederRHS(T, comp);
    expect(liquidusResidualA(T, xA, gammaA, comp)).toBeCloseTo(expected, 5);
  });
});
