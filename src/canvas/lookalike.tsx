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
  onSubSwitchClick?: (subId: string) => void;
  /** Voltage at each port of THIS component, keyed by port id. Used to drive
   *  live overlays like the voltmeter inside a composite panel. */
  portVoltages?: Record<string, number>;
  /** Net current flowing OUT of each port of THIS component, keyed by port id.
   *  Positive = leaving the component (sourcing), negative = entering (sinking). */
  portCurrents?: Record<string, number>;
  /** Battery state-of-charge (0..1). Only meaningful for kind='battery'. */
  soc?: number;
}

function BatteryBody({ bw, bh, portVoltages, portCurrents, soc: socProp }: BodyProps) {
  const soc = typeof socProp === 'number' ? Math.max(0, Math.min(1, socProp)) : 1;
  const iPos = portCurrents?.['pos'] ?? 0;
  const sourcing = iPos > 0.05;
  const charging = iPos < -0.05;
  const ampsLabel = sourcing
    ? `${iPos.toFixed(1)} A out`
    : charging
      ? `${(-iPos).toFixed(1)} A in`
      : '0.0 A';
  const ampsColor = sourcing ? '#dc2626' : charging ? '#16a34a' : '#475569';
  const socColor = soc > 0.5 ? '#22c55e' : soc > 0.2 ? '#facc15' : '#ef4444';
  const vPos = portVoltages?.['pos'] ?? 0;
  const vNeg = portVoltages?.['neg'] ?? 0;
  const vTerminal = Math.max(0, vPos - vNeg);
  const barX = bw * 0.10;
  const barY = bh * 0.14;
  const barW = bw * 0.80;
  const barH = bh * 0.06;
  return (
    <g>
      {/* terminal posts on top */}
      <rect x={bw * 0.18} y="0" width={bw * 0.14} height={bh * 0.10} fill="#1e293b" stroke="#475569" />
      <rect x={bw * 0.68} y="0" width={bw * 0.14} height={bh * 0.10} fill="#dc2626" stroke="#7f1d1d" />
      {/* battery case */}
      <rect x="0" y={bh * 0.10} width={bw} height={bh * 0.90}
            rx="6" fill="#e2e8f0" stroke="#475569" strokeWidth="1.5" />
      {/* SoC bar */}
      <rect x={barX} y={barY} width={barW} height={barH}
            rx={barH * 0.4} fill="#1f2937" stroke="#475569" strokeWidth="0.6" />
      <rect x={barX + 1} y={barY + 1} width={Math.max(0, barW - 2) * soc} height={barH - 2}
            rx={(barH - 2) * 0.4} fill={socColor} />
      <text x={bw * 0.25} y={bh * 0.42} textAnchor="middle" fill="#1e293b" fontSize="10">−</text>
      <text x={bw * 0.75} y={bh * 0.42} textAnchor="middle" fill="#dc2626" fontSize="10">+</text>
      <text x={bw / 2} y={bh * 0.65} textAnchor="middle"
            fill="#0f172a" fontSize="11" fontWeight="600">{vTerminal.toFixed(1)} V</text>
      <text x={bw / 2} y={bh * 0.85} textAnchor="middle"
            fill={ampsColor} fontSize="10" fontWeight="700"
            fontFamily="ui-monospace, monospace">{ampsLabel}</text>
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

function isEnergized(
  def: ComponentDef,
  data: ComponentNodeData,
  portVoltages?: Record<string, number>,
  portCurrents?: Record<string, number>,
) {
  const on = data.on !== false;
  if (!on) return false;
  const vMin = num(def.specs.vMin, 8);
  const vIn = portVoltages?.['in'] ?? portVoltages?.['+'] ?? 0;
  const vOut = portVoltages?.['out'] ?? portVoltages?.['-'] ?? 0;
  const drop = Math.abs(vIn - vOut);
  // Match the solver's soft-brownout: load is "lit" once drop reaches the
  // bottom of the 1V brownout window (vMin - 1).
  if (drop < vMin - 1) return false;
  // Voltage alone isn't enough — a tiny load wired in series with a
  // brownout-opened high-vMin load gets the full source voltage but no
  // current. A real load wouldn't actually emit/run, so the visual must
  // reflect that. 5 mA threshold matches the inspector's near-zero rounding.
  const iIn  = Math.abs(portCurrents?.['in']  ?? portCurrents?.['+'] ?? 0);
  const iOut = Math.abs(portCurrents?.['out'] ?? portCurrents?.['-'] ?? 0);
  return Math.max(iIn, iOut) >= 0.005;
}

function GenericLoadBody({ bw, bh, def, data, portVoltages, portCurrents }: BodyProps) {
  // data.chromaticity (per-node override) wins over def.specs.chromaticity.
  const tint = str((data as { chromaticity?: unknown }).chromaticity, str(def.specs.chromaticity, 'amber'));
  const colors: Record<string, [string, string]> = {
    blue:   ['#3b82f6', '#1e3a8a'],
    red:    ['#ef4444', '#7f1d1d'],
    green:  ['#22c55e', '#14532d'],
    white:  ['#f8fafc', '#e2e8f0'],
    amber:  ['#fbbf24', '#92400e'],
  };
  const energized = isEnergized(def, data, portVoltages, portCurrents);
  const r = Math.min(bw, bh) * 0.42;
  const cx = bw / 2;
  const cy = bh / 2;

  // Bicolor port/starboard nav light: red half-disc on port (left),
  // green half-disc on starboard (right). Glows on both halves when energized.
  if (tint === 'redGreen') {
    const [redB, redD] = colors.red;
    const [grnB, grnD] = colors.green;
    return (
      <g>
        <rect x="0" y="0" width={bw} height={bh}
              rx={Math.min(bw, bh) * 0.5}
              fill="#1e293b" stroke="#475569" strokeWidth="1.2" />
        <path d={`M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} Z`}
              fill={energized ? redB : redD}
              filter={energized ? `drop-shadow(0 0 6px ${redB})` : undefined} />
        <path d={`M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} Z`}
              fill={energized ? grnB : grnD}
              filter={energized ? `drop-shadow(0 0 6px ${grnB})` : undefined} />
        <line x1={cx} y1={cy - r} x2={cx} y2={cy + r}
              stroke="#0f172a" strokeWidth="0.8" />
        {energized && (
          <text x={cx} y={bh - 3} textAnchor="middle"
                fill="#22c55e" fontSize={Math.max(7, bh * 0.15)}
                fontWeight="700" fontFamily="ui-sans-serif, system-ui">●</text>
        )}
      </g>
    );
  }

  const [bright, dim] = colors[tint] ?? colors.amber;
  return (
    <g>
      <rect x="0" y="0" width={bw} height={bh}
            rx={Math.min(bw, bh) * 0.5}
            fill="#1e293b" stroke="#475569" strokeWidth="1.2" />
      <circle cx={cx} cy={cy} r={r}
              fill={energized ? bright : dim}
              filter={energized
                ? `drop-shadow(0 0 8px ${bright}) drop-shadow(0 0 16px ${bright})`
                : undefined} />
      {energized && (
        <>
          <circle cx={cx} cy={cy} r={r * 0.55} fill="white" fillOpacity="0.7" />
          <circle cx={cx - r * 0.2} cy={cy - r * 0.2} r={r * 0.18}
                  fill="white" fillOpacity="0.95" />
        </>
      )}
      {energized && (
        <text x={bw / 2} y={bh - 3} textAnchor="middle"
              fill="#22c55e" fontSize={Math.max(7, bh * 0.15)}
              fontWeight="700" fontFamily="ui-sans-serif, system-ui">
          ●
        </text>
      )}
    </g>
  );
}

function UnderwaterLedBody({ bw, bh, def, data, portVoltages, portCurrents }: BodyProps) {
  const energized = isEnergized(def, data, portVoltages, portCurrents);
  const cx = bw / 2;
  const cy = bh / 2;
  const rOuter = Math.min(bw, bh) * 0.46;
  const rRing = rOuter * 0.86;
  const rLens = rOuter * 0.62;
  const rHot = rOuter * 0.18;
  const lensFill = energized ? '#3b82f6' : '#1e3a8a';
  return (
    <g filter={energized ? 'drop-shadow(0 0 6px #3b82f6) drop-shadow(0 0 14px #1d4ed8)' : undefined}>
      {/* chrome outer ring with subtle radial highlight */}
      <circle cx={cx} cy={cy} r={rOuter} fill="#cbd5e1" stroke="#475569" strokeWidth="1.2" />
      <circle cx={cx} cy={cy} r={rRing} fill="#94a3b8" stroke="#334155" strokeWidth="0.8" />
      <circle cx={cx - rOuter * 0.25} cy={cy - rOuter * 0.30} r={rOuter * 0.18}
              fill="#f1f5f9" fillOpacity="0.7" />
      {/* domed lens */}
      <circle cx={cx} cy={cy} r={rLens} fill={lensFill} stroke="#0f172a" strokeWidth="0.8" />
      {/* lens highlight crescent */}
      <ellipse cx={cx - rLens * 0.30} cy={cy - rLens * 0.32}
               rx={rLens * 0.32} ry={rLens * 0.18}
               fill="white" fillOpacity={energized ? 0.55 : 0.18} />
      {/* center LED */}
      <circle cx={cx} cy={cy} r={rHot}
              fill={energized ? '#ffffff' : '#0f172a'}
              opacity={energized ? 1 : 0.7} />
      {energized && (
        <circle cx={cx} cy={cy} r={rHot * 0.55} fill="#dbeafe" />
      )}
    </g>
  );
}

function HornBody({ bw, bh, def, data, portVoltages, portCurrents }: BodyProps) {
  const energized = isEnergized(def, data, portVoltages, portCurrents);
  const bracketW = bw * 0.12;
  const bracketH = bh * 0.50;
  const bracketY = (bh - bracketH) / 2;
  const coneX0 = bracketW;
  const coneX1 = bw * 0.78;
  const coneTopY0 = bh * 0.40;
  const coneBotY0 = bh * 0.60;
  const coneTopY1 = bh * 0.10;
  const coneBotY1 = bh * 0.90;
  const bellCx = bw * 0.82;
  const bellRy = bh * 0.42;
  const bellRx = bw * 0.06;
  const coneFill = energized ? '#fbbf24' : '#475569';
  const coneStroke = energized ? '#92400e' : '#1e293b';
  const bellFill = energized ? '#fde68a' : '#334155';
  return (
    <g>
      {/* mounting bracket */}
      <rect x={0} y={bracketY} width={bracketW} height={bracketH}
            rx="2" fill="#334155" stroke="#0f172a" strokeWidth="0.8" />
      <circle cx={bracketW * 0.5} cy={bracketY + 3} r={1.4} fill="#0f172a" />
      <circle cx={bracketW * 0.5} cy={bracketY + bracketH - 3} r={1.4} fill="#0f172a" />
      {/* trumpet cone */}
      <path
        d={`M ${coneX0} ${coneTopY0} L ${coneX1} ${coneTopY1} L ${coneX1} ${coneBotY1} L ${coneX0} ${coneBotY0} Z`}
        fill={coneFill}
        stroke={coneStroke}
        strokeWidth="1.2"
        filter={energized ? 'drop-shadow(0 0 5px #fbbf24)' : undefined}
      />
      {/* bell mouth (right end) */}
      <ellipse cx={bellCx} cy={bh / 2} rx={bellRx} ry={bellRy}
               fill={bellFill} stroke={coneStroke} strokeWidth="1.2" />
      <ellipse cx={bellCx + bellRx * 0.4} cy={bh / 2} rx={bellRx * 0.5} ry={bellRy * 0.7}
               fill="#0f172a" fillOpacity="0.35" />
      {/* sound waves */}
      {energized && (
        <g stroke="#f59e0b" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.9">
          <path d={`M ${bw * 0.90} ${bh * 0.30} Q ${bw * 0.96} ${bh * 0.50} ${bw * 0.90} ${bh * 0.70}`} />
          <path d={`M ${bw * 0.94} ${bh * 0.18} Q ${bw * 1.02} ${bh * 0.50} ${bw * 0.94} ${bh * 0.82}`} />
        </g>
      )}
    </g>
  );
}

function BilgePumpBody({ bw, bh, def, data, portVoltages, portCurrents }: BodyProps) {
  const energized = isEnergized(def, data, portVoltages, portCurrents);
  const bodyX = bw * 0.18;
  const bodyW = bw * 0.50;
  const bodyTopY = bh * 0.22;
  const bodyBotY = bh * 0.78;
  // when running, body tints teal-blue (water-cooled motor look) with a glow
  const bodyFill = energized ? '#0e7490' : '#475569';
  const stroke = '#0f172a';
  const dischargeX = bodyX + bodyW * 0.65;
  const dischargeTopY = bh * 0.04;
  const dischargeW = bw * 0.10;
  const outletCx = bw - 1;
  const outletCy = dischargeTopY + dischargeW / 2;
  const bodyCx = bodyX + bodyW / 2;
  const bodyCy = (bodyTopY + bodyBotY) / 2;
  const impellerR = bodyW * 0.30;

  return (
    <g>
      {/* strainer base (slotted intake) */}
      <rect x={bodyX - 2} y={bodyBotY} width={bodyW + 4} height={bh * 0.18}
            rx="3" fill="#1e293b" stroke={stroke} strokeWidth="1" />
      {Array.from({ length: 5 }).map((_, i) => {
        const x = bodyX + (i + 0.5) * (bodyW / 5);
        return (
          <line key={i} x1={x} y1={bodyBotY + bh * 0.04} x2={x} y2={bodyBotY + bh * 0.14}
                stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" />
        );
      })}
      {/* main cylindrical body — wraps in a vibrating <g> when running */}
      <g
        filter={energized ? 'drop-shadow(0 0 5px #22d3ee)' : undefined}
      >
        {energized && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0; 0.6,0; 0,0; -0.6,0; 0,0"
            dur="0.18s"
            repeatCount="indefinite"
          />
        )}
        <rect x={bodyX} y={bodyTopY} width={bodyW} height={bodyBotY - bodyTopY}
              rx={bodyW * 0.18} fill={bodyFill} stroke={stroke} strokeWidth="1.2" />
        <ellipse cx={bodyCx} cy={bodyTopY} rx={bodyW / 2} ry={bh * 0.06}
                 fill={energized ? '#22d3ee' : '#94a3b8'} stroke={stroke} strokeWidth="1" />
        {/* spinning impeller hint when running */}
        {energized && (
          <g transform={`translate(${bodyCx}, ${bodyCy})`}>
            <circle r={impellerR} fill="#0f172a" opacity="0.55" />
            <g>
              <line x1={-impellerR * 0.85} y1={0} x2={impellerR * 0.85} y2={0}
                    stroke="#67e8f9" strokeWidth="1.4" strokeLinecap="round" />
              <line x1={0} y1={-impellerR * 0.85} x2={0} y2={impellerR * 0.85}
                    stroke="#67e8f9" strokeWidth="1.4" strokeLinecap="round" />
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0" to="360"
                dur="0.45s"
                repeatCount="indefinite"
              />
            </g>
          </g>
        )}
      </g>
      {/* discharge stack */}
      <rect x={dischargeX} y={bh * 0.10} width={dischargeW} height={bodyTopY - bh * 0.10 + 2}
            fill="#94a3b8" stroke={stroke} strokeWidth="1" />
      <rect x={dischargeX} y={dischargeTopY} width={bw - dischargeX - 1} height={dischargeW}
            fill="#94a3b8" stroke={stroke} strokeWidth="1" />
      <rect x={bw - 4} y={dischargeTopY} width={3} height={dischargeW} fill="#0f172a" />
      {/* pigtail wire stub */}
      <path
        d={`M ${bodyX + bodyW * 0.20} ${bodyTopY} q -4 -8 -10 -10`}
        stroke="#1e293b" strokeWidth="1.4" fill="none" strokeLinecap="round"
      />
      {/* water spray + animated droplets out of the discharge */}
      {energized && (
        <g>
          {/* big animated arrow */}
          <path
            d={`M ${bw - 12} ${outletCy} l 10 -5 l 0 10 z`}
            fill="#3b82f6" stroke="#1e3a8a" strokeWidth="0.6"
          >
            <animate attributeName="opacity" values="1;0.4;1" dur="0.4s" repeatCount="indefinite" />
          </path>
          {/* three falling droplets, staggered phase */}
          {[
            { x: outletCx,     r: 2.2, dur: '0.55s', begin: '0s'   },
            { x: outletCx - 5, r: 1.8, dur: '0.55s', begin: '0.18s' },
            { x: outletCx + 4, r: 1.5, dur: '0.55s', begin: '0.36s' },
          ].map((d, i) => (
            <circle key={i} cx={d.x} cy={outletCy + 4} r={d.r}
                    fill="#3b82f6" opacity="0.85">
              <animate attributeName="cy"
                       values={`${outletCy + 4};${bh - 2}`}
                       dur={d.dur} begin={d.begin} repeatCount="indefinite" />
              <animate attributeName="opacity"
                       values="0.95;0.95;0"
                       dur={d.dur} begin={d.begin} repeatCount="indefinite" />
            </circle>
          ))}
          {/* "RUN" badge above the body so it's unmistakably ON */}
          <g transform={`translate(${bodyCx}, ${bh - 2})`}>
            <rect x={-12} y={-9} width={24} height={10}
                  rx={2} fill="#22d3ee" stroke="#0e7490" strokeWidth="0.6" />
            <text x={0} y={-1} textAnchor="middle"
                  fill="#0f172a" fontSize="7" fontWeight="800"
                  fontFamily="ui-sans-serif, system-ui">RUN</text>
          </g>
        </g>
      )}
    </g>
  );
}

function LoadBody(props: BodyProps) {
  const id = props.def.id;
  if (id === 'ae-underwater-led-blue-ip68-4pc') return <UnderwaterLedBody {...props} />;
  if (id === 'load-marine-horn')                return <HornBody {...props} />;
  if (id === 'load-bilge-pump')                 return <BilgePumpBody {...props} />;
  return <GenericLoadBody {...props} />;
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

function IndicatorBody({ bw, bh, def, portVoltages, portCurrents }: BodyProps) {
  const ports = def.ports;
  const meterType = str(def.specs.meterType, 'voltmeter');
  const isAmmeter = meterType === 'ammeter';
  let value: number;
  let lit: boolean;
  let unit: string;
  if (isAmmeter) {
    // Current magnitude through the meter — net current at port 0 (signs
    // cancel between in/out so |port0|).
    const i = Math.abs(portCurrents?.[ports[0]?.id] ?? 0);
    value = i;
    lit = i >= 0.01;
    unit = 'A';
  } else {
    const vPlus = portVoltages?.[ports[0]?.id] ?? 0;
    const vMinus = portVoltages?.[ports[1]?.id] ?? 0;
    value = Math.max(0, vPlus - vMinus);
    lit = value > 4;
    unit = 'V';
  }
  const display = lit ? value.toFixed(value < 10 ? 2 : 1) : '--.-';
  return (
    <g>
      <rect x="0" y="0" width={bw} height={bh}
            rx="3" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
      <rect x={bw * 0.10} y={bh * 0.20} width={bw * 0.80} height={bh * 0.60}
            rx="2" fill="#1f2937" stroke={lit ? '#22c55e' : '#475569'} />
      <text x={bw / 2} y={bh * 0.58} textAnchor="middle"
            fill={lit ? '#22c55e' : '#1f2937'}
            fontSize={Math.min(bh * 0.40, 16)} fontWeight="700"
            fontFamily="ui-monospace, monospace">{display}</text>
      <text x={bw / 2} y={bh * 0.92} textAnchor="middle"
            fill="#64748b" fontSize={Math.max(7, bh * 0.16)} fontWeight="700">
        DC {unit}
      </text>
    </g>
  );
}

function CompositeBody({ bw, bh, def, data, onSubSwitchClick, portVoltages }: BodyProps) {
  const subs = def.subComponents ?? [];
  const switches = subs.filter((s) => s.subKind === 'switch');
  const dcdcs = subs.filter((s) => s.subKind === 'dcdc');
  const indicators = subs.filter((s) => s.subKind === 'indicator');
  const fuses = subs.filter((s) => s.subKind === 'fuse');
  const subStates = (data as ComponentNodeData & { subStates?: Record<string, { on?: boolean }> })
    .subStates ?? {};
  void dcdcs;

  // Marine rocker panel layout: voltmeter LCD on top, rocker switches on bottom.
  // USB/cig converter electronics are internal — only their handles render on the
  // right edge of the node, no on-face boxes needed.
  if (switches.length >= 3) {
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
        {/* top: voltmeter LCD (centered, full width) */}
        {indicators.length > 0 && (() => {
          const vAcc = portVoltages?.['accIn+'] ?? portVoltages?.['in+'] ?? 0;
          const vNeg = portVoltages?.['in-'] ?? 0;
          const v = Math.max(0, vAcc - vNeg);
          const lit = v > 4;
          const w = bw * 0.40;
          const x = (bw - w) / 2;
          return (
            <g key="vm">
              <rect x={x} y={topY} width={w} height={topH}
                    rx="3" fill="#0a0a0a"
                    stroke={lit ? '#22c55e' : '#475569'} strokeWidth={lit ? 1.5 : 1} />
              <text x={bw / 2} y={topY + topH * 0.70} textAnchor="middle"
                    fill={lit ? '#22c55e' : '#1f2937'}
                    fontSize={Math.min(topH * 0.55, 16)}
                    fontWeight="700"
                    fontFamily="ui-monospace, monospace">
                {lit ? v.toFixed(1) : '--.-'}
              </text>
            </g>
          );
        })()}
        {/* bottom row: rocker switches — each clickable to toggle that gang */}
        {switches.map((s, i) => {
          const slotW = (bw * 0.90) / switches.length;
          const x = bw * 0.05 + i * slotW;
          const on = subStates[s.id]?.on === true;
          return (
            <g
              key={s.id}
              className="nodrag nopan"
              style={{ cursor: 'pointer', pointerEvents: 'auto' }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSubSwitchClick?.(s.id);
              }}
            >
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
              {/* invisible larger hit area for easier clicking */}
              <rect x={x + 2} y={swY} width={slotW - 4} height={swH}
                    fill="transparent" />
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
