import { create } from 'zustand';
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Node as RFNode,
  type Edge as RFEdge,
  addEdge,
} from '@xyflow/react';
import type {
  ComponentDef,
  ComponentNodeData,
  Fault,
  WireData,
  WireDef,
} from '../types';
import { loadComponentDefs, loadWireDefs } from '../lib/components/registry';
import { initialState, step, type EngineState } from '../lib/sim/engine';
import { expectedCurrentBetween, pickWireForCurrent } from '../lib/wires/pickWire';

export type BoatNode = RFNode<ComponentNodeData>;
export type BoatEdge = RFEdge<WireData>;

interface AppState {
  componentDefs: Map<string, ComponentDef>;
  wireDefs: Map<string, WireDef>;
  /** Currently selected wire def used when the user creates a new edge by drag. */
  defaultWireDefId: string;
  defaultWireLengthFt: number;
  nodes: BoatNode[];
  edges: BoatEdge[];
  selection: { nodeIds: string[]; edgeIds: string[] };
  engine: EngineState;

  // Mutators
  setNodes: (nodes: BoatNode[]) => void;
  setEdges: (edges: BoatEdge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (conn: Connection) => void;
  addComponent: (defId: string, position: { x: number; y: number }) => string;
  removeNode: (id: string) => void;
  removeEdge: (id: string) => void;
  toggleSwitch: (nodeId: string) => void;
  toggleSubSwitch: (nodeId: string, subId: string) => void;
  setSelectorPosition: (nodeId: string, idx: number) => void;
  setLoadOn: (nodeId: string, on: boolean) => void;
  injectFault: (target: { kind: 'node' | 'edge'; id: string }, fault: Fault) => void;
  clearFaults: (target: { kind: 'node' | 'edge'; id: string }) => void;
  setDefaultWire: (id: string, lengthFt?: number) => void;
  setEdgeWire: (edgeId: string, wireDefId: string) => void;
  setSelection: (sel: { nodeIds: string[]; edgeIds: string[] }) => void;

  // Sim control
  startSim: () => void;
  stopSim: () => void;
  setTimeScale: (s: number) => void;
  resetSim: () => void;
  tick: (dtSec: number) => void;

  // Custom defs (user-added in editor or imported via skill).
  upsertComponentDef: (def: ComponentDef) => void;
  removeComponentDef: (id: string) => void;
}

const builtIn = () => {
  const defs = new Map<string, ComponentDef>();
  for (const d of loadComponentDefs()) defs.set(d.id, d);
  const wires = new Map<string, WireDef>();
  for (const w of loadWireDefs()) wires.set(w.id, w);
  return { defs, wires };
};

// Expose the store on window during dev so the chrome MCP can probe state.
declare global { interface Window { useAppStore?: unknown } }

export const useAppStore = create<AppState>((set, get) => {
  const { defs, wires } = builtIn();
  if (typeof window !== 'undefined') {
    setTimeout(() => { window.useAppStore = useAppStore; }, 0);
  }
  return {
    componentDefs: defs,
    wireDefs: wires,
    defaultWireDefId: 'wire-16awg-red',
    defaultWireLengthFt: 3,
    nodes: [],
    edges: [],
    selection: { nodeIds: [], edgeIds: [] },
    engine: initialState(),

    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),
    onNodesChange: (changes) =>
      set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) as BoatNode[] })),
    onEdgesChange: (changes) =>
      set((s) => ({ edges: applyEdgeChanges(changes, s.edges) as BoatEdge[] })),
    onConnect: (conn) =>
      set((s) => {
        // Smart pick: size the wire to the heavier-loaded endpoint, fall back to
        // the user's last-chosen default if neither side constrains it.
        const sourceNode = conn.source ? s.nodes.find((n) => n.id === conn.source) : undefined;
        const targetNode = conn.target ? s.nodes.find((n) => n.id === conn.target) : undefined;
        const sourceDef = sourceNode ? s.componentDefs.get(sourceNode.data.defId) : undefined;
        const targetDef = targetNode ? s.componentDefs.get(targetNode.data.defId) : undefined;
        const targetA = expectedCurrentBetween(sourceDef, targetDef);
        const wireDefId = pickWireForCurrent(s.wireDefs, targetA, s.defaultWireDefId);
        const def = s.wireDefs.get(wireDefId);
        if (!def) return {};
        const data: WireData = {
          wireDefId,
          lengthFt: s.defaultWireLengthFt,
        };
        const newEdges = addEdge(
          {
            ...conn,
            id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            type: 'wire',
            data,
            style: { stroke: def.insulationColor, strokeWidth: gaugeStrokeWidth(def.gaugeAWG) },
          },
          s.edges as RFEdge[],
        ) as BoatEdge[];
        return { edges: newEdges };
      }),

    addComponent: (defId, position) => {
      const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      set((s) => {
        const def = s.componentDefs.get(defId);
        if (!def) return {};
        const data: ComponentNodeData = {
          defId,
          on: def.kind === 'switch' ? false : def.kind === 'load' ? true : undefined,
          level: 1,
          selectedPosition: def.selector?.defaultPosition,
          faults: [],
        };
        const node: BoatNode = {
          id,
          type: 'component',
          position,
          data,
          width: def.size.w,
          height: def.size.h,
        };
        return { nodes: [...s.nodes, node] };
      });
      return id;
    },

    removeNode: (id) =>
      set((s) => ({
        nodes: s.nodes.filter((n) => n.id !== id),
        edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      })),

    removeEdge: (id) => set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),

    toggleSwitch: (id) =>
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, on: !n.data.on } } : n,
        ),
      })),

    toggleSubSwitch: (id, subId) =>
      set((s) => ({
        nodes: s.nodes.map((n) => {
          if (n.id !== id) return n;
          const subStates = ((n.data as ComponentNodeData & {
            subStates?: Record<string, { on?: boolean }>;
          }).subStates) ?? {};
          const cur = subStates[subId]?.on === true;
          return {
            ...n,
            data: {
              ...n.data,
              subStates: { ...subStates, [subId]: { ...subStates[subId], on: !cur } },
            } as ComponentNodeData,
          };
        }),
      })),

    setSelectorPosition: (id, idx) =>
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, selectedPosition: idx } } : n,
        ),
      })),

    setLoadOn: (id, on) =>
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, on } } : n,
        ),
      })),

    injectFault: (target, fault) =>
      set((s) => {
        if (target.kind === 'node') {
          return {
            nodes: s.nodes.map((n) =>
              n.id === target.id
                ? { ...n, data: { ...n.data, faults: [...(n.data.faults ?? []), fault] } }
                : n,
            ),
          };
        }
        return {
          edges: s.edges.map((e) =>
            e.id === target.id
              ? { ...e, data: { ...e.data!, faults: [...(e.data?.faults ?? []), fault] } }
              : e,
          ),
        };
      }),

    clearFaults: (target) =>
      set((s) => {
        if (target.kind === 'node') {
          return {
            nodes: s.nodes.map((n) =>
              n.id === target.id ? { ...n, data: { ...n.data, faults: [] } } : n,
            ),
          };
        }
        return {
          edges: s.edges.map((e) =>
            e.id === target.id ? { ...e, data: { ...e.data!, faults: [] } } : e,
          ),
        };
      }),

    setDefaultWire: (id, lengthFt) =>
      set((s) => ({
        defaultWireDefId: id,
        defaultWireLengthFt: lengthFt ?? s.defaultWireLengthFt,
      })),

    setEdgeWire: (edgeId, wireDefId) =>
      set((s) => {
        const def = s.wireDefs.get(wireDefId);
        if (!def) return {};
        return {
          edges: s.edges.map((e) =>
            e.id === edgeId
              ? {
                  ...e,
                  data: { ...e.data!, wireDefId },
                  style: { ...e.style, stroke: def.insulationColor, strokeWidth: gaugeStrokeWidth(def.gaugeAWG) },
                }
              : e,
          ),
        };
      }),

    setSelection: (sel) => set({ selection: sel }),

    startSim: () => set((s) => ({ engine: { ...s.engine, running: true } })),
    stopSim: () => set((s) => ({ engine: { ...s.engine, running: false } })),
    setTimeScale: (sScale) =>
      set((s) => ({ engine: { ...s.engine, timeScale: sScale } })),
    resetSim: () => set({ engine: initialState() }),

    tick: (dtSec) => {
      const s = get();
      // Initialize SOC for any battery that isn't tracked yet.
      const soc = { ...s.engine.soc };
      for (const n of s.nodes) {
        const def = s.componentDefs.get(n.data.defId);
        if (def?.kind === 'battery' && !(n.id in soc)) soc[n.id] = 1.0;
      }
      const r = step({
        defs: s.componentDefs,
        wireDefs: s.wireDefs,
        nodes: s.nodes.map((n) => ({ id: n.id, data: n.data })),
        edges: s.edges.map((e) => ({
          id: e.id,
          source: e.source,
          sourceHandle: e.sourceHandle ?? '',
          target: e.target,
          targetHandle: e.targetHandle ?? '',
          data: e.data!,
        })),
        state: { ...s.engine, soc },
        dtSec,
      });
      set({ engine: r.state });
    },

    upsertComponentDef: (def) =>
      set((s) => {
        const next = new Map(s.componentDefs);
        next.set(def.id, def);
        return { componentDefs: next };
      }),
    removeComponentDef: (id) =>
      set((s) => {
        const next = new Map(s.componentDefs);
        next.delete(id);
        return { componentDefs: next };
      }),
  };
});

function gaugeStrokeWidth(awg: number): number {
  // Map gauge to a visual stroke width: thicker for lower AWG (bigger wire).
  if (awg <= 6) return 4;
  if (awg <= 10) return 3.2;
  if (awg <= 14) return 2.5;
  return 2;
}
