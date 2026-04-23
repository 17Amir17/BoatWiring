import { describe, expect, it } from 'vitest';
import { runSandbox } from '../src/lib/sim/sandbox';
import type { ComponentDef } from '../src/types';

const close = (a: number, b: number, tol = 1e-2) =>
  expect(Math.abs(a - b)).toBeLessThan(tol);

const switchDef: ComponentDef = {
  id: 'switch-spst',
  kind: 'switch',
  name: 'SPST',
  size: { w: 30, h: 20 },
  ports: [
    { id: 'in', label: 'IN', rel: { x: 0, y: 0.5 }, role: 'passthrough' },
    { id: 'out', label: 'OUT', rel: { x: 1, y: 0.5 }, role: 'passthrough' },
  ],
  specs: {},
};

const fuseDef: ComponentDef = {
  id: 'fuse-30a',
  kind: 'fuse',
  name: 'ATC 30A',
  size: { w: 20, h: 12 },
  ports: [
    { id: 'a', label: 'A', rel: { x: 0, y: 0.5 }, role: 'passthrough' },
    { id: 'b', label: 'B', rel: { x: 1, y: 0.5 }, role: 'passthrough' },
  ],
  specs: { ratingA: 30 },
};

const selectorDef: ComponentDef = {
  id: 'sel-disc',
  kind: 'selectorSwitch',
  name: 'Battery Disconnect',
  size: { w: 60, h: 60 },
  ports: [
    { id: 'in1', label: 'IN1', rel: { x: 0, y: 0.25 }, role: 'passthrough' },
    { id: 'in2', label: 'IN2', rel: { x: 0, y: 0.75 }, role: 'passthrough' },
    { id: 'out', label: 'OUT', rel: { x: 1, y: 0.5 }, role: 'passthrough' },
  ],
  specs: {},
  selector: {
    defaultPosition: 0,
    positions: [
      { label: 'OFF', conduct: [] },
      { label: 'BAT1', conduct: [['in1', 'out']] },
      { label: 'BAT2', conduct: [['in2', 'out']] },
      { label: 'BOTH', conduct: [['in1', 'out'], ['in2', 'out']] },
    ],
  },
};

describe('sandbox: switch', () => {
  it('switch closed: output ≈ input voltage', () => {
    const r = runSandbox(switchDef, {
      drive: [
        { portId: 'in', source: { kind: 'voltage', v: 12 } },
        { portId: 'out', source: { kind: 'load', watts: 6 } },
      ],
      state: { on: true, faults: [] },
    });
    expect(r.converged).toBe(true);
    close(r.voltages.in!, 12, 0.5);
    close(r.voltages.out!, 12, 0.5);
  });

  it('switch open: output ≈ 0 (load draws nothing because below vMin)', () => {
    const r = runSandbox(switchDef, {
      drive: [
        { portId: 'in', source: { kind: 'voltage', v: 12 } },
        { portId: 'out', source: { kind: 'load', watts: 6, vMin: 10 } },
      ],
      state: { on: false, faults: [] },
    });
    expect(r.converged).toBe(true);
    expect(r.voltages.out!).toBeLessThan(1);
  });
});

describe('sandbox: fuse', () => {
  it('intact fuse passes current', () => {
    const r = runSandbox(fuseDef, {
      drive: [
        { portId: 'a', source: { kind: 'voltage', v: 12 } },
        { portId: 'b', source: { kind: 'load', watts: 12 } },
      ],
    });
    expect(r.converged).toBe(true);
    close(r.voltages.b!, 12, 0.5);
  });

  it('blown fuse blocks current', () => {
    const r = runSandbox(fuseDef, {
      drive: [
        { portId: 'a', source: { kind: 'voltage', v: 12 } },
        { portId: 'b', source: { kind: 'load', watts: 12, vMin: 10 } },
      ],
      fuseOpen: { DUT: true },
    });
    expect(r.converged).toBe(true);
    expect(r.voltages.b!).toBeLessThan(1);
  });
});

describe('sandbox: selectorSwitch', () => {
  it('OFF: out is isolated', () => {
    const r = runSandbox(selectorDef, {
      drive: [
        { portId: 'in1', source: { kind: 'voltage', v: 12 } },
        { portId: 'in2', source: { kind: 'voltage', v: 12.6 } },
        { portId: 'out', source: { kind: 'load', watts: 6, vMin: 10 } },
      ],
      state: { selectedPosition: 0, faults: [] },
    });
    expect(r.voltages.out!).toBeLessThan(1);
  });

  it('BAT1: out follows in1', () => {
    const r = runSandbox(selectorDef, {
      drive: [
        { portId: 'in1', source: { kind: 'voltage', v: 12 } },
        { portId: 'in2', source: { kind: 'voltage', v: 13.5 } },
        { portId: 'out', source: { kind: 'load', watts: 6 } },
      ],
      state: { selectedPosition: 1, faults: [] },
    });
    close(r.voltages.out!, 12, 0.5);
  });

  it('BAT2: out follows in2', () => {
    const r = runSandbox(selectorDef, {
      drive: [
        { portId: 'in1', source: { kind: 'voltage', v: 12 } },
        { portId: 'in2', source: { kind: 'voltage', v: 13.5 } },
        { portId: 'out', source: { kind: 'load', watts: 6 } },
      ],
      state: { selectedPosition: 2, faults: [] },
    });
    close(r.voltages.out!, 13.5, 0.5);
  });
});
