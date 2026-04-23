import { memo } from 'react';
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

type WireEdgeType = Edge<WireData, 'wire'>;

function colorFor(currentA: number, ampacity: number): string {
  const ratio = Math.min(2, Math.abs(currentA) / Math.max(ampacity, 1));
  if (ratio < 0.05) return '#3a3f47';
  if (ratio < 0.5)  return '#22c55e';
  if (ratio < 0.85) return '#facc15';
  if (ratio < 1.0)  return '#f97316';
  return '#ef4444';
}

const WireEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<WireEdgeType>) => {
  const wireDef = useAppStore((s) =>
    data?.wireDefId ? s.wireDefs.get(data.wireDefId) : undefined,
  );
  const current = useAppStore((s) => s.engine.edgeCurrents[id] ?? 0);

  const ampacity = wireDef ? wireAmpacity(wireDef.gaugeAWG) : 22;
  const baseColor = wireDef?.insulationColor ?? '#94a3b8';
  const dynamicColor = colorFor(current, ampacity);
  const stroke = Math.abs(current) < 0.05 ? baseColor : dynamicColor;
  const strokeWidth = wireDef ? gaugeWidth(wireDef.gaugeAWG) : 2;
  const animActive = Math.abs(current) > 0.05;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    borderRadius: 6,
  });

  const flowDuration = animActive ? `${Math.max(0.2, 2 / Math.max(0.1, Math.abs(current)))}s` : '0s';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke,
          strokeWidth: selected ? strokeWidth + 2 : strokeWidth,
          opacity: 0.95,
        }}
        className={animActive ? 'wire-active' : ''}
      />
      <EdgeLabelRenderer>
        {selected && (
          <div
            className="absolute pointer-events-none px-1.5 py-0.5 rounded bg-panel-bg/90 border border-panel-border text-[10px] text-slate-200"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {Math.abs(current).toFixed(2)} A · {wireDef?.gaugeAWG ?? '?'} AWG
          </div>
        )}
      </EdgeLabelRenderer>
      <style>
        {animActive ? `[data-id="${id}"] { --flow-duration: ${flowDuration}; }` : ''}
      </style>
    </>
  );
};

function gaugeWidth(awg: number): number {
  if (awg <= 6) return 4;
  if (awg <= 10) return 3.2;
  if (awg <= 14) return 2.5;
  return 2;
}

export default memo(WireEdge);
