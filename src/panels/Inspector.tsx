import { useAppStore } from '../state/store';
import type { Fault } from '../types';
import { FAULT_PRESETS } from '../lib/sim/faults';
import { wireResistance } from '../lib/sim/awg';

export default function Inspector() {
  const sel = useAppStore((s) => s.selection);
  const nodes = useAppStore((s) => s.nodes);
  const edges = useAppStore((s) => s.edges);
  const defs = useAppStore((s) => s.componentDefs);
  const wireDefs = useAppStore((s) => s.wireDefs);
  const portVoltages = useAppStore((s) => s.engine.nodeVoltages);
  const edgeCurrents = useAppStore((s) => s.engine.edgeCurrents);
  const fuseOpen = useAppStore((s) => s.engine.fuseOpen);
  const soc = useAppStore((s) => s.engine.soc);
  const injectFault = useAppStore((s) => s.injectFault);
  const clearFaults = useAppStore((s) => s.clearFaults);
  const removeNode = useAppStore((s) => s.removeNode);
  const removeEdge = useAppStore((s) => s.removeEdge);

  const node = sel.nodeIds.length === 1 ? nodes.find((n) => n.id === sel.nodeIds[0]) : null;
  const edge = sel.edgeIds.length === 1 ? edges.find((e) => e.id === sel.edgeIds[0]) : null;

  return (
    <div className="w-72 h-full overflow-y-auto bg-panel-bg border-l border-panel-border p-3 text-sm">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Inspector</div>
      {!node && !edge && <div className="text-slate-500 text-xs">Select a component or wire.</div>}

      {node && (() => {
        const def = defs.get(node.data.defId);
        if (!def) return null;
        return (
          <div>
            <div className="font-semibold mb-1">{def.name}</div>
            <div className="text-[10px] text-slate-400">{def.kind}</div>
            {def.source && (
              <a
                className="block text-[10px] text-orange-300 underline truncate"
                href={def.source.url}
                target="_blank"
                rel="noreferrer"
                title={def.source.sellerTitle}
              >
                {def.source.sellerTitle}
              </a>
            )}
            <div className="mt-2 text-xs space-y-1">
              {def.kind === 'battery' && (
                <div>
                  SOC: {((soc[node.id] ?? 1) * 100).toFixed(0)}%
                </div>
              )}
              {def.ports.map((p) => {
                const v = portVoltages[`${node.id}/${p.id}`];
                return (
                  <div key={p.id} className="flex justify-between text-slate-300">
                    <span>{p.label}</span>
                    <span className="font-mono">{v !== undefined ? `${v.toFixed(2)} V` : '—'}</span>
                  </div>
                );
              })}
              {(def.kind === 'fuse' || def.kind === 'breaker') && (
                <div className={fuseOpen[node.id] ? 'text-red-400' : 'text-emerald-400'}>
                  {fuseOpen[node.id] ? 'BLOWN' : 'INTACT'}
                </div>
              )}
            </div>

            <div className="mt-3 text-[10px] text-slate-500">Specs</div>
            <div className="text-xs font-mono space-y-0.5">
              {Object.entries(def.specs).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-slate-400">{k}</span>
                  <span className="text-slate-200">{String(v)}</span>
                </div>
              ))}
            </div>

            <FaultControls
              faults={node.data.faults ?? []}
              onInject={(f) => injectFault({ kind: 'node', id: node.id }, f)}
              onClear={() => clearFaults({ kind: 'node', id: node.id })}
            />

            <button
              className="mt-3 w-full text-[10px] py-1 rounded bg-red-900/40 hover:bg-red-900/60 text-red-200"
              onClick={() => removeNode(node.id)}
            >
              Remove component
            </button>
          </div>
        );
      })()}

      {edge && (() => {
        const wDef = wireDefs.get(edge.data!.wireDefId);
        if (!wDef) return null;
        const I = edgeCurrents[edge.id] ?? 0;
        const len = edge.data!.lengthFt;
        const r = wireResistance(wDef.gaugeAWG, len);
        const lossW = I * I * r;
        return (
          <div>
            <div className="font-semibold mb-1">{wDef.name}</div>
            <div className="text-[10px] text-slate-400">wire</div>
            {wDef.source && (
              <a
                className="block text-[10px] text-orange-300 underline truncate"
                href={wDef.source.url}
                target="_blank"
                rel="noreferrer"
              >
                {wDef.source.sellerTitle}
              </a>
            )}
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between"><span>Gauge</span><span className="font-mono">{wDef.gaugeAWG} AWG</span></div>
              <div className="flex justify-between">
                <span>Length</span>
                <input
                  className="w-16 bg-panel-hover border border-panel-border rounded px-1 text-right font-mono"
                  type="number"
                  step="0.5"
                  value={len}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isFinite(v)) return;
                    useAppStore.setState((s) => ({
                      edges: s.edges.map((x) =>
                        x.id === edge.id
                          ? { ...x, data: { ...x.data!, lengthFt: v } }
                          : x,
                      ),
                    }));
                  }}
                />
              </div>
              <div className="flex justify-between"><span>Current</span><span className="font-mono">{I.toFixed(2)} A</span></div>
              <div className="flex justify-between"><span>Resistance</span><span className="font-mono">{(r * 1000).toFixed(2)} mΩ</span></div>
              <div className="flex justify-between"><span>Power loss</span><span className="font-mono">{lossW.toFixed(3)} W</span></div>
              <div className="flex justify-between"><span>Ampacity</span><span className="font-mono">{wDef.maxAmps} A</span></div>
            </div>
            <FaultControls
              faults={edge.data?.faults ?? []}
              onInject={(f) => injectFault({ kind: 'edge', id: edge.id }, f)}
              onClear={() => clearFaults({ kind: 'edge', id: edge.id })}
            />
            <button
              className="mt-3 w-full text-[10px] py-1 rounded bg-red-900/40 hover:bg-red-900/60 text-red-200"
              onClick={() => removeEdge(edge.id)}
            >
              Remove wire
            </button>
          </div>
        );
      })()}
    </div>
  );
}

function FaultControls({
  faults,
  onInject,
  onClear,
}: {
  faults: Fault[];
  onInject: (f: Fault) => void;
  onClear: () => void;
}) {
  return (
    <div className="mt-4">
      <div className="text-[10px] text-slate-500 mb-1">Faults ({faults.length})</div>
      <div className="space-y-1">
        {FAULT_PRESETS.map((p) => (
          <button
            key={p.label}
            className="w-full text-left text-[10px] px-2 py-1 rounded bg-panel-hover hover:bg-slate-700/40"
            onClick={() => onInject(p.build())}
          >
            + {p.label}
          </button>
        ))}
        {faults.length > 0 && (
          <button
            className="w-full text-[10px] px-2 py-1 rounded bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-200"
            onClick={onClear}
          >
            clear all
          </button>
        )}
      </div>
    </div>
  );
}
