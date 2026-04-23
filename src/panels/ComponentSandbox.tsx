import { useMemo, useState } from 'react';
import { useAppStore } from '../state/store';
import { runSandbox, type DriveSpec, type SandboxScenario } from '../lib/sim/sandbox';
import type { ComponentDef, Port } from '../types';

interface Props {
  defId: string;
  onClose: () => void;
}

const DEFAULT_DRIVE_KIND_FOR: (port: Port) => DriveSpec = (port) => {
  if (port.role === 'source' || port.label === '+') return { kind: 'voltage', v: 12 };
  if (port.role === 'sink' || port.label === '-') return { kind: 'ground' };
  return { kind: 'load', watts: 6 };
};

export default function ComponentSandbox({ defId, onClose }: Props) {
  const def = useAppStore((s) => s.componentDefs.get(defId));
  const [drives, setDrives] = useState<Record<string, DriveSpec>>(() => {
    if (!def) return {};
    const out: Record<string, DriveSpec> = {};
    for (const p of def.ports) out[p.id] = DEFAULT_DRIVE_KIND_FOR(p);
    return out;
  });
  const [state, setState] = useState<SandboxScenario['state']>({
    on: true,
    selectedPosition: def?.selector?.defaultPosition ?? 0,
    faults: [],
  });
  const [subStates, setSubStates] = useState<Record<string, { on?: boolean }>>({});

  const result = useMemo(() => {
    if (!def) return null;
    return runSandbox(def, {
      drive: Object.entries(drives).map(([portId, source]) => ({ portId, source })),
      state,
      subStates,
    });
  }, [def, drives, state, subStates]);

  if (!def) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-panel-bg border border-panel-border rounded-lg w-[820px] max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 h-10 border-b border-panel-border">
          <div className="text-sm font-semibold">Sandbox: {def.name}</div>
          <button className="text-slate-400 hover:text-slate-200" onClick={onClose}>✕</button>
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="w-1/2 p-3 overflow-auto border-r border-panel-border text-xs">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Drive each port</div>
            {def.ports.map((p) => (
              <DriveRow
                key={p.id}
                port={p}
                spec={drives[p.id]}
                onChange={(s) => setDrives((d) => ({ ...d, [p.id]: s }))}
              />
            ))}
            <div className="mt-3 text-[10px] uppercase tracking-wide text-slate-500 mb-2">State</div>
            {(def.kind === 'switch' || def.kind === 'load') && (
              <label className="flex items-center gap-2 mb-1">
                <input type="checkbox"
                  checked={state?.on === true}
                  onChange={(e) => setState((s) => ({ ...s, on: e.target.checked }))} />
                ON
              </label>
            )}
            {def.kind === 'selectorSwitch' && def.selector && (
              <select
                className="bg-panel-hover border border-panel-border rounded px-1 py-0.5 mb-1"
                value={state?.selectedPosition ?? def.selector.defaultPosition}
                onChange={(e) => setState((s) => ({ ...s, selectedPosition: Number(e.target.value) }))}
              >
                {def.selector.positions.map((p, i) => (
                  <option key={i} value={i}>{i}: {p.label}</option>
                ))}
              </select>
            )}
            {def.kind === 'composite' && def.subComponents && (
              <div className="space-y-1">
                {def.subComponents.map((sub) => (
                  <label key={sub.id} className="flex items-center gap-2">
                    <input type="checkbox"
                      checked={subStates[sub.id]?.on === true}
                      onChange={(e) => setSubStates((s) => ({ ...s, [sub.id]: { on: e.target.checked } }))} />
                    {sub.label ?? sub.id} ({sub.subKind})
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="w-1/2 p-3 overflow-auto text-xs">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Live readout</div>
            <table className="w-full">
              <thead className="text-[10px] text-slate-500">
                <tr><th className="text-left">Port</th><th className="text-right">V</th><th className="text-right">I (drive)</th></tr>
              </thead>
              <tbody>
                {def.ports.map((p) => (
                  <tr key={p.id} className="text-slate-200">
                    <td>{p.label}</td>
                    <td className="text-right font-mono">
                      {result?.voltages[p.id] !== undefined ? result.voltages[p.id]!.toFixed(3) : '—'}
                    </td>
                    <td className="text-right font-mono">
                      {result?.driveCurrents[p.id] !== undefined ? result.driveCurrents[p.id]!.toFixed(3) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={`mt-3 text-[10px] ${result?.converged ? 'text-emerald-400' : 'text-red-400'}`}>
              {result?.converged ? 'converged' : 'failed to converge'}
            </div>
            <button
              className="mt-3 text-[10px] px-2 py-1 rounded bg-panel-hover hover:bg-slate-700/40"
              onClick={() => copyAsFixture(def, drives, state, subStates)}
            >Copy as JSON fixture</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DriveRow({
  port,
  spec,
  onChange,
}: {
  port: Port;
  spec: DriveSpec;
  onChange: (s: DriveSpec) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_2fr_2fr] gap-1 mb-1 items-center">
      <span className="text-slate-300">{port.label}</span>
      <select
        className="bg-panel-hover border border-panel-border rounded px-1 py-0.5"
        value={spec.kind}
        onChange={(e) => {
          const k = e.target.value as DriveSpec['kind'];
          if (k === 'voltage') onChange({ kind: 'voltage', v: 12 });
          else if (k === 'ground') onChange({ kind: 'ground' });
          else if (k === 'load') onChange({ kind: 'load', watts: 6, vMin: 0 });
          else if (k === 'short') onChange({ kind: 'short' });
          else if (k === 'leak') onChange({ kind: 'leak', rOhm: 50 });
        }}
      >
        <option value="voltage">voltage</option>
        <option value="ground">ground</option>
        <option value="load">load</option>
        <option value="short">short</option>
        <option value="leak">leak</option>
      </select>
      {spec.kind === 'voltage' && (
        <input className="bg-panel-hover border border-panel-border rounded px-1 font-mono text-right"
          type="number" step="0.1" value={spec.v}
          onChange={(e) => onChange({ kind: 'voltage', v: Number(e.target.value) || 0 })} />
      )}
      {spec.kind === 'load' && (
        <input className="bg-panel-hover border border-panel-border rounded px-1 font-mono text-right"
          type="number" step="0.5" value={spec.watts}
          onChange={(e) => onChange({ kind: 'load', watts: Number(e.target.value) || 0 })} />
      )}
      {spec.kind === 'leak' && (
        <input className="bg-panel-hover border border-panel-border rounded px-1 font-mono text-right"
          type="number" step="1" value={spec.rOhm}
          onChange={(e) => onChange({ kind: 'leak', rOhm: Number(e.target.value) || 1 })} />
      )}
      {(spec.kind === 'ground' || spec.kind === 'short') && <span />}
    </div>
  );
}

function copyAsFixture(
  def: ComponentDef,
  drives: Record<string, DriveSpec>,
  state: SandboxScenario['state'],
  subStates: Record<string, { on?: boolean }>,
) {
  const payload = {
    defId: def.id,
    drive: Object.entries(drives).map(([portId, source]) => ({ portId, source })),
    state,
    subStates,
  };
  navigator.clipboard?.writeText(JSON.stringify(payload, null, 2)).catch(() => {});
}
