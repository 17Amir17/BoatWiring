import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../state/store';
import type { ComponentDef, ComponentKind, Port, PortRole } from '../types';
import { putImage, getImageURL } from '../lib/storage/images';

const KINDS: ComponentKind[] = [
  'battery', 'busbar', 'fuse', 'fuseBlock', 'breaker', 'switch',
  'selectorSwitch', 'composite', 'harness', 'connector', 'dcdc',
  'indicator', 'load', 'accessory', 'custom',
];

interface Props {
  defId?: string;        // undefined → creating new
  onClose: () => void;
}

export default function ComponentEditor({ defId, onClose }: Props) {
  const upsert = useAppStore((s) => s.upsertComponentDef);
  const existing = useAppStore((s) => (defId ? s.componentDefs.get(defId) : undefined));
  const [draft, setDraft] = useState<ComponentDef>(() =>
    existing ?? {
      id: `custom-${Date.now()}`,
      kind: 'custom',
      name: 'New component',
      size: { w: 100, h: 70 },
      ports: [
        { id: 'a', label: 'A', rel: { x: 0.1, y: 0.5 }, role: 'passthrough' },
        { id: 'b', label: 'B', rel: { x: 0.9, y: 0.5 }, role: 'passthrough' },
      ],
      specs: {},
    },
  );
  const [imgURL, setImgURL] = useState<string | undefined>();
  const imgBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    const ref = draft.imageRef;
    if (!ref) {
      setImgURL(undefined);
      return;
    }
    if (ref.startsWith('/')) {
      setImgURL(ref);
      return;
    }
    getImageURL(ref).then((u) => { if (alive) setImgURL(u); });
    return () => { alive = false; };
  }, [draft.imageRef]);

  const onUploadImage = async (file: File) => {
    const ref = `usr-${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
    await putImage(ref, file, file.type);
    setDraft((d) => ({ ...d, imageRef: ref }));
  };

  const onAddPortAt = (clientX: number, clientY: number) => {
    if (!imgBoxRef.current) return;
    const rect = imgBoxRef.current.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    setDraft((d) => ({
      ...d,
      ports: [
        ...d.ports,
        {
          id: `p${d.ports.length + 1}`,
          label: `P${d.ports.length + 1}`,
          rel: { x, y },
          role: 'passthrough',
        },
      ],
    }));
  };

  const updatePort = (i: number, patch: Partial<Port>) => {
    setDraft((d) => ({
      ...d,
      ports: d.ports.map((p, j) => (j === i ? { ...p, ...patch } : p)),
    }));
  };
  const removePort = (i: number) => {
    setDraft((d) => ({ ...d, ports: d.ports.filter((_, j) => j !== i) }));
  };

  const setSpec = (k: string, v: string) => {
    setDraft((d) => {
      const num = Number(v);
      const value: number | string = v !== '' && !Number.isNaN(num) ? num : v;
      return { ...d, specs: { ...d.specs, [k]: value } };
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-panel-bg border border-panel-border rounded-lg w-[820px] max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 h-10 border-b border-panel-border">
          <div className="text-sm font-semibold">{existing ? 'Edit' : 'New'} component</div>
          <button className="text-slate-600 hover:text-slate-800" onClick={onClose}>✕</button>
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 p-3 overflow-auto">
            <div
              ref={imgBoxRef}
              className="relative bg-slate-100 rounded border border-panel-border mx-auto"
              style={{ width: 360, height: 280 }}
              onDoubleClick={(e) => onAddPortAt(e.clientX, e.clientY)}
              title="Double-click to add a port"
            >
              {imgURL ? (
                <img src={imgURL} alt="" className="w-full h-full object-contain" />
              ) : (
                <div className="text-xs text-slate-500 p-3">Upload an image to preview ports.</div>
              )}
              {draft.ports.map((p, i) => (
                <div
                  key={p.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${p.rel.x * 100}%`, top: `${p.rel.y * 100}%` }}
                >
                  <div className="w-3 h-3 bg-yellow-300 border-2 border-slate-900 rounded-full" />
                  <div className="absolute -top-3 left-3 text-[9px] text-slate-800 whitespace-nowrap">
                    {p.label} <button className="text-red-600 ml-1" onClick={() => removePort(i)}>×</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && onUploadImage(e.target.files[0])}
                className="text-xs"
              />
              <span className="text-slate-500">Double-click image to add ports.</span>
            </div>
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Ports</div>
              <div className="space-y-1">
                {draft.ports.map((p, i) => (
                  <div key={p.id} className="grid grid-cols-[2fr_2fr_2fr_3fr] gap-1 text-xs">
                    <input
                      className="bg-slate-100 border border-panel-border rounded px-1"
                      value={p.id} onChange={(e) => updatePort(i, { id: e.target.value })}
                    />
                    <input
                      className="bg-slate-100 border border-panel-border rounded px-1"
                      value={p.label} onChange={(e) => updatePort(i, { label: e.target.value })}
                    />
                    <select
                      className="bg-slate-100 border border-panel-border rounded px-1"
                      value={p.role}
                      onChange={(e) => updatePort(i, { role: e.target.value as PortRole })}
                    >
                      <option value="source">source</option>
                      <option value="sink">sink</option>
                      <option value="passthrough">passthrough</option>
                    </select>
                    <span className="text-slate-500 font-mono text-[10px]">
                      ({p.rel.x.toFixed(2)}, {p.rel.y.toFixed(2)})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="w-[300px] border-l border-panel-border p-3 overflow-auto text-xs space-y-2">
            <Field label="ID">
              <input
                className="w-full bg-slate-100 border border-panel-border rounded px-1"
                value={draft.id} onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value }))}
              />
            </Field>
            <Field label="Name">
              <input
                className="w-full bg-slate-100 border border-panel-border rounded px-1"
                value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </Field>
            <Field label="Kind">
              <select
                className="w-full bg-slate-100 border border-panel-border rounded px-1"
                value={draft.kind}
                onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as ComponentKind }))}
              >
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </Field>
            <Field label="Width / Height">
              <div className="flex gap-1">
                <input className="w-full bg-slate-100 border border-panel-border rounded px-1"
                  type="number" value={draft.size.w}
                  onChange={(e) => setDraft((d) => ({ ...d, size: { ...d.size, w: Number(e.target.value) || 60 } }))} />
                <input className="w-full bg-slate-100 border border-panel-border rounded px-1"
                  type="number" value={draft.size.h}
                  onChange={(e) => setDraft((d) => ({ ...d, size: { ...d.size, h: Number(e.target.value) || 40 } }))} />
              </div>
            </Field>
            <Field label="Qty owned">
              <input className="w-full bg-slate-100 border border-panel-border rounded px-1"
                type="number" value={draft.qtyOwned ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, qtyOwned: e.target.value === '' ? undefined : Number(e.target.value) }))
                } />
            </Field>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Specs</div>
              {Object.entries(draft.specs).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1 mb-1">
                  <input className="w-1/3 bg-slate-100 border border-panel-border rounded px-1"
                    value={k}
                    onChange={(e) => {
                      setDraft((d) => {
                        const next = { ...d.specs };
                        const val = next[k];
                        delete next[k];
                        next[e.target.value] = val;
                        return { ...d, specs: next };
                      });
                    }} />
                  <input className="flex-1 bg-slate-100 border border-panel-border rounded px-1"
                    value={String(v)} onChange={(e) => setSpec(k, e.target.value)} />
                  <button className="text-red-600" onClick={() =>
                    setDraft((d) => {
                      const next = { ...d.specs };
                      delete next[k];
                      return { ...d, specs: next };
                    })
                  }>×</button>
                </div>
              ))}
              <button
                className="text-[10px] px-2 py-1 rounded bg-slate-100 hover:bg-slate-200"
                onClick={() => setDraft((d) => ({ ...d, specs: { ...d.specs, ['key' + Object.keys(d.specs).length]: '' } }))}
              >+ spec</button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-3 h-10 border-t border-panel-border">
          <button className="text-xs px-3 py-1 rounded bg-slate-100" onClick={onClose}>Cancel</button>
          <button
            className="text-xs px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => { upsert(draft); onClose(); }}
          >Save</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] text-slate-500 mb-0.5">{label}</div>
      {children}
    </label>
  );
}
