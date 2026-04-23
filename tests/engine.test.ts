import { describe, expect, it } from 'vitest';
import { initialState, simulate, step } from '../src/lib/sim/engine';
import type { ComponentDef, WireDef } from '../src/types';

const battery: ComponentDef = {
  id: 'bat',
  kind: 'battery',
  name: '100Ah',
  size: { w: 1, h: 1 },
  ports: [
    { id: 'pos', label: '+', rel: { x: 1, y: 0 }, role: 'source' },
    { id: 'neg', label: '-', rel: { x: 0, y: 0 }, role: 'sink' },
  ],
  specs: { capacityAh: 100, vNominal: 12.7, rInternalOhm: 0.02 },
};

const load10A: ComponentDef = {
  id: 'l10a',
  kind: 'load',
  name: '120W (10A @12V)',
  size: { w: 1, h: 1 },
  ports: [
    { id: 'in', label: '+', rel: { x: 0, y: 0 }, role: 'sink' },
    { id: 'out', label: '-', rel: { x: 1, y: 0 }, role: 'sink' },
  ],
  specs: { wattsOn: 120, vMin: 0, vMax: 60 },
};

const fuse5: ComponentDef = {
  id: 'fuse5',
  kind: 'fuse',
  name: '5A fuse',
  size: { w: 1, h: 1 },
  ports: [
    { id: 'a', label: 'A', rel: { x: 0, y: 0 }, role: 'passthrough' },
    { id: 'b', label: 'B', rel: { x: 1, y: 0 }, role: 'passthrough' },
  ],
  specs: { ratingA: 5 },
};

const wire: WireDef = { id: 'w', name: 'w', gaugeAWG: 12, maxAmps: 40, insulationColor: 'red' };

const defs = new Map<string, ComponentDef>([
  [battery.id, battery],
  [load10A.id, load10A],
  [fuse5.id, fuse5],
]);
const wireDefs = new Map([[wire.id, wire]]);

describe('engine: SOC integration', () => {
  it('100Ah battery at 10A drains ~10% over 1 hour (sim time)', () => {
    const nodes = [
      { id: 'B', data: { defId: 'bat', faults: [] } },
      { id: 'L', data: { defId: 'l10a', on: true, faults: [] } },
    ];
    const edges = [
      { id: 'e1', source: 'B', sourceHandle: 'pos', target: 'L', targetHandle: 'in', data: { wireDefId: 'w', lengthFt: 1 } },
      { id: 'e2', source: 'L', sourceHandle: 'out', target: 'B', targetHandle: 'neg', data: { wireDefId: 'w', lengthFt: 1 } },
    ];
    let state = initialState();
    state = { ...state, soc: { B: 1.0 }, timeScale: 1 };
    // Take 60 steps of 60s each = 3600s = 1h.
    state = simulate({ defs, wireDefs, nodes, edges }, state, 60, 60);
    // 10A · 1h = 10Ah; 10Ah / 100Ah = 0.10. Expect ~0.90 SOC ± 0.02.
    expect(state.soc.B).toBeGreaterThan(0.87);
    expect(state.soc.B).toBeLessThan(0.93);
  });
});

describe('engine: fuse i²·t blow', () => {
  it('5A fuse driving 10A load blows within a few seconds', () => {
    const nodes = [
      { id: 'B', data: { defId: 'bat', faults: [] } },
      { id: 'F', data: { defId: 'fuse5', faults: [] } },
      { id: 'L', data: { defId: 'l10a', on: true, faults: [] } },
    ];
    const edges = [
      { id: 'e1', source: 'B', sourceHandle: 'pos', target: 'F', targetHandle: 'a', data: { wireDefId: 'w', lengthFt: 1 } },
      { id: 'e2', source: 'F', sourceHandle: 'b', target: 'L', targetHandle: 'in', data: { wireDefId: 'w', lengthFt: 1 } },
      { id: 'e3', source: 'L', sourceHandle: 'out', target: 'B', targetHandle: 'neg', data: { wireDefId: 'w', lengthFt: 1 } },
    ];
    let state = initialState();
    state = { ...state, soc: { B: 1.0 } };
    let blewAt = -1;
    for (let i = 0; i < 50; i++) {
      const r = step({ defs, wireDefs, nodes, edges, state, dtSec: 0.1 });
      state = r.state;
      if (r.newlyBlown.length > 0) { blewAt = state.tSec; break; }
    }
    expect(blewAt).toBeGreaterThan(0);
    expect(blewAt).toBeLessThan(5);
    // After blowing, the load draws ~zero on next tick.
    const r2 = step({ defs, wireDefs, nodes, edges, state, dtSec: 0.1 });
    expect(Math.abs(r2.solution.loadCurrents.get('PL_L') ?? 0)).toBeLessThan(0.5);
  });
});

describe('engine: fuse below rating does not blow', () => {
  it('5A fuse with 1A draw never blows', () => {
    const tinyLoad: ComponentDef = {
      ...load10A,
      id: 'l1a',
      specs: { ...load10A.specs, wattsOn: 12 },
    };
    const defs2 = new Map(defs);
    defs2.set(tinyLoad.id, tinyLoad);
    const nodes = [
      { id: 'B', data: { defId: 'bat', faults: [] } },
      { id: 'F', data: { defId: 'fuse5', faults: [] } },
      { id: 'L', data: { defId: 'l1a', on: true, faults: [] } },
    ];
    const edges = [
      { id: 'e1', source: 'B', sourceHandle: 'pos', target: 'F', targetHandle: 'a', data: { wireDefId: 'w', lengthFt: 1 } },
      { id: 'e2', source: 'F', sourceHandle: 'b', target: 'L', targetHandle: 'in', data: { wireDefId: 'w', lengthFt: 1 } },
      { id: 'e3', source: 'L', sourceHandle: 'out', target: 'B', targetHandle: 'neg', data: { wireDefId: 'w', lengthFt: 1 } },
    ];
    let state = initialState();
    state = { ...state, soc: { B: 1.0 } };
    for (let i = 0; i < 100; i++) {
      const r = step({ defs: defs2, wireDefs, nodes, edges, state, dtSec: 1 });
      state = r.state;
      expect(r.newlyBlown.length).toBe(0);
    }
    expect(state.fuseOpen.F).toBeFalsy();
  });
});
