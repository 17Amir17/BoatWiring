import { solveLinear, zeros } from './matrix';

export type NodeId = string;
export const GROUND: NodeId = '__GND__';

export interface ResistorStamp {
  id: string;
  a: NodeId;
  b: NodeId;
  rOhm: number;
}

export interface VSourceStamp {
  id: string;
  pos: NodeId;
  neg: NodeId;
  vVolts: number;
  /** Internal resistance (Thevenin). When > 0 we collapse the source to a resistor + current,
   *  avoiding the extra MNA row. When ≤ 0 (or undefined) we add an ideal-source row. */
  rIntOhm?: number;
}

export interface PowerLoadStamp {
  id: string;
  a: NodeId;
  b: NodeId;
  watts: number;
  vMin?: number;
  vMax?: number;
  rMinOhm?: number;
}

export interface Circuit {
  resistors: ResistorStamp[];
  vSources: VSourceStamp[];
  pLoads?: PowerLoadStamp[];
  /** Adds 1/leakOhm conductance from every node to ground. Default 1e9. */
  leakOhm?: number;
}

export interface Solution {
  voltages: Map<NodeId, number>;
  /** Current through each resistor in the direction a→b. */
  resistorCurrents: Map<string, number>;
  /** Current leaving the + terminal of each voltage source (positive = source delivering). */
  vSourceCurrents: Map<string, number>;
  /** Resolved equivalent resistance per power load. */
  loadResistance: Map<string, number>;
  /** Steady-state current through each constant-power load (a→b). */
  loadCurrents: Map<string, number>;
  converged: boolean;
}

interface IndexedSystem {
  idx: Map<NodeId, number>;
  ids: NodeId[];
  n: number;
}

function buildIndex(circuit: Circuit): IndexedSystem {
  const idx = new Map<NodeId, number>();
  const ids: NodeId[] = [];
  idx.set(GROUND, -1);
  const ensure = (id: NodeId) => {
    if (idx.has(id)) return;
    idx.set(id, ids.length);
    ids.push(id);
  };
  for (const r of circuit.resistors) {
    ensure(r.a);
    ensure(r.b);
  }
  for (const v of circuit.vSources) {
    ensure(v.pos);
    ensure(v.neg);
  }
  for (const p of circuit.pLoads ?? []) {
    ensure(p.a);
    ensure(p.b);
  }
  return { idx, ids, n: ids.length };
}

interface Stamps {
  G: number[][];
  z: number[];
}

function newStamps(size: number): Stamps {
  return { G: zeros(size), z: new Array<number>(size).fill(0) };
}

function stampResistor(s: Stamps, ai: number, bi: number, rOhm: number) {
  const g = 1 / Math.max(rOhm, 1e-12);
  if (ai >= 0) s.G[ai][ai] += g;
  if (bi >= 0) s.G[bi][bi] += g;
  if (ai >= 0 && bi >= 0) {
    s.G[ai][bi] -= g;
    s.G[bi][ai] -= g;
  }
}

function stampThevenin(s: Stamps, posI: number, negI: number, v: number, rInt: number) {
  const g = 1 / Math.max(rInt, 1e-12);
  if (posI >= 0) s.G[posI][posI] += g;
  if (negI >= 0) s.G[negI][negI] += g;
  if (posI >= 0 && negI >= 0) {
    s.G[posI][negI] -= g;
    s.G[negI][posI] -= g;
  }
  if (posI >= 0) s.z[posI] += g * v;
  if (negI >= 0) s.z[negI] -= g * v;
}

function stampIdealVSource(
  s: Stamps,
  posI: number,
  negI: number,
  v: number,
  vRow: number,
) {
  if (posI >= 0) {
    s.G[vRow][posI] += 1;
    s.G[posI][vRow] += 1;
  }
  if (negI >= 0) {
    s.G[vRow][negI] -= 1;
    s.G[negI][vRow] -= 1;
  }
  s.z[vRow] += v;
}

interface PLState {
  stamp: PowerLoadStamp;
  rOhm: number;
}

function solveOnce(
  circuit: Circuit,
  sys: IndexedSystem,
  pLoads: PLState[],
): Solution | null {
  const { idx, ids, n } = sys;
  const idealSources = circuit.vSources.filter((v) => !v.rIntOhm || v.rIntOhm <= 0);
  const size = n + idealSources.length;
  const s = newStamps(size);

  for (const r of circuit.resistors) {
    stampResistor(s, idx.get(r.a)!, idx.get(r.b)!, r.rOhm);
  }
  const leakOhm = circuit.leakOhm ?? 1e9;
  for (let i = 0; i < n; i++) s.G[i][i] += 1 / leakOhm;

  for (const p of pLoads) {
    stampResistor(s, idx.get(p.stamp.a)!, idx.get(p.stamp.b)!, p.rOhm);
  }

  let vRow = n;
  const idealRowOf = new Map<string, number>();
  for (const v of circuit.vSources) {
    const posI = idx.get(v.pos)!;
    const negI = idx.get(v.neg)!;
    if (v.rIntOhm && v.rIntOhm > 0) {
      stampThevenin(s, posI, negI, v.vVolts, v.rIntOhm);
    } else {
      stampIdealVSource(s, posI, negI, v.vVolts, vRow);
      idealRowOf.set(v.id, vRow);
      vRow++;
    }
  }

  const x = solveLinear(s.G, s.z);
  if (!x) return null;

  const voltages = new Map<NodeId, number>();
  voltages.set(GROUND, 0);
  for (let i = 0; i < n; i++) voltages.set(ids[i], x[i]);

  const resistorCurrents = new Map<string, number>();
  for (const r of circuit.resistors) {
    const va = voltages.get(r.a) ?? 0;
    const vb = voltages.get(r.b) ?? 0;
    resistorCurrents.set(r.id, (va - vb) / Math.max(r.rOhm, 1e-12));
  }

  const vSourceCurrents = new Map<string, number>();
  for (const v of circuit.vSources) {
    if (v.rIntOhm && v.rIntOhm > 0) {
      const vp = voltages.get(v.pos) ?? 0;
      const vn = voltages.get(v.neg) ?? 0;
      vSourceCurrents.set(v.id, (v.vVolts - (vp - vn)) / v.rIntOhm);
    } else {
      // MNA's branch current variable is the current flowing INTO the + terminal
      // from the external circuit. When the source delivers, that's negative.
      // Flip so callers see "positive = source delivering current to the circuit".
      vSourceCurrents.set(v.id, -x[idealRowOf.get(v.id)!]);
    }
  }

  const loadResistance = new Map<string, number>();
  const loadCurrents = new Map<string, number>();
  for (const p of pLoads) {
    loadResistance.set(p.stamp.id, p.rOhm);
    const va = voltages.get(p.stamp.a) ?? 0;
    const vb = voltages.get(p.stamp.b) ?? 0;
    loadCurrents.set(p.stamp.id, (va - vb) / Math.max(p.rOhm, 1e-12));
  }

  return {
    voltages,
    resistorCurrents,
    vSourceCurrents,
    loadResistance,
    loadCurrents,
    converged: true,
  };
}

export function solve(circuit: Circuit): Solution | null {
  const sys = buildIndex(circuit);
  const pLoads: PLState[] = (circuit.pLoads ?? []).map((stamp) => ({
    stamp,
    rOhm: Math.max(144 / Math.max(stamp.watts, 1e-3), stamp.rMinOhm ?? 1e-3),
  }));

  let last: Solution | null = null;
  let converged = pLoads.length === 0;
  for (let iter = 0; iter < 12; iter++) {
    const sol = solveOnce(circuit, sys, pLoads);
    if (!sol) return null;
    last = sol;
    if (pLoads.length === 0) {
      converged = true;
      break;
    }
    let maxDelta = 0;
    for (const p of pLoads) {
      const va = sol.voltages.get(p.stamp.a) ?? 0;
      const vb = sol.voltages.get(p.stamp.b) ?? 0;
      const v = Math.abs(va - vb);
      const newR = v <= (p.stamp.vMin ?? 0)
        ? 1e10
        : Math.max((v * v) / Math.max(p.stamp.watts, 1e-6), p.stamp.rMinOhm ?? 1e-3);
      maxDelta = Math.max(maxDelta, Math.abs(newR - p.rOhm) / Math.max(newR, 1e-6));
      p.rOhm = p.rOhm + 0.6 * (newR - p.rOhm);
    }
    if (maxDelta < 1e-3) {
      converged = true;
      break;
    }
  }
  if (last) last.converged = converged;
  return last;
}
