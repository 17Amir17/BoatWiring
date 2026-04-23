import { useMemo } from 'react';
import { useAppStore } from '../state/store';

export default function BillOfMaterials() {
  const componentDefs = useAppStore((s) => s.componentDefs);
  const nodes = useAppStore((s) => s.nodes);
  const wireDefs = useAppStore((s) => s.wireDefs);
  const edges = useAppStore((s) => s.edges);

  const rows = useMemo(() => {
    const used = new Map<string, number>();
    for (const n of nodes) used.set(n.data.defId, (used.get(n.data.defId) ?? 0) + 1);
    const wireUsed = new Map<string, number>();
    for (const e of edges)
      wireUsed.set(e.data!.wireDefId, (wireUsed.get(e.data!.wireDefId) ?? 0) + 1);

    const out: { id: string; name: string; kind: string; qtyOwned?: number; qtyUsed: number; over: boolean; src?: string }[] = [];
    for (const def of componentDefs.values()) {
      if (def.qtyOwned === undefined && (used.get(def.id) ?? 0) === 0) continue;
      const qtyUsed = used.get(def.id) ?? 0;
      out.push({
        id: def.id,
        name: def.name,
        kind: def.kind,
        qtyOwned: def.qtyOwned,
        qtyUsed,
        over: def.qtyOwned !== undefined && qtyUsed > def.qtyOwned,
        src: def.source?.url,
      });
    }
    for (const wd of wireDefs.values()) {
      const qtyUsed = wireUsed.get(wd.id) ?? 0;
      if (qtyUsed === 0 && !wd.source) continue;
      out.push({
        id: wd.id,
        name: wd.name,
        kind: 'wire',
        qtyOwned: undefined,
        qtyUsed,
        over: false,
        src: wd.source?.url,
      });
    }
    return out.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  }, [componentDefs, nodes, wireDefs, edges]);

  return (
    <div className="p-3 text-xs">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Bill of Materials</div>
      <table className="w-full">
        <thead className="text-[10px] text-slate-500">
          <tr>
            <th className="text-left">Item</th>
            <th className="text-left">Kind</th>
            <th className="text-right">Used</th>
            <th className="text-right">Owned</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.over ? 'text-red-600' : 'text-slate-800'}>
              <td className="truncate max-w-[180px]">
                {r.src ? (
                  <a className="underline" href={r.src} target="_blank" rel="noreferrer">{r.name}</a>
                ) : r.name}
              </td>
              <td className="text-slate-600">{r.kind}</td>
              <td className="text-right font-mono">{r.qtyUsed}</td>
              <td className="text-right font-mono">{r.qtyOwned ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
