import { describe, expect, it } from 'vitest';
import { build, type BoatNode, type BoatEdge } from '../src/lib/sim/stamping';
import { solve } from '../src/lib/sim/solver';
import type { ComponentDef, WireDef } from '../src/types';

const close = (a: number, b: number, tol = 1e-2) =>
  expect(Math.abs(a - b)).toBeLessThan(tol);

const battery: ComponentDef = {
  id: 'battery-100ah',
  kind: 'battery',
  name: '100Ah AGM',
  size: { w: 80, h: 60 },
  ports: [
    { id: 'pos', label: '+', rel: { x: 1, y: 0 }, role: 'source' },
    { id: 'neg', label: '-', rel: { x: 0, y: 0 }, role: 'sink' },
  ],
  specs: { capacityAh: 100, vNominal: 12.7, rInternalOhm: 0.02 },
};

const switchDef: ComponentDef = {
  id: 'switch-spst',
  kind: 'switch',
  name: 'Rocker SPST',
  size: { w: 30, h: 20 },
  ports: [
    { id: 'in', label: 'IN', rel: { x: 0, y: 0.5 }, role: 'passthrough' },
    { id: 'out', label: 'OUT', rel: { x: 1, y: 0.5 }, role: 'passthrough' },
  ],
  specs: { ratedA: 20 },
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
  specs: { ratingA: 30, formFactor: 'ATC' },
};

const ledLoad: ComponentDef = {
  id: 'led-nav',
  kind: 'load',
  name: 'Nav LED 6W',
  size: { w: 30, h: 30 },
  ports: [
    { id: 'in', label: '+', rel: { x: 0, y: 0.5 }, role: 'sink' },
    { id: 'out', label: '-', rel: { x: 1, y: 0.5 }, role: 'sink' },
  ],
  specs: { wattsOn: 6, vMin: 10, vMax: 30 },
};

const wire16AwgRed: WireDef = {
  id: 'wire-16-red',
  name: 'Marine 16AWG red',
  gaugeAWG: 16,
  maxAmps: 22,
  insulationColor: 'red',
};

function input(nodes: BoatNode[], edges: BoatEdge[]) {
  const defs = new Map([
    [battery.id, battery],
    [switchDef.id, switchDef],
    [fuseDef.id, fuseDef],
    [ledLoad.id, ledLoad],
  ]);
  const wireDefs = new Map([[wire16AwgRed.id, wire16AwgRed]]);
  return {
    defs,
    wireDefs,
    nodes,
    edges,
    soc: { B1: 1.0 },
    fuseOpen: {},
  };
}

describe('stamping: simple loop', () => {
  it('battery → switch → fuse → load → battery, switch on, draws ~6W', () => {
    const nodes: BoatNode[] = [
      { id: 'B1', data: { defId: 'battery-100ah', faults: [] } },
      { id: 'SW1', data: { defId: 'switch-spst', on: true, faults: [] } },
      { id: 'F1', data: { defId: 'fuse-30a', faults: [] } },
      { id: 'L1', data: { defId: 'led-nav', on: true, faults: [] } },
    ];
    const edges: BoatEdge[] = [
      { id: 'e1', source: 'B1', sourceHandle: 'pos', target: 'SW1', targetHandle: 'in', data: { wireDefId: 'wire-16-red', lengthFt: 5 } },
      { id: 'e2', source: 'SW1', sourceHandle: 'out', target: 'F1', targetHandle: 'a', data: { wireDefId: 'wire-16-red', lengthFt: 1 } },
      { id: 'e3', source: 'F1', sourceHandle: 'b', target: 'L1', targetHandle: 'in', data: { wireDefId: 'wire-16-red', lengthFt: 5 } },
      { id: 'e4', source: 'L1', sourceHandle: 'out', target: 'B1', targetHandle: 'neg', data: { wireDefId: 'wire-16-red', lengthFt: 5 } },
    ];
    const built = build(input(nodes, edges));
    const sol = solve(built.circuit)!;
    expect(sol.converged).toBe(true);
    const i = sol.loadCurrents.get('PL_L1')!;
    // ~6W at ~12.5V → ~0.48A. Wire+source rIn drop trims V slightly.
    close(i, 0.48, 0.05);
  });

  it('switch off → no current', () => {
    const nodes: BoatNode[] = [
      { id: 'B1', data: { defId: 'battery-100ah', faults: [] } },
      { id: 'SW1', data: { defId: 'switch-spst', on: false, faults: [] } },
      { id: 'L1', data: { defId: 'led-nav', on: true, faults: [] } },
    ];
    const edges: BoatEdge[] = [
      { id: 'e1', source: 'B1', sourceHandle: 'pos', target: 'SW1', targetHandle: 'in', data: { wireDefId: 'wire-16-red', lengthFt: 1 } },
      { id: 'e2', source: 'SW1', sourceHandle: 'out', target: 'L1', targetHandle: 'in', data: { wireDefId: 'wire-16-red', lengthFt: 1 } },
      { id: 'e3', source: 'L1', sourceHandle: 'out', target: 'B1', targetHandle: 'neg', data: { wireDefId: 'wire-16-red', lengthFt: 1 } },
    ];
    const built = build(input(nodes, edges));
    const sol = solve(built.circuit)!;
    expect(Math.abs(sol.loadCurrents.get('PL_L1')!)).toBeLessThan(1e-3);
  });

  it('blown fuse blocks current to load', () => {
    const nodes: BoatNode[] = [
      { id: 'B1', data: { defId: 'battery-100ah', faults: [] } },
      { id: 'F1', data: { defId: 'fuse-30a', faults: [] } },
      { id: 'L1', data: { defId: 'led-nav', on: true, faults: [] } },
    ];
    const edges: BoatEdge[] = [
      { id: 'e1', source: 'B1', sourceHandle: 'pos', target: 'F1', targetHandle: 'a', data: { wireDefId: 'wire-16-red', lengthFt: 1 } },
      { id: 'e2', source: 'F1', sourceHandle: 'b', target: 'L1', targetHandle: 'in', data: { wireDefId: 'wire-16-red', lengthFt: 1 } },
      { id: 'e3', source: 'L1', sourceHandle: 'out', target: 'B1', targetHandle: 'neg', data: { wireDefId: 'wire-16-red', lengthFt: 1 } },
    ];
    const inp = input(nodes, edges);
    inp.fuseOpen = { F1: true };
    const built = build(inp);
    const sol = solve(built.circuit)!;
    expect(Math.abs(sol.loadCurrents.get('PL_L1')!)).toBeLessThan(1e-3);
  });
});

describe('stamping: selectorSwitch (battery disconnect)', () => {
  const selDef: ComponentDef = {
    id: 'sel-12v-200a',
    kind: 'selectorSwitch',
    name: 'Battery Disconnect 1-2-BOTH-OFF',
    size: { w: 60, h: 60 },
    ports: [
      { id: 'in1', label: 'IN1', rel: { x: 0, y: 0.25 }, role: 'passthrough' },
      { id: 'in2', label: 'IN2', rel: { x: 0, y: 0.75 }, role: 'passthrough' },
      { id: 'out', label: 'OUT', rel: { x: 1, y: 0.5 }, role: 'passthrough' },
    ],
    specs: { ratedA: 200 },
    selector: {
      defaultPosition: 0,
      positions: [
        { label: 'OFF', conduct: [] },
        { label: 'BAT1', conduct: [['in1', 'out']] },
        { label: 'BAT2', conduct: [['in2', 'out']] },
        { label: 'BOTH', conduct: [['in1', 'out'], ['in2', 'out'], ['in1', 'in2']] },
      ],
    },
  };

  const battery2: ComponentDef = { ...battery, id: 'battery-2' };

  function buildSel(position: number) {
    const defs = new Map<string, ComponentDef>([
      [battery.id, battery],
      [battery2.id, battery2],
      [selDef.id, selDef],
      [ledLoad.id, ledLoad],
    ]);
    const wireDefs = new Map([[wire16AwgRed.id, wire16AwgRed]]);
    const nodes: BoatNode[] = [
      { id: 'B1', data: { defId: battery.id, faults: [] } },
      { id: 'B2', data: { defId: battery2.id, faults: [] } },
      { id: 'SEL', data: { defId: selDef.id, selectedPosition: position, faults: [] } },
      { id: 'L1', data: { defId: ledLoad.id, on: true, faults: [] } },
    ];
    const edges: BoatEdge[] = [
      { id: 'e1', source: 'B1', sourceHandle: 'pos', target: 'SEL', targetHandle: 'in1', data: { wireDefId: 'wire-16-red', lengthFt: 1 } },
      { id: 'e2', source: 'B2', sourceHandle: 'pos', target: 'SEL', targetHandle: 'in2', data: { wireDefId: 'wire-16-red', lengthFt: 1 } },
      { id: 'e3', source: 'SEL', sourceHandle: 'out', target: 'L1', targetHandle: 'in', data: { wireDefId: 'wire-16-red', lengthFt: 1 } },
      { id: 'e4', source: 'L1', sourceHandle: 'out', target: 'B1', targetHandle: 'neg', data: { wireDefId: 'wire-16-red', lengthFt: 1 } },
      { id: 'e5', source: 'B2', sourceHandle: 'neg', target: 'B1', targetHandle: 'neg', data: { wireDefId: 'wire-16-red', lengthFt: 1 } },
    ];
    return { defs, wireDefs, nodes, edges, soc: { B1: 1.0, B2: 1.0 }, fuseOpen: {} };
  }

  it('OFF: no current', () => {
    const { circuit } = build(buildSel(0));
    const sol = solve(circuit)!;
    expect(Math.abs(sol.loadCurrents.get('PL_L1')!)).toBeLessThan(1e-3);
  });

  it('BAT1: load is powered', () => {
    const { circuit } = build(buildSel(1));
    const sol = solve(circuit)!;
    close(sol.loadCurrents.get('PL_L1')!, 0.48, 0.05);
  });

  it('BOTH: both batteries supply current', () => {
    const { circuit } = build(buildSel(3));
    const sol = solve(circuit)!;
    const i1 = sol.vSourceCurrents.get('V_B1')!;
    const i2 = sol.vSourceCurrents.get('V_B2')!;
    expect(i1).toBeGreaterThan(0);
    expect(i2).toBeGreaterThan(0);
  });
});

describe('stamping: composite (rocker panel mini)', () => {
  const panel: ComponentDef = {
    id: 'rocker-2gang',
    kind: 'composite',
    name: '2-gang rocker (test)',
    size: { w: 80, h: 40 },
    ports: [
      { id: 'in+', label: 'IN+', rel: { x: 0, y: 0.5 }, role: 'source' },
      { id: 'in-', label: 'IN-', rel: { x: 0, y: 0.9 }, role: 'sink' },
      { id: 'out1+', label: 'OUT1+', rel: { x: 1, y: 0.25 }, role: 'source' },
      { id: 'out1-', label: 'OUT1-', rel: { x: 1, y: 0.4 }, role: 'sink' },
      { id: 'out2+', label: 'OUT2+', rel: { x: 1, y: 0.6 }, role: 'source' },
      { id: 'out2-', label: 'OUT2-', rel: { x: 1, y: 0.75 }, role: 'sink' },
    ],
    specs: {},
    subComponents: [
      { id: 'sw1', subKind: 'switch', specs: {} },
      { id: 'sw2', subKind: 'switch', specs: {} },
    ],
    internalWiring: [
      // Common +: IN+ → SW1.+, IN+ → SW2.+
      { a: { external: 'in+' }, b: { subId: 'sw1', portId: '+' } },
      { a: { external: 'in+' }, b: { subId: 'sw2', portId: '+' } },
      // SW1.- → OUT1+, SW2.- → OUT2+
      { a: { subId: 'sw1', portId: '-' }, b: { external: 'out1+' } },
      { a: { subId: 'sw2', portId: '-' }, b: { external: 'out2+' } },
      // Ground returns straight through
      { a: { external: 'in-' }, b: { external: 'out1-' } },
      { a: { external: 'in-' }, b: { external: 'out2-' } },
    ],
  };

  it('toggling sub-switch 1 on enables only load 1', () => {
    const defs = new Map<string, ComponentDef>([
      [battery.id, battery],
      [panel.id, panel],
      [ledLoad.id, ledLoad],
    ]);
    const wireDefs = new Map([[wire16AwgRed.id, wire16AwgRed]]);
    const nodes: BoatNode[] = [
      { id: 'B1', data: { defId: battery.id, faults: [] } },
      { id: 'P1', data: { defId: panel.id, faults: [], subStates: { sw1: { on: true }, sw2: { on: false } } } as any },
      { id: 'L1', data: { defId: ledLoad.id, on: true, faults: [] } },
      { id: 'L2', data: { defId: ledLoad.id, on: true, faults: [] } },
    ];
    const edges: BoatEdge[] = [
      { id: 'e1', source: 'B1', sourceHandle: 'pos', target: 'P1', targetHandle: 'in+', data: { wireDefId: 'wire-16-red', lengthFt: 1 } },
      { id: 'e2', source: 'B1', sourceHandle: 'neg', target: 'P1', targetHandle: 'in-', data: { wireDefId: 'wire-16-red', lengthFt: 1 } },
      { id: 'e3', source: 'P1', sourceHandle: 'out1+', target: 'L1', targetHandle: 'in', data: { wireDefId: 'wire-16-red', lengthFt: 1 } },
      { id: 'e4', source: 'P1', sourceHandle: 'out1-', target: 'L1', targetHandle: 'out', data: { wireDefId: 'wire-16-red', lengthFt: 1 } },
      { id: 'e5', source: 'P1', sourceHandle: 'out2+', target: 'L2', targetHandle: 'in', data: { wireDefId: 'wire-16-red', lengthFt: 1 } },
      { id: 'e6', source: 'P1', sourceHandle: 'out2-', target: 'L2', targetHandle: 'out', data: { wireDefId: 'wire-16-red', lengthFt: 1 } },
    ];
    const built = build({ defs, wireDefs, nodes, edges, soc: { B1: 1.0 }, fuseOpen: {} });
    const sol = solve(built.circuit)!;
    expect(Math.abs(sol.loadCurrents.get('PL_L1')!)).toBeGreaterThan(0.3);
    expect(Math.abs(sol.loadCurrents.get('PL_L2')!)).toBeLessThan(1e-3);
  });
});

describe('stamping: water fault leaks current to ground', () => {
  it('switch with water fault sees nonzero leak even when off', () => {
    const nodes: BoatNode[] = [
      { id: 'B1', data: { defId: battery.id, faults: [] } },
      { id: 'SW1', data: { defId: switchDef.id, on: false, faults: [{ kind: 'water', leakOhm: 100 }] } },
      { id: 'L1', data: { defId: ledLoad.id, on: true, faults: [] } },
    ];
    const edges: BoatEdge[] = [
      { id: 'e1', source: 'B1', sourceHandle: 'pos', target: 'SW1', targetHandle: 'in', data: { wireDefId: 'wire-16-red', lengthFt: 1 } },
      { id: 'e2', source: 'SW1', sourceHandle: 'out', target: 'L1', targetHandle: 'in', data: { wireDefId: 'wire-16-red', lengthFt: 1 } },
      { id: 'e3', source: 'L1', sourceHandle: 'out', target: 'B1', targetHandle: 'neg', data: { wireDefId: 'wire-16-red', lengthFt: 1 } },
    ];
    const built = build(input(nodes, edges));
    const sol = solve(built.circuit)!;
    // Battery should see *some* current because water leaks IN+ to ground.
    expect(Math.abs(sol.vSourceCurrents.get('V_B1')!)).toBeGreaterThan(0.05);
  });
});
