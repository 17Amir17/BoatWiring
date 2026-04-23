import type { ComponentDef, WireDef, Fault, ComponentNodeData } from '../../types';
import { build, type BoatNode, type BoatEdge } from './stamping';
import { solve } from './solver';

export type DriveSpec =
  | { kind: 'voltage'; v: number; rIntOhm?: number }
  | { kind: 'ground' }
  | { kind: 'load'; watts: number; vMin?: number }
  | { kind: 'short'; rOhm?: number }
  | { kind: 'leak'; rOhm: number };

export interface SandboxScenario {
  /** What to attach at each named port. Ports omitted are left floating. */
  drive: { portId: string; source: DriveSpec }[];
  /** Component instance state for the device under test. */
  state?: Partial<ComponentNodeData>;
  /** SOC for the dut if it's a battery (0..1). */
  soc?: number;
  /** Initially-blown fuse state for the dut (and its sub-fuses). */
  fuseOpen?: Record<string, boolean>;
  /** Sub-component states for composites: keyed by subId. */
  subStates?: Record<string, { on?: boolean; level?: number; selectedPosition?: number }>;
  /** Which port voltages to capture in the result (defaults to ALL ports). */
  probes?: string[];
}

export interface SandboxEvent {
  tSec: number;
  kind: string;
  detail?: Record<string, unknown>;
}

export interface SandboxResult {
  voltages: Record<string, number>;
  /** Current at each "source" attached at a port (positive = into the component). */
  driveCurrents: Record<string, number>;
  events: SandboxEvent[];
  converged: boolean;
}

const DUT_ID = 'DUT';
const wireDef: WireDef = {
  id: 'sb-wire',
  name: 'sandbox internal',
  gaugeAWG: 16,
  maxAmps: 22,
  insulationColor: 'orange',
};

/**
 * Headless single-component test bench. Wraps `build` + `solve` with synthetic
 * "rig" components attached to each port: voltage sources, grounds, loads, etc.
 *
 * This is the unit-test surface that lets agents (or the in-app sandbox UI)
 * drive a ComponentDef with controlled inputs and verify outputs without
 * standing up a full schematic.
 */
export function runSandbox(def: ComponentDef, scn: SandboxScenario): SandboxResult {
  const defs = new Map<string, ComponentDef>();
  defs.set(def.id, def);

  const dutData: ComponentNodeData = {
    defId: def.id,
    on: scn.state?.on,
    level: scn.state?.level,
    selectedPosition: scn.state?.selectedPosition,
    faults: (scn.state?.faults as Fault[] | undefined) ?? [],
  };
  if (scn.subStates) (dutData as ComponentNodeData & { subStates?: unknown }).subStates = scn.subStates;

  const nodes: BoatNode[] = [{ id: DUT_ID, data: dutData }];
  const edges: BoatEdge[] = [];

  const driveDefs = createDriveDefs(scn.drive);
  for (const rigDef of driveDefs.rigDefs.values()) defs.set(rigDef.id, rigDef);
  for (const node of driveDefs.rigNodes) nodes.push(node);
  for (const edge of driveDefs.rigEdges) edges.push(edge);

  const built = build({
    defs,
    wireDefs: new Map([[wireDef.id, wireDef]]),
    nodes,
    edges,
    soc: scn.soc !== undefined ? { [DUT_ID]: scn.soc } : {},
    fuseOpen: prefixFuses(scn.fuseOpen),
  });

  const sol = solve(built.circuit);
  if (!sol) {
    return {
      voltages: {},
      driveCurrents: {},
      events: [{ tSec: 0, kind: 'solverFailed' }],
      converged: false,
    };
  }

  // Resolve port nodes for probing using build()'s portNode map.
  const probes = scn.probes ?? def.ports.map((p) => p.id);
  const voltages: Record<string, number> = {};
  for (const portId of probes) {
    const solverNode = built.portNode.get(`${DUT_ID}/${portId}`);
    if (solverNode !== undefined) {
      const v = sol.voltages.get(solverNode);
      if (v !== undefined) voltages[portId] = v;
    }
  }

  // For each drive, infer "current into the DUT" by reading the source current
  // out of its ID convention.
  const driveCurrents: Record<string, number> = {};
  for (const d of scn.drive) {
    const id = `RIG_${d.portId}`;
    if (d.source.kind === 'voltage') {
      const i = sol.vSourceCurrents.get(`V_${id}`);
      if (i !== undefined) driveCurrents[d.portId] = i;
    } else if (d.source.kind === 'load' || d.source.kind === 'short' || d.source.kind === 'leak') {
      const i = sol.resistorCurrents.get(`R_PROBE_${id}`)
        ?? sol.loadCurrents.get(`PL_${id}`);
      if (i !== undefined) driveCurrents[d.portId] = i;
    }
  }

  return {
    voltages,
    driveCurrents,
    events: [],
    converged: sol.converged,
  };
}

function createDriveDefs(drive: SandboxScenario['drive']) {
  const rigDefs = new Map<string, ComponentDef>();
  const rigNodes: BoatNode[] = [];
  const rigEdges: BoatEdge[] = [];

  for (const d of drive) {
    const probeId = `PROBE_${d.portId}`;
    const probeDefId = `__probe__`;
    if (!rigDefs.has(probeDefId)) {
      rigDefs.set(probeDefId, {
        id: probeDefId,
        kind: 'busbar',
        name: 'probe',
        size: { w: 1, h: 1 },
        ports: [{ id: 'p', label: 'p', rel: { x: 0, y: 0 }, role: 'passthrough' }],
        specs: {},
      });
    }
    rigNodes.push({ id: probeId, data: { defId: probeDefId, faults: [] } });
    rigEdges.push({
      id: `e_${d.portId}_dut`,
      source: probeId,
      sourceHandle: 'p',
      target: DUT_ID,
      targetHandle: d.portId,
      data: { wireDefId: wireDef.id, lengthFt: 0 },
    });

    const rigId = `RIG_${d.portId}`;
    if (d.source.kind === 'voltage') {
      const defId = `__rigV_${d.source.v}_${d.source.rIntOhm ?? 1e-4}`;
      if (!rigDefs.has(defId)) {
        rigDefs.set(defId, {
          id: defId,
          kind: 'battery',
          name: `rig ${d.source.v}V`,
          size: { w: 1, h: 1 },
          ports: [
            { id: 'pos', label: '+', rel: { x: 1, y: 0 }, role: 'source' },
            { id: 'neg', label: '-', rel: { x: 0, y: 0 }, role: 'sink' },
          ],
          specs: { vNominal: d.source.v, rInternalOhm: d.source.rIntOhm ?? 1e-4 },
        });
      }
      rigNodes.push({ id: rigId, data: { defId, faults: [] } });
      rigEdges.push({
        id: `e_${d.portId}_v`,
        source: rigId,
        sourceHandle: 'pos',
        target: probeId,
        targetHandle: 'p',
        data: { wireDefId: wireDef.id, lengthFt: 0 },
      });
      // Negative terminal is auto-bonded to GROUND by the battery stamper.
    } else if (d.source.kind === 'ground') {
      // Tie the probe directly to GROUND via a 1mΩ resistor: model as a tiny
      // battery at 0V with the bond. We can do this with a busbar plus an
      // explicit sink: easiest is a "ground" device kind. Since we don't have
      // one, use a battery defined at 0V (its NEG auto-bonds GROUND, and pos
      // is essentially a 0V rail through 1mΩ).
      const defId = `__rigGND__`;
      if (!rigDefs.has(defId)) {
        rigDefs.set(defId, {
          id: defId,
          kind: 'battery',
          name: 'rig ground',
          size: { w: 1, h: 1 },
          ports: [
            { id: 'pos', label: '+', rel: { x: 1, y: 0 }, role: 'source' },
            { id: 'neg', label: '-', rel: { x: 0, y: 0 }, role: 'sink' },
          ],
          specs: { vNominal: 0, rInternalOhm: 1e-4 },
        });
      }
      rigNodes.push({ id: rigId, data: { defId, faults: [] } });
      rigEdges.push({
        id: `e_${d.portId}_g`,
        source: rigId,
        sourceHandle: 'pos',
        target: probeId,
        targetHandle: 'p',
        data: { wireDefId: wireDef.id, lengthFt: 0 },
      });
    } else if (d.source.kind === 'load') {
      const defId = `__rigL_${d.source.watts}__${d.source.vMin ?? 0}`;
      if (!rigDefs.has(defId)) {
        rigDefs.set(defId, {
          id: defId,
          kind: 'load',
          name: 'rig load',
          size: { w: 1, h: 1 },
          ports: [
            { id: 'in', label: '+', rel: { x: 1, y: 0 }, role: 'sink' },
            { id: 'out', label: '-', rel: { x: 0, y: 0 }, role: 'sink' },
          ],
          specs: { wattsOn: d.source.watts, vMin: d.source.vMin ?? 0, vMax: 60 },
        });
      }
      rigNodes.push({ id: rigId, data: { defId, on: true, faults: [] } });
      rigEdges.push({
        id: `e_${d.portId}_l_in`,
        source: rigId,
        sourceHandle: 'in',
        target: probeId,
        targetHandle: 'p',
        data: { wireDefId: wireDef.id, lengthFt: 0 },
      });
      // Load returns to GROUND through a hidden ground rig
      const groundRigId = `RIG_${d.portId}_lg`;
      const groundDefId = `__rigGND__`;
      if (!rigDefs.has(groundDefId)) {
        rigDefs.set(groundDefId, {
          id: groundDefId,
          kind: 'battery',
          name: 'rig ground',
          size: { w: 1, h: 1 },
          ports: [
            { id: 'pos', label: '+', rel: { x: 1, y: 0 }, role: 'source' },
            { id: 'neg', label: '-', rel: { x: 0, y: 0 }, role: 'sink' },
          ],
          specs: { vNominal: 0, rInternalOhm: 1e-4 },
        });
      }
      rigNodes.push({ id: groundRigId, data: { defId: groundDefId, faults: [] } });
      rigEdges.push({
        id: `e_${d.portId}_l_out`,
        source: rigId,
        sourceHandle: 'out',
        target: groundRigId,
        targetHandle: 'pos',
        data: { wireDefId: wireDef.id, lengthFt: 0 },
      });
    } else if (d.source.kind === 'short' || d.source.kind === 'leak') {
      // A short/leak is a resistor from this port to GROUND.
      const r = d.source.kind === 'short' ? (d.source.rOhm ?? 1e-3) : d.source.rOhm;
      const defId = `__rigR_${r}`;
      if (!rigDefs.has(defId)) {
        rigDefs.set(defId, {
          id: defId,
          kind: 'fuse',
          name: `rig R=${r}Ω`,
          size: { w: 1, h: 1 },
          ports: [
            { id: 'a', label: 'A', rel: { x: 1, y: 0 }, role: 'passthrough' },
            { id: 'b', label: 'B', rel: { x: 0, y: 0 }, role: 'passthrough' },
          ],
          specs: { ratingA: 1e6 },
        });
      }
      rigNodes.push({ id: rigId, data: { defId, faults: [] } });
      rigEdges.push({
        id: `e_${d.portId}_r`,
        source: rigId,
        sourceHandle: 'a',
        target: probeId,
        targetHandle: 'p',
        data: { wireDefId: wireDef.id, lengthFt: 0 },
      });
      // Tie 'b' to ground via rig ground.
      const groundRigId = `RIG_${d.portId}_rg`;
      rigNodes.push({ id: groundRigId, data: { defId: '__rigGND__', faults: [] } });
      if (!rigDefs.has('__rigGND__')) {
        rigDefs.set('__rigGND__', {
          id: '__rigGND__',
          kind: 'battery',
          name: 'rig ground',
          size: { w: 1, h: 1 },
          ports: [
            { id: 'pos', label: '+', rel: { x: 1, y: 0 }, role: 'source' },
            { id: 'neg', label: '-', rel: { x: 0, y: 0 }, role: 'sink' },
          ],
          specs: { vNominal: 0, rInternalOhm: 1e-4 },
        });
      }
      rigEdges.push({
        id: `e_${d.portId}_rg`,
        source: rigId,
        sourceHandle: 'b',
        target: groundRigId,
        targetHandle: 'pos',
        data: { wireDefId: wireDef.id, lengthFt: 0 },
      });
    }
  }

  return { rigDefs, rigNodes, rigEdges };
}

function prefixFuses(fo: Record<string, boolean> | undefined): Record<string, boolean> {
  if (!fo) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(fo)) {
    // Sub-fuse keys are like "subId" (relative to DUT). Prefix with DUT id.
    if (k === DUT_ID || k.startsWith(`${DUT_ID}/`)) out[k] = v;
    else out[`${DUT_ID}/${k}`] = v;
  }
  return out;
}
