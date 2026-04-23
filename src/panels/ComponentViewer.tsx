import { useEffect, useState } from 'react';
import { useAppStore } from '../state/store';
import { LookalikeBody, STUB, stubLine } from '../canvas/lookalike';
import type { Port } from '../types';

/**
 * Single-component viewer at `?view=<defId>`. Renders the styled lookalike at large
 * scale beside the AliExpress product photo so an agent (or human) can iterate on
 * port placement until the two match.
 *
 * The agent's loop:
 *   1. Navigate to /?view=<defId>
 *   2. Compare the rendered lookalike (left) to the product photo (right)
 *   3. Edit the JSON's port `rel` coordinates and `size`
 *   4. Vite HMR auto-refreshes — re-compare
 *   5. Repeat until pin positions land on the same studs/terminals as the photo
 */
export default function ComponentViewer({ defId, onClose }: { defId: string; onClose: () => void }) {
  const def = useAppStore((s) => s.componentDefs.get(defId));
  const [scale, setScale] = useState(3);
  const [showGrid, setShowGrid] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [showPhoto, setShowPhoto] = useState(true);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!def) {
    return (
      <div className="fixed inset-0 bg-panel-bg flex items-center justify-center text-slate-800">
        <div>
          No component with id <code className="text-amber-700">{defId}</code>.
          <button className="ml-3 px-2 py-1 bg-slate-100 rounded text-xs" onClick={onClose}>×</button>
        </div>
      </div>
    );
  }

  const w = def.size.w * scale;
  const h = def.size.h * scale;
  const bw = w - 2 * STUB * scale;
  const bh = h - 2 * STUB * scale;

  return (
    <div className="fixed inset-0 z-50 bg-panel-bg overflow-auto">
      <div className="flex items-center gap-3 px-4 h-10 border-b border-panel-border text-xs">
        <span className="text-slate-600">Component Viewer:</span>
        <span className="text-slate-900 font-semibold">{def.name}</span>
        <span className="text-slate-500">({def.kind})</span>
        <span className="text-slate-500">id: <code className="text-amber-700">{def.id}</code></span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-slate-500">scale</span>
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              className={`px-2 py-0.5 rounded ${scale === n ? 'bg-yellow-200 text-yellow-900' : 'bg-slate-100'}`}
              onClick={() => setScale(n)}
            >
              {n}×
            </button>
          ))}
          <label className="flex items-center gap-1 ml-2">
            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
            <span className="text-slate-600">grid</span>
          </label>
          <label className="flex items-center gap-1 ml-2">
            <input type="checkbox" checked={showPhoto} onChange={(e) => setShowPhoto(e.target.checked)} />
            <span className="text-slate-600">photo</span>
          </label>
          <label className="flex items-center gap-1 ml-2">
            <input type="checkbox" checked={showTable} onChange={(e) => setShowTable(e.target.checked)} />
            <span className="text-slate-600">port table</span>
          </label>
          <button className="ml-2 px-2 py-0.5 rounded bg-slate-100" onClick={onClose}>esc / close</button>
        </div>
      </div>

      <div className={`grid ${showPhoto ? 'grid-cols-2' : 'grid-cols-1'} gap-4 p-6`}>
        {/* Sim render */}
        <div className="bg-white border border-panel-border rounded p-4">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
            Sim render — {def.size.w}×{def.size.h}px (scaled {scale}×)
          </div>
          <div className="flex items-center justify-center" style={{ minHeight: 360 }}>
            <div className="relative" style={{ width: w, height: h }}>
              {/* fractional coord overlay grid */}
              {showGrid && (
                <svg className="absolute inset-0 pointer-events-none" width={w} height={h}>
                  {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
                    <g key={i} stroke="#334155" strokeWidth="0.5" strokeDasharray="2 4">
                      <line x1={t * w} y1="0" x2={t * w} y2={h} />
                      <line x1="0" y1={t * h} x2={w} y2={t * h} />
                    </g>
                  ))}
                </svg>
              )}
              {/* body */}
              <svg width={w} height={h} className="absolute inset-0 overflow-visible">
                {def.ports.map((p) => {
                  const ln = stubLine(p.rel, w, h);
                  return (
                    <line
                      key={p.id}
                      x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2}
                      stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round"
                    />
                  );
                })}
                <g transform={`translate(${STUB * scale}, ${STUB * scale})`}>
                  <g transform={`scale(${scale})`}>
                    <LookalikeBody
                      def={def}
                      data={{
                        defId: def.id,
                        on: true,
                        selectedPosition: def.selector?.defaultPosition ?? 0,
                        faults: [],
                      }}
                      bw={bw / scale}
                      bh={bh / scale}
                      fuseBlown={false}
                    />
                  </g>
                </g>
              </svg>
              {/* pins on top */}
              {def.ports.map((p) => (
                <PinDot key={p.id} port={p} w={w} h={h} />
              ))}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-3">
            Pins shown OUTSIDE the body via stubs. Each pin is positioned at
            <code className="mx-1 text-amber-700">port.rel × size</code>. Edit the JSON
            and Vite will hot-reload.
          </div>
        </div>

        {/* Product photo */}
        {showPhoto && (
        <div className="bg-white border border-panel-border rounded p-4">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
            Product photo
          </div>
          <div className="flex items-center justify-center" style={{ minHeight: 360 }}>
            {def.imageRef ? (
              <img
                src={def.imageRef.startsWith('/') ? def.imageRef : ''}
                alt=""
                className="max-w-full max-h-[400px] object-contain rounded"
              />
            ) : (
              <div className="text-slate-500 text-sm">No imageRef set.</div>
            )}
          </div>
          {def.source && (
            <a
              className="block mt-2 text-[10px] text-orange-600 underline truncate"
              href={def.source.url}
              target="_blank"
              rel="noreferrer"
            >
              {def.source.sellerTitle}
            </a>
          )}
        </div>
        )}

        {/* Port list */}
        {showTable && (
        <div className="col-span-2 bg-white border border-panel-border rounded p-4">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
            Ports ({def.ports.length})
          </div>
          <table className="w-full text-xs">
            <thead className="text-[10px] text-slate-500">
              <tr>
                <th className="text-left">id</th>
                <th className="text-left">label</th>
                <th className="text-left">role</th>
                <th className="text-right">rel.x</th>
                <th className="text-right">rel.y</th>
                <th className="text-right">px x</th>
                <th className="text-right">px y</th>
                <th className="text-left">edge</th>
              </tr>
            </thead>
            <tbody>
              {def.ports.map((p) => (
                <tr key={p.id} className="text-slate-800 border-t border-panel-border/40">
                  <td className="font-mono">{p.id}</td>
                  <td>{p.label}</td>
                  <td className="text-slate-600">{p.role}</td>
                  <td className="text-right font-mono">{p.rel.x.toFixed(3)}</td>
                  <td className="text-right font-mono">{p.rel.y.toFixed(3)}</td>
                  <td className="text-right font-mono">{(p.rel.x * w).toFixed(0)}</td>
                  <td className="text-right font-mono">{(p.rel.y * h).toFixed(0)}</td>
                  <td className="text-slate-500">{describeEdge(p.rel)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
}

function describeEdge(rel: { x: number; y: number }): string {
  const tol = 0.08;
  const parts: string[] = [];
  if (rel.x <= tol) parts.push('LEFT');
  if (rel.x >= 1 - tol) parts.push('RIGHT');
  if (rel.y <= tol) parts.push('TOP');
  if (rel.y >= 1 - tol) parts.push('BOTTOM');
  return parts.length ? parts.join(' ') : 'inside';
}

function PinDot({ port, w, h }: { port: Port; w: number; h: number }) {
  const px = port.rel.x * w;
  const py = port.rel.y * h;
  const isPower = port.role === 'source' || port.label === '+';
  const isGround = port.role === 'sink' && (port.label === '-' || port.label.toLowerCase().includes('gnd'));
  const dotColor = isPower ? '#facc15' : isGround ? '#0f172a' : '#cbd5e1';

  // Label position based on which edge the pin is closest to
  const dl = port.rel.x;
  const dr = 1 - port.rel.x;
  const dt = port.rel.y;
  const db = 1 - port.rel.y;
  const min = Math.min(dl, dr, dt, db);
  let labelStyle: React.CSSProperties = { transform: 'translate(8px, -50%)' };
  if (min === dl) labelStyle = { transform: 'translate(10px, -50%)' };
  else if (min === dr) labelStyle = { transform: 'translate(calc(-100% - 10px), -50%)' };
  else if (min === dt) labelStyle = { transform: 'translate(-50%, 10px)' };
  else if (min === db) labelStyle = { transform: 'translate(-50%, calc(-100% - 10px))' };

  return (
    <>
      <div
        data-pin-id={port.id}
        className="absolute rounded-full"
        style={{
          left: px, top: py,
          width: 14, height: 14,
          background: dotColor,
          border: '2px solid #f8fafc',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.7)',
          transform: 'translate(-50%, -50%)',
        }}
      />
      <span
        className="absolute pointer-events-none text-[10px] font-semibold text-slate-900 select-none"
        style={{
          left: px, top: py,
          ...labelStyle,
          textShadow: '0 0 3px #0f172a, 0 0 6px #0f172a',
          whiteSpace: 'nowrap',
        }}
      >
        {port.label}
      </span>
    </>
  );
}
