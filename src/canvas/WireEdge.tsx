import { memo, useContext } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import { useAppStore } from '../state/store';
import type { WireData } from '../types';
import { wireAmpacity } from '../lib/sim/awg';
import { EdgeRoutesContext } from './EdgeRoutesContext';

type WireEdgeType = Edge<WireData, 'wire'>;

function colorFor(currentA: number, ampacity: number, base: string): string {
  const ratio = Math.min(2, Math.abs(currentA) / Math.max(ampacity, 1));
  if (ratio < 0.02) return mute(base);
  if (ratio < 0.5)  return brighten(base);
  if (ratio < 0.85) return '#eab308';
  if (ratio < 1.0)  return '#ea580c';
  return '#dc2626';
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
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

const WireEdge = ({
  id,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition, targetPosition,
  data,
  selected,
}: EdgeProps<WireEdgeType>) => {
  const wireDef = useAppStore((s) =>
    data?.wireDefId ? s.wireDefs.get(data.wireDefId) : undefined,
  );
  const current = useAppStore((s) => s.engine.edgeCurrents[id] ?? 0);
  const route = useContext(EdgeRoutesContext).get(id);

  const ampacity = wireDef ? wireAmpacity(wireDef.gaugeAWG) : 22;
  const baseColor = wireDef?.insulationColor ?? '#94a3b8';
  const stroke = colorFor(current, ampacity, baseColor);
  const baseWidth = wireDef ? gaugeWidth(wireDef.gaugeAWG) : 2;
  const animActive = Math.abs(current) > 0.02;
  const strokeWidth = animActive ? baseWidth + 1 : baseWidth;

  let edgePath: string;
  let labelX: number;
  let labelY: number;
  if (route && route.d) {
    edgePath = route.d;
    labelX = route.labelX;
    labelY = route.labelY;
  } else {
    const [d, lx, ly] = getSmoothStepPath({
      sourceX, sourceY, targetX, targetY,
      sourcePosition, targetPosition, borderRadius: 6,
    });
    edgePath = d; labelX = lx; labelY = ly;
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke,
          strokeWidth: selected ? strokeWidth + 2 : strokeWidth,
          opacity: 1,
        }}
      />
      {selected && (
        <EdgeLabelRenderer>
          <div
            className="absolute pointer-events-none px-1.5 py-0.5 rounded bg-white/95 border border-slate-300 text-[10px] text-slate-700 shadow-sm"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {Math.abs(current).toFixed(2)} A · {wireDef?.gaugeAWG ?? '?'} AWG
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default memo(WireEdge);
