import type {
  ComponentDef,
  ComponentNodeData,
  Fault,
  SubComponent,
  WireData,
  WireDef,
} from '../../types';
import { GROUND_NODE } from '../../types';
import type {
  Circuit,
  PowerLoadStamp,
  ResistorStamp,
  VSourceStamp,
} from './solver';
import { GROUND } from './solver';
import { UnionFind } from './unionFind';
import { wireResistance } from './awg';

export const R_CLOSED = 1e-3;
/** Effectively-open: large enough that current is negligible at any boat voltage, small
 *  enough that the matrix stays well-conditioned. 10 GΩ → ~1 nA leak at 12V. */
export const R_OPEN = 1e10;
export const R_BUSBAR = 1e-4;
export const R_CONNECTOR = 1e-3;
/** Default per-node leak to ground inside built circuits. Much smaller than R_OPEN
 *  so that "off" devices don't form voltage dividers with phantom leak paths. */
export const DEFAULT_LEAK_OHM = 1e7;

export interface BoatNode {
  id: string;
  data: ComponentNodeData;
}

export interface BoatEdge {
  id: string;
  source: string; // node id
  sourceHandle: string; // port id
  target: string;
  targetHandle: string;
  data: WireData;
}

export interface BuildInput {
  defs: Map<string, ComponentDef>;
  wireDefs: Map<string, WireDef>;
  nodes: BoatNode[];
  edges: BoatEdge[];
  /** SOC by battery node id, drives terminal voltage (0..1). */
  soc: Record<string, number>;
  /** Whether each fuse node id has been blown by i²t. */
  fuseOpen: Record<string, boolean>;
}

export interface BuildOutput {
  circuit: Circuit;
  /** edge id → resistor stamp id (so the engine can read per-wire current). */
  edgeResistorId: Map<string, string>;
  /** node id → resistor stamp ids representing primary current path through that node
   *  (sum of these gives total current through the device for fuse i²t etc.). */
  nodePrimaryR: Map<string, string[]>;
  /** node id → load stamp ids (so the engine can sum load current). */
  nodeLoadIds: Map<string, string[]>;
  /** node id → voltage source ids. */
  nodeSourceIds: Map<string, string[]>;
  /** "componentId/portId" → resolved solver node id (post union-find). */
  portNode: Map<string, string>;
}

const portKey = (nodeId: string, portId: string) => `${nodeId}:${portId}`;
const subPortKey = (nodeId: string, subId: string, portId: string) =>
  `${nodeId}/${subId}:${portId}`;

function applyFaultToR(rOhm: number, faults: Fault[]): number {
  for (const f of faults) {
    if (f.kind === 'open') return R_OPEN;
    if (f.kind === 'short') return Math.min(rOhm, f.rOhm);
    if (f.kind === 'degraded') return rOhm / Math.max(f.factor, 0.01);
  }
  return rOhm;
}

/**
 * Lead-acid 12V terminal voltage by SOC (rest voltage).
 * Lithium iron phosphate would be flatter — model differs per chemistry.
 */
export function batteryTerminalV(soc: number, vNominal = 12.7): number {
  // Linear-ish SOC curve: 11.6V @ 0%, 12.0V @ 25%, 12.4V @ 50%, 12.7V @ 100%.
  const clamped = Math.max(0, Math.min(1, soc));
  if (clamped < 0.25) return 11.6 + (12.0 - 11.6) * (clamped / 0.25);
  if (clamped < 0.5) return 12.0 + (12.4 - 12.0) * ((clamped - 0.25) / 0.25);
  if (clamped < 0.85) return 12.4 + (vNominal - 12.4) * ((clamped - 0.5) / 0.35);
  return vNominal;
}

export function build(input: BuildInput): BuildOutput {
  const uf = new UnionFind();
  const resistors: ResistorStamp[] = [];
  const vSources: VSourceStamp[] = [];
  const pLoads: PowerLoadStamp[] = [];
  const edgeResistorId = new Map<string, string>();
  const nodePrimaryR = new Map<string, string[]>();
  const nodeLoadIds = new Map<string, string[]>();
  const nodeSourceIds = new Map<string, string[]>();

  const addPrimary = (nodeId: string, rid: string) => {
    const arr = nodePrimaryR.get(nodeId) ?? [];
    arr.push(rid);
    nodePrimaryR.set(nodeId, arr);
  };
  const addLoad = (nodeId: string, lid: string) => {
    const arr = nodeLoadIds.get(nodeId) ?? [];
    arr.push(lid);
    nodeLoadIds.set(nodeId, arr);
  };
  const addSource = (nodeId: string, sid: string) => {
    const arr = nodeSourceIds.get(nodeId) ?? [];
    arr.push(sid);
    nodeSourceIds.set(nodeId, arr);
  };

  // --- 1. Pre-register every port as a node in the union-find. ---
  for (const n of input.nodes) {
    const def = input.defs.get(n.data.defId);
    if (!def) continue;
    for (const p of def.ports) uf.add(portKey(n.id, p.id));
    if (def.kind === 'composite') {
      for (const sub of def.subComponents ?? []) {
        const subDef = subKindDefaultPorts(sub.subKind, sub);
        for (const sp of subDef) uf.add(subPortKey(n.id, sub.id, sp));
      }
    }
  }

  // --- 2. Wires: union endpoints (or stamp wire R if non-trivial length). ---
  for (const e of input.edges) {
    const a = portKey(e.source, e.sourceHandle);
    const b = portKey(e.target, e.targetHandle);
    uf.add(a);
    uf.add(b);
    const wireDef = input.wireDefs.get(e.data.wireDefId);
    const len = e.data.lengthFt ?? 0;
    if (wireDef && len > 0) {
      // Insert an intermediate node so the resistor stamps cleanly between distinct nodes.
      const mid = `wire:${e.id}`;
      uf.add(mid);
      // The wire is effectively series: a -- (zero) -- mid -- (rWire) -- b.
      // We collapse a↔mid via union (so the source-end terminal is at the wire's input)
      // and stamp the wire resistance between mid and b.
      uf.union(a, mid);
      const rWire = wireResistance(wireDef.gaugeAWG, len);
      const rid = `R_WIRE_${e.id}`;
      resistors.push({ id: rid, a: mid, b, rOhm: applyFaultToR(rWire, e.data.faults ?? []) });
      edgeResistorId.set(e.id, rid);
    } else {
      // Zero-length / no-def wire: short the endpoints.
      uf.union(a, b);
      const rid = `R_BOND_${e.id}`;
      // We still emit a tiny stamp so the edge has a queryable current. The
      // union above means a and b would otherwise be the same solver node and
      // (V_a - V_b) would be 0; stamping introduces a measurement branch.
      // To preserve a meaningful current reading for short wires, treat them
      // like a 1ft 16AWG wire (resistance ~0.005Ω) instead.
      resistors.push({ id: rid, a, b, rOhm: applyFaultToR(0.005, e.data.faults ?? []) });
      // Don't union here so the resistor stamp survives; user-set zero length
      // will still measure a current. (The union above is reverted by re-find
      // ordering: union earlier doesn't hurt because resistor stamping uses
      // the original ids — solveOnce maps a/b through ports in node space
      // BEFORE union mapping. We resolve via uf.find at stamp-finalize time.)
      edgeResistorId.set(e.id, rid);
    }
  }

  // --- 3. Stamp each component. ---
  for (const n of input.nodes) {
    const def = input.defs.get(n.data.defId);
    if (!def) continue;
    stampComponent(n, def, input, {
      resistors,
      vSources,
      pLoads,
      addPrimary,
      addLoad,
      addSource,
    });
  }

  // --- 4. Resolve every stamp's a/b through union-find to canonical reps. ---
  // (Order matters: do this AFTER all unions are recorded.)
  const reslv = (id: string) => (id === GROUND_NODE ? GROUND : uf.find(id));
  for (const r of resistors) {
    r.a = reslv(r.a);
    r.b = reslv(r.b);
  }
  for (const v of vSources) {
    v.pos = reslv(v.pos);
    v.neg = reslv(v.neg);
  }
  for (const p of pLoads) {
    p.a = reslv(p.a);
    p.b = reslv(p.b);
  }

  // Build the resolved port → solver-node lookup.
  const portNode = new Map<string, string>();
  for (const n of input.nodes) {
    const def = input.defs.get(n.data.defId);
    if (!def) continue;
    for (const p of def.ports) {
      portNode.set(`${n.id}/${p.id}`, reslv(portKey(n.id, p.id)));
    }
  }

  return {
    circuit: { resistors, vSources, pLoads, leakOhm: DEFAULT_LEAK_OHM },
    edgeResistorId,
    nodePrimaryR,
    nodeLoadIds,
    nodeSourceIds,
    portNode,
  };
}

interface StampCtx {
  resistors: ResistorStamp[];
  vSources: VSourceStamp[];
  pLoads: PowerLoadStamp[];
  addPrimary: (nodeId: string, rid: string) => void;
  addLoad: (nodeId: string, lid: string) => void;
  addSource: (nodeId: string, sid: string) => void;
}

function stampComponent(
  n: BoatNode,
  def: ComponentDef,
  input: BuildInput,
  ctx: StampCtx,
) {
  const faults = n.data.faults ?? [];
  const k = def.kind;
  const port = (id: string) => portKey(n.id, id);

  switch (k) {
    case 'battery': {
      const cap = num(def.specs.capacityAh, 100);
      const vNom = num(def.specs.vNominal, 12.7);
      const rInt = num(def.specs.rInternalOhm, 0.02);
      const sag = faults.find((f) => f.kind === 'voltageSag') as
        | Extract<Fault, { kind: 'voltageSag' }>
        | undefined;
      const soc = input.soc[n.id] ?? 1.0;
      const v = sag ? sag.vOverride : batteryTerminalV(soc, vNom);
      const sid = `V_${n.id}`;
      ctx.vSources.push({
        id: sid,
        pos: port(positivePort(def)),
        neg: port(negativePort(def)),
        vVolts: v,
        rIntOhm: Math.max(rInt, 1e-4),
      });
      ctx.addSource(n.id, sid);
      // In a real DC boat system, battery NEG is bonded to chassis (= solver GROUND).
      // Tie the negative terminal to GROUND with ~1mΩ so faults that leak to ground
      // (water, accidental shorts to hull) have a return path.
      ctx.resistors.push({
        id: `R_BATGND_${n.id}`,
        a: port(negativePort(def)),
        b: GROUND_NODE,
        rOhm: 1e-3,
      });
      // Mark capacity in the spec so engine can read it back.
      def.specs.capacityAh = cap;
      break;
    }
    case 'busbar': {
      // Connect every port to a single internal "bus" node via low R.
      const bus = `${n.id}/__bus__`;
      for (const p of def.ports) {
        const rid = `R_BUS_${n.id}_${p.id}`;
        ctx.resistors.push({ id: rid, a: port(p.id), b: bus, rOhm: R_BUSBAR });
      }
      break;
    }
    case 'fuse': {
      const blown = input.fuseOpen[n.id] === true;
      const rOhm = blown ? R_OPEN : applyFaultToR(R_CLOSED, faults);
      const ports = def.ports;
      const rid = `R_FUSE_${n.id}`;
      ctx.resistors.push({ id: rid, a: port(ports[0].id), b: port(ports[1].id), rOhm });
      ctx.addPrimary(n.id, rid);
      break;
    }
    case 'breaker': {
      const tripped = input.fuseOpen[n.id] === true;
      const rOhm = tripped ? R_OPEN : applyFaultToR(R_CLOSED, faults);
      const rid = `R_BRK_${n.id}`;
      ctx.resistors.push({ id: rid, a: port(def.ports[0].id), b: port(def.ports[1].id), rOhm });
      ctx.addPrimary(n.id, rid);
      break;
    }
    case 'switch': {
      const on = n.data.on === true;
      const rOhm = on ? applyFaultToR(R_CLOSED, faults) : R_OPEN;
      const rid = `R_SW_${n.id}`;
      ctx.resistors.push({ id: rid, a: port(def.ports[0].id), b: port(def.ports[1].id), rOhm });
      ctx.addPrimary(n.id, rid);
      break;
    }
    case 'selectorSwitch': {
      const sel = def.selector;
      if (!sel) break;
      const posIdx = n.data.selectedPosition ?? sel.defaultPosition ?? 0;
      const conduct = sel.positions[posIdx]?.conduct ?? [];
      const allPairs = new Set<string>();
      for (const [a, b] of conduct) {
        const key = `${a}|${b}`;
        if (allPairs.has(key)) continue;
        allPairs.add(key);
        const rid = `R_SEL_${n.id}_${a}_${b}`;
        const rOhm = applyFaultToR(R_CLOSED, faults);
        ctx.resistors.push({ id: rid, a: port(a), b: port(b), rOhm });
        ctx.addPrimary(n.id, rid);
      }
      break;
    }
    case 'load': {
      const wattsOn = num(def.specs.wattsOn, 6);
      const vMin = num(def.specs.vMin, 0);
      const vMax = num(def.specs.vMax, 60);
      const level = n.data.level ?? 1;
      const onByDefault = (n.data.on ?? true) === true;
      const degraded = faults.find((f) => f.kind === 'degraded') as
        | Extract<Fault, { kind: 'degraded' }>
        | undefined;
      const factor = degraded ? degraded.factor : 1;
      const watts = onByDefault ? wattsOn * level * factor : 0;
      if (watts > 0) {
        const lid = `PL_${n.id}`;
        ctx.pLoads.push({
          id: lid,
          a: port(def.ports[0].id),
          b: port(def.ports[1].id),
          watts,
          vMin,
          vMax,
          rMinOhm: 0.01,
        });
        ctx.addLoad(n.id, lid);
      }
      break;
    }
    case 'connector': {
      if (def.ports.length >= 2) {
        const rid = `R_CN_${n.id}`;
        ctx.resistors.push({
          id: rid,
          a: port(def.ports[0].id),
          b: port(def.ports[1].id),
          rOhm: applyFaultToR(R_CONNECTOR, faults),
        });
        ctx.addPrimary(n.id, rid);
      }
      break;
    }
    case 'fuseBlock': {
      // Common-in bus connects to all OUT slots through a fuse each.
      // Slot fuses live as subComponents; if absent, treat as direct passthrough.
      const inPort = def.ports.find((p) => p.label.toLowerCase().startsWith('in'))
        ?? def.ports[0];
      const outPorts = def.ports.filter((p) => p !== inPort && p.role !== 'sink');
      const groundPort = def.ports.find((p) => p.label.toLowerCase().includes('gnd')
        || p.label === '-');
      const bus = `${n.id}/__bus__`;
      ctx.resistors.push({
        id: `R_FB_IN_${n.id}`,
        a: port(inPort.id),
        b: bus,
        rOhm: R_BUSBAR,
      });
      const subs = def.subComponents ?? [];
      for (let i = 0; i < outPorts.length; i++) {
        const slotPort = outPorts[i];
        const fuseSub = subs[i];
        if (fuseSub && fuseSub.subKind === 'fuse') {
          const subBlown = input.fuseOpen[`${n.id}/${fuseSub.id}`] === true;
          const rOhm = subBlown ? R_OPEN : R_CLOSED;
          const rid = `R_FBSLOT_${n.id}_${fuseSub.id}`;
          ctx.resistors.push({ id: rid, a: bus, b: port(slotPort.id), rOhm });
          ctx.addPrimary(`${n.id}/${fuseSub.id}`, rid);
        } else {
          // No fuse installed in this slot → treat as open.
          ctx.resistors.push({
            id: `R_FBSLOT_OPEN_${n.id}_${i}`,
            a: bus,
            b: port(slotPort.id),
            rOhm: R_OPEN,
          });
        }
      }
      if (groundPort) {
        // ground port is a separate ground bus passthrough — usually wired to battery -.
        // We just expose it; user wiring connects it to common ground.
      }
      break;
    }
    case 'composite': {
      // Stamp every sub-component using shared internal port nodes,
      // then bridge externals via internalWiring.
      for (const sub of def.subComponents ?? []) {
        stampSubComponent(n, def, sub, input, ctx);
      }
      for (const w of def.internalWiring ?? []) {
        const a = endpointToNode(n.id, w.a);
        const b = endpointToNode(n.id, w.b);
        const rid = `R_IW_${n.id}_${a}_${b}`;
        ctx.resistors.push({ id: rid, a, b, rOhm: w.rOhm ?? 1e-3 });
      }
      break;
    }
    case 'harness': {
      const h = def.harness;
      if (!h) break;
      for (const pair of h.pairs) {
        const r = wireResistance(pair.gaugeAWG, pair.lengthIn / 12);
        const rid = `R_HR_${n.id}_${pair.inPortId}_${pair.outPortId}`;
        ctx.resistors.push({
          id: rid,
          a: port(pair.inPortId),
          b: port(pair.outPortId),
          rOhm: applyFaultToR(r, faults),
        });
      }
      break;
    }
    case 'dcdc': {
      // Model output as ideal V source between primary-of-output and load ground.
      // Specs: vIn (just for documentation), vOut, currentLimitA, eff.
      // For simplicity we treat the input draw as a constant-power load equal
      // to (vOut * iOut / eff) and the output as an ideal V source.
      const vOut = num(def.specs.vOut, 5);
      const iLimit = num(def.specs.iLimitA, 2.1);
      const eff = num(def.specs.eff, 0.9);
      const inA = def.ports.find((p) => p.label === 'IN+') ?? def.ports[0];
      const inB = def.ports.find((p) => p.label === 'IN-') ?? def.ports[1];
      const outA = def.ports.find((p) => p.label === 'OUT+') ?? def.ports[2];
      const outB = def.ports.find((p) => p.label === 'OUT-') ?? def.ports[3];
      // The output is a Thevenin source with rIntOhm chosen so that, at iLimit,
      // the terminal sags by ~10%. A real CC/CV converter would current-limit;
      // approximating with rInt is acceptable for v1.
      const rOut = (vOut * 0.1) / Math.max(iLimit, 0.001);
      const sid = `V_DCDC_${n.id}`;
      ctx.vSources.push({
        id: sid,
        pos: port(outA?.id ?? def.ports[0].id),
        neg: port(outB?.id ?? def.ports[1].id),
        vVolts: vOut,
        rIntOhm: rOut,
      });
      // Constant-power input draw — but we need to convert i_out to watts;
      // since iOut depends on solution, approximate by stamping a small power draw
      // proportional to vOut * iLimit / eff as worst-case. v1 simplification.
      const pIn = (vOut * iLimit) / Math.max(eff, 0.5);
      ctx.pLoads.push({
        id: `PL_DCDC_${n.id}`,
        a: port(inA.id),
        b: port(inB.id),
        watts: pIn,
        vMin: 6,
      });
      ctx.addSource(n.id, sid);
      break;
    }
    case 'indicator': {
      // Voltmeter / LED display draws negligible current; stamp 100kΩ to ground from + to –.
      if (def.ports.length >= 2) {
        ctx.resistors.push({
          id: `R_IND_${n.id}`,
          a: port(def.ports[0].id),
          b: port(def.ports[1].id),
          rOhm: 100_000,
        });
      }
      break;
    }
    case 'accessory':
    case 'custom':
    default:
      // Decoration only, or user-defined kind: stamp nothing.
      break;
  }

  // Apply universal "water" leak fault: a resistor from each port to ground.
  for (const f of faults) {
    if (f.kind === 'water') {
      for (const p of def.ports) {
        ctx.resistors.push({
          id: `R_WET_${n.id}_${p.id}`,
          a: port(p.id),
          b: GROUND_NODE,
          rOhm: f.leakOhm,
        });
      }
    }
  }
}

function stampSubComponent(
  n: BoatNode,
  parentDef: ComponentDef,
  sub: SubComponent,
  input: BuildInput,
  ctx: StampCtx,
) {
  const k = sub.subKind;
  const subPort = (id: string) => subPortKey(n.id, sub.id, id);
  // Sub-state defaults: composites store sub state in parent's data.subStates if needed.
  const subState = (n.data as ComponentNodeData & { subStates?: Record<string, { on?: boolean; level?: number; selectedPosition?: number }>; })
    .subStates?.[sub.id] ?? {};
  const ports = subKindDefaultPorts(k, sub);
  switch (k) {
    case 'switch': {
      const on = subState.on === true;
      ctx.resistors.push({
        id: `R_SUB_SW_${n.id}_${sub.id}`,
        a: subPort(ports[0]),
        b: subPort(ports[1]),
        rOhm: on ? R_CLOSED : R_OPEN,
      });
      break;
    }
    case 'fuse': {
      const blown = input.fuseOpen[`${n.id}/${sub.id}`] === true;
      const rid = `R_SUB_F_${n.id}_${sub.id}`;
      ctx.resistors.push({
        id: rid,
        a: subPort(ports[0]),
        b: subPort(ports[1]),
        rOhm: blown ? R_OPEN : R_CLOSED,
      });
      ctx.addPrimary(`${n.id}/${sub.id}`, rid);
      break;
    }
    case 'dcdc': {
      const vOut = num(sub.specs.vOut, 5);
      const iLimit = num(sub.specs.iLimitA, 2.1);
      const eff = num(sub.specs.eff, 0.9);
      const rOut = (vOut * 0.1) / Math.max(iLimit, 0.001);
      const sid = `V_SUB_DCDC_${n.id}_${sub.id}`;
      ctx.vSources.push({
        id: sid,
        pos: subPort(ports[2] ?? ports[0]),
        neg: subPort(ports[3] ?? ports[1]),
        vVolts: vOut,
        rIntOhm: rOut,
      });
      ctx.pLoads.push({
        id: `PL_SUB_DCDC_${n.id}_${sub.id}`,
        a: subPort(ports[0]),
        b: subPort(ports[1]),
        watts: (vOut * iLimit) / Math.max(eff, 0.5),
        vMin: 6,
      });
      break;
    }
    case 'load': {
      const wattsOn = num(sub.specs.wattsOn, 1);
      ctx.pLoads.push({
        id: `PL_SUB_${n.id}_${sub.id}`,
        a: subPort(ports[0]),
        b: subPort(ports[1]),
        watts: subState.on === false ? 0 : wattsOn * (subState.level ?? 1),
        vMin: num(sub.specs.vMin, 0),
      });
      break;
    }
    case 'indicator': {
      ctx.resistors.push({
        id: `R_SUB_IND_${n.id}_${sub.id}`,
        a: subPort(ports[0]),
        b: subPort(ports[1]),
        rOhm: 100_000,
      });
      break;
    }
    default:
      break;
  }
  void parentDef;
}

function endpointToNode(
  parentId: string,
  ep: { subId: string; portId: string } | { external: string },
): string {
  if ('external' in ep) return portKey(parentId, ep.external);
  return subPortKey(parentId, ep.subId, ep.portId);
}

function subKindDefaultPorts(k: SubComponent['subKind'], _sub: SubComponent): string[] {
  if (k === 'dcdc') return ['IN+', 'IN-', 'OUT+', 'OUT-'];
  return ['+', '-'];
}

function num(v: unknown, d: number): number {
  return typeof v === 'number' ? v : d;
}

function positivePort(def: ComponentDef): string {
  return (def.ports.find((p) => p.label === '+' || p.role === 'source')?.id) ?? def.ports[0]?.id;
}
function negativePort(def: ComponentDef): string {
  return (def.ports.find((p) => p.label === '-' || p.role === 'sink')?.id) ?? def.ports[1]?.id;
}
