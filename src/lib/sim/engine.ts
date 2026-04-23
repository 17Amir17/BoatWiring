import type { ComponentDef, SimState, WireDef } from '../../types';
import { build, type BoatNode, type BoatEdge } from './stamping';
import { solve, type Solution } from './solver';

export interface EngineInputs {
  defs: Map<string, ComponentDef>;
  wireDefs: Map<string, WireDef>;
  nodes: BoatNode[];
  edges: BoatEdge[];
}

export interface EngineState extends SimState {
  /** Cumulative i²·t per fuse-bearing node (for time-current curve). */
  fuseI2T: Record<string, number>;
}

/**
 * Time-current proxy for an ATC blade fuse. Real fuses have a curve that
 * trips faster at higher overcurrent; a simple i²t threshold is a reasonable
 * v1 approximation. ATC ~30A blow-time is roughly 5s at 200% (60A) and
 * 0.1s at 600% (180A), which gives a melting i²t of ~250 A²·s for a 30A.
 *
 * We model i²t threshold ≈ 0.3 · ratingA² · 1s, which yields plausible
 * "blow within seconds" behavior for moderate overloads.
 */
export function fuseBlowsAt(ratingA: number, integral: number): boolean {
  const threshold = 0.3 * ratingA * ratingA;
  return integral >= threshold;
}

export interface StepInputs extends EngineInputs {
  state: EngineState;
  /** Wall-clock seconds to advance. Multiplied by state.timeScale. */
  dtSec: number;
}

export interface StepResult {
  state: EngineState;
  solution: Solution;
  /** Per-edge current map (for UI animation/coloring). */
  edgeCurrents: Record<string, number>;
  /** Per-component-port voltages. */
  nodePortVoltages: Record<string, number>;
  /** Components whose fuse just blew this step. */
  newlyBlown: string[];
}

/** Build, solve, integrate i²·t and SOC, return updated state. */
export function step(input: StepInputs): StepResult {
  const dt = input.dtSec * (input.state.timeScale || 1);
  const built = build({
    defs: input.defs,
    wireDefs: input.wireDefs,
    nodes: input.nodes,
    edges: input.edges,
    soc: input.state.soc,
    fuseOpen: input.state.fuseOpen,
  });
  const sol = solve(built.circuit) ?? {
    voltages: new Map(),
    resistorCurrents: new Map(),
    vSourceCurrents: new Map(),
    loadResistance: new Map(),
    loadCurrents: new Map(),
    converged: false,
  };

  // --- Per-edge current readout. ---
  const edgeCurrents: Record<string, number> = {};
  for (const [edgeId, rid] of built.edgeResistorId.entries()) {
    edgeCurrents[edgeId] = sol.resistorCurrents.get(rid) ?? 0;
  }

  // --- Per-port voltage readout (componentId/portId → V). ---
  const nodePortVoltages: Record<string, number> = {};
  for (const [pk, nodeId] of built.portNode.entries()) {
    const v = sol.voltages.get(nodeId);
    if (v !== undefined) nodePortVoltages[pk] = v;
  }

  // --- Battery SOC integration. ---
  const newSoc = { ...input.state.soc };
  for (const n of input.nodes) {
    const def = input.defs.get(n.data.defId);
    if (!def || def.kind !== 'battery') continue;
    const sourceIds = built.nodeSourceIds.get(n.id) ?? [];
    const sid = sourceIds[0];
    if (!sid) continue;
    const i = sol.vSourceCurrents.get(sid) ?? 0; // positive when delivering
    const cap = (def.specs.capacityAh as number) || 100;
    const ahDrawn = (i * dt) / 3600;
    const dSoc = ahDrawn / cap;
    const cur = newSoc[n.id] ?? 1.0;
    newSoc[n.id] = Math.max(0, Math.min(1, cur - dSoc));
  }

  // --- Fuse i²t integration & blow detection. ---
  const newI2T = { ...input.state.fuseI2T };
  const newBlown = { ...input.state.fuseOpen };
  const newlyBlown: string[] = [];
  for (const [nodeId, rids] of built.nodePrimaryR.entries()) {
    if (newBlown[nodeId]) continue; // already blown — leave it
    const def = lookupDefForFuseNode(nodeId, input);
    if (!def) continue;
    if (def.kind !== 'fuse' && def.kind !== 'fuseBlock') continue;
    let totalI = 0;
    for (const rid of rids) totalI += sol.resistorCurrents.get(rid) ?? 0;
    const ratingA = readFuseRating(def, nodeId);
    if (!ratingA) continue;
    if (Math.abs(totalI) > ratingA) {
      const over = Math.abs(totalI) - ratingA;
      const acc = (newI2T[nodeId] ?? 0) + over * over * dt;
      newI2T[nodeId] = acc;
      if (fuseBlowsAt(ratingA, acc)) {
        newBlown[nodeId] = true;
        newlyBlown.push(nodeId);
      }
    } else {
      // i²t self-heals slightly when current is below rating.
      newI2T[nodeId] = Math.max(0, (newI2T[nodeId] ?? 0) - 0.1 * dt);
    }
  }

  const newState: EngineState = {
    ...input.state,
    tSec: input.state.tSec + dt,
    soc: newSoc,
    fuseI2T: newI2T,
    fuseOpen: newBlown,
    nodeVoltages: nodePortVoltages,
    edgeCurrents,
  };

  return { state: newState, solution: sol, edgeCurrents, nodePortVoltages, newlyBlown };
}

/** Attempt to find the ComponentDef that owns a fuse node id of the form
 *  "componentId" or "componentId/subId". */
function lookupDefForFuseNode(nodeId: string, input: EngineInputs): ComponentDef | undefined {
  const slash = nodeId.indexOf('/');
  const compId = slash >= 0 ? nodeId.slice(0, slash) : nodeId;
  const node = input.nodes.find((n) => n.id === compId);
  if (!node) return undefined;
  const parent = input.defs.get(node.data.defId);
  if (!parent) return undefined;
  if (slash < 0) return parent;
  // Sub-component: look up by id.
  const subId = nodeId.slice(slash + 1);
  const sub = parent.subComponents?.find((s) => s.id === subId);
  if (!sub) return parent;
  // Build a synthetic def that carries the sub-fuse's rating.
  return {
    ...parent,
    kind: 'fuse',
    specs: { ...parent.specs, ...sub.specs },
  };
}

function readFuseRating(def: ComponentDef, _nodeId: string): number | undefined {
  const v = def.specs.ratingA;
  if (typeof v === 'number') return v;
  return undefined;
}

export function initialState(): EngineState {
  return {
    nodeVoltages: {},
    edgeCurrents: {},
    soc: {},
    fuseOpen: {},
    fuseI2T: {},
    tSec: 0,
    timeScale: 1,
    running: false,
  };
}

/** Convenience runner used by tests and the in-app sim loop. Returns the
 *  final state after `nSteps` ticks of `dtSec` each. */
export function simulate(
  input: EngineInputs,
  state: EngineState,
  dtSec: number,
  nSteps: number,
): EngineState {
  let cur = state;
  for (let i = 0; i < nSteps; i++) {
    const r = step({ ...input, state: cur, dtSec });
    cur = r.state;
  }
  return cur;
}
