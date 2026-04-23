import { useMemo, useState } from 'react';
import { useAppStore } from '../state/store';
import type { ComponentDef, ComponentKind } from '../types';

const KIND_ORDER: ComponentKind[] = [
  'battery',
  'busbar',
  'fuse',
  'fuseBlock',
  'breaker',
  'switch',
  'selectorSwitch',
  'load',
  'connector',
  'harness',
  'composite',
  'dcdc',
  'indicator',
  'accessory',
  'custom',
];

const KIND_LABEL: Record<ComponentKind, string> = {
  battery: 'Batteries',
  busbar: 'Bus bars',
  fuse: 'Fuses',
  fuseBlock: 'Fuse blocks',
  breaker: 'Breakers',
  switch: 'Switches',
  selectorSwitch: 'Selectors',
  load: 'Loads',
  connector: 'Connectors',
  harness: 'Harnesses',
  composite: 'Composites',
  dcdc: 'DC-DC / USB',
  indicator: 'Indicators',
  accessory: 'Accessories',
  custom: 'Custom',
};

export default function Palette() {
  const componentDefs = useAppStore((s) => s.componentDefs);
  const wireDefs = useAppStore((s) => s.wireDefs);
  const defaultWireDefId = useAppStore((s) => s.defaultWireDefId);
  const setDefaultWire = useAppStore((s) => s.setDefaultWire);
  const [filter, setFilter] = useState('');

  const grouped = useMemo(() => {
    const groups = new Map<ComponentKind, ComponentDef[]>();
    const lc = filter.toLowerCase();
    for (const d of componentDefs.values()) {
      if (lc && !d.name.toLowerCase().includes(lc) && !d.kind.includes(lc)) continue;
      const arr = groups.get(d.kind) ?? [];
      arr.push(d);
      groups.set(d.kind, arr);
    }
    return groups;
  }, [componentDefs, filter]);

  return (
    <div className="w-64 h-full overflow-y-auto bg-panel-bg border-r border-panel-border p-2 text-sm">
      <input
        className="w-full bg-panel-hover border border-panel-border rounded px-2 py-1 text-xs mb-2"
        placeholder="Search components..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="mb-3">
        <label className="block text-[10px] text-slate-400 mb-1">Default wire (drag to connect)</label>
        <select
          className="w-full bg-panel-hover border border-panel-border rounded px-1 py-1 text-xs"
          value={defaultWireDefId}
          onChange={(e) => setDefaultWire(e.target.value)}
        >
          {[...wireDefs.values()].map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>
      {KIND_ORDER.map((kind) => {
        const list = grouped.get(kind);
        if (!list || list.length === 0) return null;
        return (
          <div key={kind} className="mb-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
              {KIND_LABEL[kind]}
            </div>
            <div className="space-y-1">
              {list.map((def) => (
                <PaletteRow key={def.id} def={def} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PaletteRow({ def }: { def: ComponentDef }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-defid', def.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      title={def.source ? `${def.source.sellerTitle}\n${def.source.url}` : def.name}
      className="flex items-center justify-between px-2 py-1 bg-panel-hover hover:bg-slate-700/40 rounded cursor-grab text-xs"
    >
      <span className="truncate">{def.name}</span>
      {def.source?.platform === 'aliexpress' && (
        <span className="text-[8px] text-orange-400 ml-1">AE</span>
      )}
    </div>
  );
}
