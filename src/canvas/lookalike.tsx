import type { ComponentDef, ComponentNodeData } from '../types';

/** Pixels of stub between the body edge and the pin/handle on the node perimeter.
 *  The body is rendered INSET by this amount; pin stubs are SVG lines bridging the gap.
 *  This is what makes pins look like they stick OUT of the component instead of being
 *  decals on top of it. */
export const STUB = 14;

const ATC_COLORS: Record<number, string> = {
  3: '#a855f7', 5: '#fde68a', 7.5: '#a16207', 10: '#ef4444',
  15: '#3b82f6', 20: '#facc15', 25: '#fef3c7', 30: '#22c55e',
  40: '#f97316',
};

function num(v: unknown, d: number): number {
  return typeof v === 'number' ? v : d;
}

function str(v: unknown, d: string): string {
  return typeof v === 'string' ? v : d;
}

interface BodyProps {
  def: ComponentDef;
  data: ComponentNodeData;
  bw: number; // body width (node width - 2*STUB)
  bh: number;
  fuseBlown?: boolean;
}

function BatteryBody({ bw, bh }: BodyProps) {
  return (
    <g>
      {/* terminal posts on top */}
      <rect x={bw * 0.18} y="0" width={bw * 0.14} height={bh * 0.10} fill="#1e293b" stroke="#475569" />
      <rect x={bw * 0.68} y="0" width={bw * 0.14} height={bh * 0.10} fill="#dc2626" stroke="#7f1d1d" />
      {/* battery case */}
      <rect x="0" y={bh * 0.10} width={bw} height={bh * 0.90}
            rx="6" fill="#e2e8f0" stroke="#475569" strokeWidth="1.5" />
      <text x={bw / 2} y={bh * 0.55} textAnchor="middle"
            fill="#0f172a" fontSize="11" fontWeight="600">12 V</text>
      <text x={bw * 0.25} y={bh * 0.32} textAnchor="middle" fill="#1e293b" fontSize="10">−</text>
      <text x={bw * 0.75} y={bh * 0.32} textAnchor="middle" fill="#dc2626" fontSize="10">+</text>
    </g>
  );
}

function FuseAtcBody({ bw, bh, def, fuseBlown }: BodyProps) {
  const ratingA = num(def.specs.ratingA, 30);
  const color = ATC_COLORS[ratingA] ?? '#facc15';
  return (
    <g>
      <rect x="0" y="0" width={bw} height={bh * 0.65}
            rx="3" fill={color} stroke="#1e293b" strokeWidth="1.2" />
      <rect x={bw * 0.30} y={bh * 0.65} width={bw * 0.10} height={bh * 0.35} fill="#94a3b8" />
      <rect x={bw * 0.60} y={bh * 0.65} width={bw * 0.10} height={bh * 0.35} fill="#94a3b8" />
      <text x={bw / 2} y={bh * 0.42} textAnchor="middle"
            fill="#0f172a" fontSize="11" fontWeight="700">{ratingA}A</text>
      {fuseBlown && (
        <line x1={2} y1={2} x2={bw - 2} y2={bh * 0.63}
              stroke="#dc2626" strokeWidth="2.5" />
      )}
    </g>
  );
}

function FuseMrbfBody({ bw, bh, def, fuseBlown }: BodyProps) {
  const ratingA = num(def.specs.ratingA, 40);
  const r = Math.min(bw, bh) * 0.18;
  return (
    <g>
      <rect x="0" y="0" width={bw} height={bh}
            rx="4" fill="#fbbf24" fillOpacity="0.7" stroke="#92400e" strokeWidth="1.5" />
      <circle cx={bw * 0.18} cy={bh * 0.5} r={r}
              fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
      <circle cx={bw * 0.82} cy={bh * 0.5} r={r}
              fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
      <text x={bw / 2} y={bh * 0.50 + 4} textAnchor="middle"
            fill="#0f172a" fontSize="10" fontWeight="700">{ratingA}A</text>
      {fuseBlown && (
        <line x1={bw * 0.10} y1={bh * 0.10} x2={bw * 0.90} y2={bh * 0.90}
              stroke="#dc2626" strokeWidth="2.5" />
      )}
    </g>
  );
}

function FuseBody(p: BodyProps) {
  const ff = str(p.def.specs.formFactor, 'ATC');
  return ff.toUpperCase() === 'MRBF' ? <FuseMrbfBody {...p} /> : <FuseAtcBody {...p} />;
}

function SwitchBody({ bw, bh, data }: BodyProps) {
  const on = data.on === true;
  return (
    <g>
      <rect x="0" y="0" width={bw} height={bh}
            rx="4" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
      <rect x={bw * 0.15} y={bh * 0.2} width={bw * 0.7} height={bh * 0.6}
            rx="3" fill={on ? '#22c55e' : '#1e293b'} stroke="#64748b" />
      <text x={bw / 2} y={bh * 0.55} textAnchor="middle"
            fill={on ? '#0f172a' : '#94a3b8'} fontSize="9" fontWeight="700">
        {on ? 'ON' : 'OFF'}
      </text>
    </g>
  );
}

function SelectorBody({ bw, bh, def, data }: BodyProps) {
  const positions = def.selector?.positions ?? [];
  const idx = data.selectedPosition ?? def.selector?.defaultPosition ?? 0;
  const angle = positions.length > 1
    ? (idx / (positions.length - 1)) * 270 - 135
    : 0;
  const cx = bw / 2;
  const cy = bh / 2;
  const r = Math.min(bw, bh) / 2 - 2;
  const rad = ((angle - 90) * Math.PI) / 180;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r}
              fill="#1e293b" stroke="#cbd5e1" strokeWidth="2" />
      <line
        x1={cx} y1={cy}
        x2={cx + r * 0.78 * Math.cos(rad)}
        y2={cy + r * 0.78 * Math.sin(rad)}
        stroke="#facc15" strokeWidth="3.5" strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="3" fill="#cbd5e1" />
      <text x={cx} y={cy + r * 0.55} textAnchor="middle"
            fill="#facc15" fontSize="9" fontWeight="700">
        {positions[idx]?.label ?? ''}
      </text>
    </g>
  );
}

function LoadBody({ bw, bh, def, data }: BodyProps) {
  const on = data.on !== false;
  const tint = str(def.specs.chromaticity, 'amber');
  const colors: Record<string, [string, string]> = {
    blue:   ['#bfdbfe', '#60a5fa'],
    red:    ['#fecaca', '#ef4444'],
    green:  ['#bbf7d0', '#22c55e'],
    white:  ['#f8fafc', '#e2e8f0'],
    amber:  ['#fde68a', '#f59e0b'],
  };
  const [bright, dim] = colors[tint] ?? colors.amber;
  const r = Math.min(bw, bh) * 0.42;
  return (
    <g>
      <rect x="0" y="0" width={bw} height={bh}
            rx={Math.min(bw, bh) * 0.5}
            fill="#1e293b" stroke="#475569" strokeWidth="1.2" />
      <circle cx={bw / 2} cy={bh / 2} r={r}
              fill={on ? bright : dim}
              filter={on ? 'drop-shadow(0 0 4px rgba(255,255,255,0.6))' : undefined} />
      {on && <circle cx={bw / 2} cy={bh / 2} r={r * 0.6} fill="white" fillOpacity="0.5" />}
    </g>
  );
}

function ConnectorBody({ bw, bh, def }: BodyProps) {
  const t = str(def.connectorType ?? def.specs.connectorType, 'buttSplice');
  if (t === 'ringLug') {
    // Ring lug: a ring at one end, crimp barrel at the other.
    const r = bh * 0.35;
    return (
      <g>
        {/* crimp barrel on left */}
        <rect x="0" y={bh * 0.35} width={bw * 0.45} height={bh * 0.30}
              fill="#cbd5e1" stroke="#475569" />
        {/* ring at right */}
        <circle cx={bw * 0.72} cy={bh * 0.5} r={r}
                fill="none" stroke="#cbd5e1" strokeWidth={r * 0.55} />
        <circle cx={bw * 0.72} cy={bh * 0.5} r={r * 0.40}
                fill="#0f172a" stroke="#475569" />
      </g>
    );
  }
  // Default butt splice / heatShrinkSolder: long thin tube
  return (
    <g>
      <rect x="0" y={bh * 0.30} width={bw} height={bh * 0.40}
            rx={bh * 0.18}
            fill={t === 'heatShrinkSolder' ? '#bfdbfe' : '#fde68a'}
            stroke="#475569" strokeWidth="1.2" />
      <rect x={bw * 0.45} y={bh * 0.30} width={bw * 0.10} height={bh * 0.40}
            fill="#facc15" stroke="#92400e" />
    </g>
  );
}

function BusbarBody({ bw, bh, def }: BodyProps) {
  const ports = def.ports.length;
  return (
    <g>
      <rect x="0" y={bh * 0.20} width={bw} height={bh * 0.60}
            rx="3" fill="#fbbf24" stroke="#92400e" strokeWidth="1.5" />
      {Array.from({ length: ports }).map((_, i) => {
        const cx = ((i + 0.5) / ports) * bw;
        return (
          <circle key={i} cx={cx} cy={bh * 0.5} r={Math.min(bw, bh) * 0.10}
                  fill="#475569" stroke="#1e293b" />
        );
      })}
    </g>
  );
}

function FuseBlockBody({ bw, bh, def }: BodyProps) {
  const slots = num(def.specs.slots, def.subComponents?.length ?? 6);
  const cols = slots <= 6 ? slots : 2;
  const rows = Math.ceil(slots / cols);
  return (
    <g>
      <rect x="0" y="0" width={bw} height={bh}
            rx="4" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
      {Array.from({ length: slots }).map((_, i) => {
        const c = cols === 2 ? Math.floor(i / rows) : i;
        const r = cols === 2 ? i % rows : 0;
        const w = bw * 0.7 / cols;
        const h = (bh * 0.8) / rows;
        const x = bw * 0.15 + c * w * 1.05;
        const y = bh * 0.10 + r * h * 1.05;
        return (
          <g key={i}>
            <rect x={x} y={y} width={w * 0.95} height={h * 0.85}
                  rx="2" fill="#facc15" stroke="#92400e" />
            <circle cx={x + w * 0.95 - 3} cy={y + 3} r="1.5" fill="#22c55e" />
          </g>
        );
      })}
    </g>
  );
}

function HarnessBody({ bw, bh, def }: BodyProps) {
  const colors = (def.harness?.pairs ?? []).map((p) => p.color || '#94a3b8');
  return (
    <g>
      {/* Multi-pin connector at left */}
      <rect x="0" y={bh * 0.20} width={bw * 0.18} height={bh * 0.60}
            rx="3" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
      {/* Wires fanning out to the right */}
      {colors.map((c, i) => {
        const t = (i + 0.5) / Math.max(colors.length, 1);
        const y = bh * (0.15 + t * 0.70);
        return (
          <line key={i} x1={bw * 0.18} y1={bh * 0.5}
                x2={bw} y2={y}
                stroke={c} strokeWidth="2" strokeLinecap="round" />
        );
      })}
    </g>
  );
}

function DcdcBody({ bw, bh, def }: BodyProps) {
  const vOut = num(def.specs.vOut, 5);
  return (
    <g>
      <rect x="0" y="0" width={bw} height={bh}
            rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
      {/* USB-A socket on right */}
      <rect x={bw * 0.55} y={bh * 0.30} width={bw * 0.40} height={bh * 0.40}
            rx="2" fill="#475569" stroke="#cbd5e1" />
      <text x={bw * 0.25} y={bh * 0.55} textAnchor="middle"
            fill="#facc15" fontSize="11" fontWeight="700">{vOut}V</text>
    </g>
  );
}

function IndicatorBody({ bw, bh }: BodyProps) {
  return (
    <g>
      <rect x="0" y="0" width={bw} height={bh}
            rx="3" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
      <rect x={bw * 0.10} y={bh * 0.20} width={bw * 0.80} height={bh * 0.60}
            rx="2" fill="#1f2937" stroke="#22c55e" />
      <text x={bw / 2} y={bh * 0.62} textAnchor="middle"
            fill="#22c55e" fontSize="11" fontWeight="700"
            fontFamily="ui-monospace, monospace">12.6</text>
    </g>
  );
}

function CompositeBody({ bw, bh, def, data }: BodyProps) {
  const subs = def.subComponents ?? [];
  const switches = subs.filter((s) => s.subKind === 'switch');
  const dcdcs = subs.filter((s) => s.subKind === 'dcdc');
  const indicators = subs.filter((s) => s.subKind === 'indicator');
  const fuses = subs.filter((s) => s.subKind === 'fuse');
  const subStates = (data as ComponentNodeData & { subStates?: Record<string, { on?: boolean }> })
    .subStates ?? {};

  // Marine rocker panel layout: top row = indicators + USB sockets (centered), bottom row = switches.
  if (switches.length >= 3) {
    const topItems = [...indicators, ...dcdcs];
    const topY = bh * 0.10;
    const topH = bh * 0.32;
    const swY = bh * 0.55;
    const swH = bh * 0.40;
    return (
      <g>
        {/* panel face */}
        <rect x="0" y="0" width={bw} height={bh}
              rx="6" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
        {/* mounting holes at corners */}
        {[[0.03, 0.05], [0.97, 0.05], [0.03, 0.95], [0.97, 0.95]].map(([fx, fy], i) => (
          <circle key={i} cx={bw * fx} cy={bh * fy} r={1.6}
                  fill="#475569" stroke="#94a3b8" strokeWidth="0.6" />
        ))}
        {/* top row: voltmeter + USB sockets */}
        {topItems.map((s, i) => {
          const slotW = (bw * 0.90) / Math.max(topItems.length, 1);
          const x = bw * 0.05 + i * slotW;
          if (s.subKind === 'indicator') {
            return (
              <g key={s.id}>
                <rect x={x + 4} y={topY} width={slotW - 8} height={topH}
                      rx="3" fill="#1f2937" stroke="#22c55e" />
                <text x={x + slotW / 2} y={topY + topH * 0.65} textAnchor="middle"
                      fill="#22c55e" fontSize={Math.min(topH * 0.55, 12)}
                      fontWeight="700"
                      fontFamily="ui-monospace, monospace">12.6</text>
              </g>
            );
          }
          // dcdc -> USB socket
          return (
            <g key={s.id}>
              <rect x={x + 4} y={topY} width={slotW - 8} height={topH}
                    rx="3" fill="#0f172a" stroke="#475569" />
              <rect x={x + slotW * 0.25} y={topY + topH * 0.30}
                    width={slotW * 0.50} height={topH * 0.40}
                    rx="1.5" fill="#475569" stroke="#cbd5e1" />
              <text x={x + slotW / 2} y={topY + topH * 0.95} textAnchor="middle"
                    fill="#94a3b8" fontSize="6">USB</text>
            </g>
          );
        })}
        {/* bottom row: rocker switches */}
        {switches.map((s, i) => {
          const slotW = (bw * 0.90) / switches.length;
          const x = bw * 0.05 + i * slotW;
          const on = subStates[s.id]?.on === true;
          return (
            <g key={s.id}>
              <rect x={x + 2} y={swY} width={slotW - 4} height={swH}
                    rx="3" fill="#1f2937" stroke="#475569" />
              <rect x={x + slotW * 0.25} y={swY + swH * 0.20}
                    width={slotW * 0.50} height={swH * 0.30}
                    rx="2"
                    fill={on ? '#3b82f6' : '#0f172a'}
                    stroke="#64748b" strokeWidth="0.6"
                    filter={on ? 'drop-shadow(0 0 3px #3b82f6)' : undefined} />
              <rect x={x + slotW * 0.25} y={swY + swH * 0.55}
                    width={slotW * 0.50} height={swH * 0.30}
                    rx="2" fill="#1e293b" stroke="#64748b" strokeWidth="0.6" />
            </g>
          );
        })}
      </g>
    );
  }

  // Generic composite (e.g. MRBF block kit): plain grid of sub-component glyphs.
  const items = [...switches, ...dcdcs, ...fuses, ...indicators];
  return (
    <g>
      <rect x="0" y="0" width={bw} height={bh}
            rx="6" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
      {items.slice(0, 12).map((s, i) => {
        const cols = Math.min(items.length, 4);
        const rows = Math.ceil(items.length / cols);
        const c = i % cols;
        const r = Math.floor(i / cols);
        const w = (bw * 0.9) / cols;
        const h = (bh * 0.7) / Math.max(rows, 1);
        const x = bw * 0.05 + c * w;
        const y = bh * 0.15 + r * h;
        const fill = s.subKind === 'switch' ? '#1f2937'
          : s.subKind === 'dcdc' ? '#475569'
          : s.subKind === 'fuse' ? '#fbbf24'
          : s.subKind === 'indicator' ? '#22c55e' : '#475569';
        return (
          <rect key={s.id} x={x + 1} y={y + 1} width={w - 2} height={h - 2}
                rx="2" fill={fill} stroke="#0f172a" strokeWidth="0.5" />
        );
      })}
    </g>
  );
}

function GenericBody({ bw, bh, def }: BodyProps) {
  return (
    <g>
      <rect x="0" y="0" width={bw} height={bh}
            rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
      <text x={bw / 2} y={bh * 0.55} textAnchor="middle"
            fill="#cbd5e1" fontSize="10" fontWeight="600">
        {def.kind}
      </text>
    </g>
  );
}

export function LookalikeBody(props: BodyProps) {
  const { def } = props;
  switch (def.kind) {
    case 'battery':        return <BatteryBody {...props} />;
    case 'fuse':           return <FuseBody {...props} />;
    case 'breaker':        return <FuseBody {...props} />;
    case 'switch':         return <SwitchBody {...props} />;
    case 'selectorSwitch': return <SelectorBody {...props} />;
    case 'load':           return <LoadBody {...props} />;
    case 'connector':      return <ConnectorBody {...props} />;
    case 'busbar':         return <BusbarBody {...props} />;
    case 'fuseBlock':      return <FuseBlockBody {...props} />;
    case 'harness':        return <HarnessBody {...props} />;
    case 'dcdc':           return <DcdcBody {...props} />;
    case 'indicator':      return <IndicatorBody {...props} />;
    case 'composite':      return <CompositeBody {...props} />;
    default:               return <GenericBody {...props} />;
  }
}

/** Geometry helper: from each port on the node perimeter, compute the start (body
 *  edge) of the stub line, in node-local pixel coords. The end of the stub is at
 *  the port's rel position scaled to the node size. */
export function stubLine(
  rel: { x: number; y: number },
  nodeW: number,
  nodeH: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const px = rel.x * nodeW;
  const py = rel.y * nodeH;
  const bx0 = STUB;
  const by0 = STUB;
  const bx1 = nodeW - STUB;
  const by1 = nodeH - STUB;
  const cx = nodeW / 2;
  const cy = nodeH / 2;
  // Decide which edge of the body the stub anchors on.
  const dx = px - cx;
  const dy = py - cy;
  if (Math.abs(dx) / Math.max(nodeW, 1) > Math.abs(dy) / Math.max(nodeH, 1)) {
    // Horizontal anchor (left or right edge of body)
    const sx = dx > 0 ? bx1 : bx0;
    const sy = clamp(py, by0, by1);
    return { x1: sx, y1: sy, x2: px, y2: py };
  }
  const sx = clamp(px, bx0, bx1);
  const sy = dy > 0 ? by1 : by0;
  return { x1: sx, y1: sy, x2: px, y2: py };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
