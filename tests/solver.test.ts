import { describe, expect, it } from 'vitest';
import { solve, GROUND, type Circuit } from '../src/lib/sim/solver';

const close = (actual: number, expected: number, tol = 1e-3) => {
  expect(Math.abs(actual - expected)).toBeLessThan(tol);
};

describe('solver: pure resistive', () => {
  it('Ohm law: 12V ideal source across 2Ω → 6A, V=12 at +', () => {
    const c: Circuit = {
      resistors: [{ id: 'R', a: 'P', b: GROUND, rOhm: 2 }],
      vSources: [{ id: 'BAT', pos: 'P', neg: GROUND, vVolts: 12 }],
    };
    const sol = solve(c)!;
    close(sol.voltages.get('P')!, 12);
    close(sol.resistorCurrents.get('R')!, 6);
    // Source delivers current OUT of + terminal, so current is +6A.
    close(sol.vSourceCurrents.get('BAT')!, 6);
  });

  it('series 2Ω + 4Ω across 12V → 2A, mid node = 8V', () => {
    const c: Circuit = {
      resistors: [
        { id: 'R1', a: 'P', b: 'M', rOhm: 2 },
        { id: 'R2', a: 'M', b: GROUND, rOhm: 4 },
      ],
      vSources: [{ id: 'BAT', pos: 'P', neg: GROUND, vVolts: 12 }],
    };
    const sol = solve(c)!;
    close(sol.voltages.get('M')!, 8);
    close(sol.resistorCurrents.get('R1')!, 2);
    close(sol.resistorCurrents.get('R2')!, 2);
  });

  it('parallel loads sum currents', () => {
    const c: Circuit = {
      resistors: [
        { id: 'R1', a: 'P', b: GROUND, rOhm: 4 },
        { id: 'R2', a: 'P', b: GROUND, rOhm: 6 },
      ],
      vSources: [{ id: 'BAT', pos: 'P', neg: GROUND, vVolts: 12 }],
    };
    const sol = solve(c)!;
    close(sol.resistorCurrents.get('R1')!, 3);
    close(sol.resistorCurrents.get('R2')!, 2);
    close(sol.vSourceCurrents.get('BAT')!, 5);
  });
});

describe('solver: Thevenin (battery with rInt)', () => {
  it('12V battery with 0.05Ω rInt drives 5Ω → V_out ≈ 11.88V, I ≈ 2.376A', () => {
    const c: Circuit = {
      resistors: [{ id: 'R', a: 'P', b: GROUND, rOhm: 5 }],
      vSources: [{ id: 'BAT', pos: 'P', neg: GROUND, vVolts: 12, rIntOhm: 0.05 }],
    };
    const sol = solve(c)!;
    const i = 12 / (5 + 0.05);
    close(sol.resistorCurrents.get('R')!, i, 1e-3);
    close(sol.voltages.get('P')!, i * 5, 1e-2);
  });
});

describe('solver: switches (very high R = open, very low R = closed)', () => {
  it('open switch isolates load: I ≈ 0', () => {
    const c: Circuit = {
      resistors: [
        { id: 'SW', a: 'P', b: 'X', rOhm: 1e9 },
        { id: 'R', a: 'X', b: GROUND, rOhm: 5 },
      ],
      vSources: [{ id: 'BAT', pos: 'P', neg: GROUND, vVolts: 12 }],
    };
    const sol = solve(c)!;
    expect(Math.abs(sol.resistorCurrents.get('R')!)).toBeLessThan(1e-6);
  });

  it('closed switch (1mΩ) passes current to load with negligible drop', () => {
    const c: Circuit = {
      resistors: [
        { id: 'SW', a: 'P', b: 'X', rOhm: 1e-3 },
        { id: 'R', a: 'X', b: GROUND, rOhm: 5 },
      ],
      vSources: [{ id: 'BAT', pos: 'P', neg: GROUND, vVolts: 12 }],
    };
    const sol = solve(c)!;
    close(sol.resistorCurrents.get('R')!, 12 / 5.001, 1e-3);
  });
});

describe('solver: constant-power loads', () => {
  it('30W load on 12V → ~2.5A and R≈4.8Ω', () => {
    const c: Circuit = {
      resistors: [],
      vSources: [{ id: 'BAT', pos: 'P', neg: GROUND, vVolts: 12, rIntOhm: 1e-4 }],
      pLoads: [{ id: 'PL', a: 'P', b: GROUND, watts: 30 }],
    };
    const sol = solve(c)!;
    expect(sol.converged).toBe(true);
    const i = sol.loadCurrents.get('PL')!;
    close(i, 2.5, 1e-2);
    close(sol.loadResistance.get('PL')!, 4.8, 1e-2);
  });

  it('two power loads in series-then-parallel through wire R', () => {
    // 12V battery (rInt=0) -> wire 0.05Ω -> bus -> two parallel 30W loads
    const c: Circuit = {
      resistors: [{ id: 'WIRE', a: 'P', b: 'BUS', rOhm: 0.05 }],
      vSources: [{ id: 'BAT', pos: 'P', neg: GROUND, vVolts: 12 }],
      pLoads: [
        { id: 'L1', a: 'BUS', b: GROUND, watts: 30 },
        { id: 'L2', a: 'BUS', b: GROUND, watts: 30 },
      ],
    };
    const sol = solve(c)!;
    expect(sol.converged).toBe(true);
    const i1 = sol.loadCurrents.get('L1')!;
    const i2 = sol.loadCurrents.get('L2')!;
    const total = i1 + i2;
    // V_bus solves V·I = 60W with V = 12 - 0.05·I  →  I ≈ 5.05A
    close(total, 5.05, 0.1);
    close(i1, i2, 1e-3);
  });

  it('load below vMin draws ~zero', () => {
    const c: Circuit = {
      resistors: [],
      vSources: [{ id: 'BAT', pos: 'P', neg: GROUND, vVolts: 8 }],
      pLoads: [{ id: 'L', a: 'P', b: GROUND, watts: 30, vMin: 10 }],
    };
    const sol = solve(c)!;
    expect(Math.abs(sol.loadCurrents.get('L')!)).toBeLessThan(1e-6);
  });
});

describe('solver: multi-source', () => {
  it('parallel batteries share load roughly equally', () => {
    const c: Circuit = {
      resistors: [{ id: 'R', a: 'P', b: GROUND, rOhm: 2 }],
      vSources: [
        { id: 'B1', pos: 'P', neg: GROUND, vVolts: 12, rIntOhm: 0.05 },
        { id: 'B2', pos: 'P', neg: GROUND, vVolts: 12, rIntOhm: 0.05 },
      ],
    };
    const sol = solve(c)!;
    const iLoad = sol.resistorCurrents.get('R')!;
    const i1 = sol.vSourceCurrents.get('B1')!;
    const i2 = sol.vSourceCurrents.get('B2')!;
    close(i1, i2, 1e-3);
    close(i1 + i2, iLoad, 1e-3);
  });

  it('mismatched batteries: stronger one sources more', () => {
    const c: Circuit = {
      resistors: [{ id: 'R', a: 'P', b: GROUND, rOhm: 2 }],
      vSources: [
        { id: 'B1', pos: 'P', neg: GROUND, vVolts: 12.6, rIntOhm: 0.05 },
        { id: 'B2', pos: 'P', neg: GROUND, vVolts: 12.0, rIntOhm: 0.05 },
      ],
    };
    const sol = solve(c)!;
    expect(sol.vSourceCurrents.get('B1')!).toBeGreaterThan(sol.vSourceCurrents.get('B2')!);
  });
});
