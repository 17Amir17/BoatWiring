import { useContext, useMemo } from 'react';
import { useStore } from '@xyflow/react';
import { useAppStore } from '../state/store';
import { wireAmpacity } from '../lib/sim/awg';
import { EdgeRoutesContext } from './EdgeRoutesContext';

const HEX_RE = /^#([0-9a-f]{6})$/i;

/** Renders ALL routed wire paths as a single SVG overlay above the React Flow
 *  viewport. We compute paths in router/index.ts from port positions directly,
 *  so this layer doesn't depend on React Flow's handle bounds (which can be
 *  flaky after store hydration). */
export default function EdgeOverlay() {
  const routes = useContext(EdgeRoutesContext);
  const transform = useStore((s) => s.transform);
  const edges = useAppStore((s) => s.edges);
  const wireDefs = useAppStore((s) => s.wireDefs);
  const edgeCurrents = useAppStore((s) => s.engine.edgeCurrents);
  const selection = useAppStore((s) => s.selection);
  const setSelection = useAppStore((s) => s.setSelection);

  const items = useMemo(() => {
    const out: Array<{
      id: string;
      d: string;
      stroke: string;
      width: number;
      selected: boolean;
      labelX: number;
      labelY: number;
      current: number;
      gauge: number | undefined;
    }> = [];
    for (const e of edges) {
      const r = routes.get(e.id);
      if (!r || !r.d) continue;
      const wireDef = e.data?.wireDefId ? wireDefs.get(e.data.wireDefId) : undefined;
      const current = edgeCurrents[e.id] ?? 0;
      const ampacity = wireDef ? wireAmpacity(wireDef.gaugeAWG) : 22;
      const baseColor = wireDef?.insulationColor ?? '#94a3b8';
      const stroke = colorFor(current, ampacity, baseColor);
      const baseWidth = wireDef ? gaugeWidth(wireDef.gaugeAWG) : 2;
      const animActive = Math.abs(current) > 0.02;
      const width = animActive ? baseWidth + 1 : baseWidth;
      const sel = selection.edgeIds.includes(e.id);
      out.push({
        id: e.id,
        d: r.d,
        stroke,
        width: sel ? width + 2 : width,
        selected: sel,
        labelX: r.labelX,
        labelY: r.labelY,
        current,
        gauge: wireDef?.gaugeAWG,
      });
    }
    return out;
  }, [edges, routes, wireDefs, edgeCurrents, selection]);

  const [tx, ty, k] = transform;
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ overflow: 'visible' }}
    >
      <g transform={`translate(${tx} ${ty}) scale(${k})`}>
        {items.map((it) => (
          <g key={it.id}>
            <path
              d={it.d}
              fill="none"
              stroke={it.stroke}
              strokeWidth={it.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
              onClick={(ev) => {
                ev.stopPropagation();
                setSelection({ nodeIds: [], edgeIds: [it.id] });
              }}
            />
            {it.selected && (
              <foreignObject
                x={it.labelX - 30}
                y={it.labelY - 9}
                width={60}
                height={18}
                style={{ pointerEvents: 'none' }}
              >
                <div
                  style={{
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid #cbd5e1',
                    borderRadius: 3,
                    padding: '1px 4px',
                    fontSize: 10,
                    color: '#334155',
                    textAlign: 'center',
                    fontFamily: 'ui-sans-serif, system-ui',
                  }}
                >
                  {Math.abs(it.current).toFixed(2)}A · {it.gauge ?? '?'} AWG
                </div>
              </foreignObject>
            )}
          </g>
        ))}
      </g>
    </svg>
  );
}

function colorFor(currentA: number, ampacity: number, base: string): string {
  const ratio = Math.min(2, Math.abs(currentA) / Math.max(ampacity, 1));
  if (ratio < 0.02) return mute(base);
  if (ratio < 0.5)  return brighten(base);
  if (ratio < 0.85) return '#eab308';
  if (ratio < 1.0)  return '#ea580c';
  return '#dc2626';
}
function parseHex(hex: string): [number, number, number] | null {
  const m = HEX_RE.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}
const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
function brighten(hex: string): string {
  const rgb = parseHex(hex); if (!rgb) return hex;
  const lift = (c: number) => (c < 128 ? Math.max(0, c * 0.65) : Math.min(255, c + (255 - c) * 0.35));
  return toHex(lift(rgb[0]), lift(rgb[1]), lift(rgb[2]));
}
function mute(hex: string): string {
  const rgb = parseHex(hex); if (!rgb) return '#94a3b8';
  const blend = (c: number) => Math.round(c * 0.45 + 180 * 0.55);
  return toHex(blend(rgb[0]), blend(rgb[1]), blend(rgb[2]));
}
function gaugeWidth(awg: number): number {
  if (awg <= 6) return 4;
  if (awg <= 10) return 3.2;
  if (awg <= 14) return 2.5;
  return 2;
}
