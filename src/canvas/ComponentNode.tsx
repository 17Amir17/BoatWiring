import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { useAppStore } from '../state/store';
import type { ComponentNodeData, Port } from '../types';
import { LookalikeBody, STUB, stubLine } from './lookalike';

type ComponentNodeType = Node<ComponentNodeData, 'component'>;

function pickHandlePosition(rel: { x: number; y: number }): Position {
  // Decide which edge of the node a handle anchors on, based on which edge it's nearest.
  const dl = rel.x;
  const dr = 1 - rel.x;
  const dt = rel.y;
  const db = 1 - rel.y;
  const min = Math.min(dl, dr, dt, db);
  if (min === dl) return Position.Left;
  if (min === dr) return Position.Right;
  if (min === dt) return Position.Top;
  return Position.Bottom;
}

function labelOffset(pos: Position): React.CSSProperties {
  switch (pos) {
    case Position.Left:   return { left: 14, top: 0, transform: 'translateY(-50%)' };
    case Position.Right:  return { right: 14, top: 0, transform: 'translateY(-50%)' };
    case Position.Top:    return { left: 0, top: 14, transform: 'translateX(-50%)' };
    case Position.Bottom: return { left: 0, bottom: 14, transform: 'translateX(-50%)' };
  }
}

function PortPin({
  port, w, h,
}: {
  port: Port;
  w: number;
  h: number;
}) {
  const pos = pickHandlePosition(port.rel);
  const px = port.rel.x * w;
  const py = port.rel.y * h;
  const isPower = port.role === 'source' || port.label === '+';
  const isGround = port.role === 'sink' && (port.label === '-' || port.label.toLowerCase().includes('gnd'));
  const dotColor = isPower ? '#facc15' : isGround ? '#0f172a' : '#cbd5e1';
  return (
    <>
      <Handle
        id={port.id}
        type={isPower ? 'source' : 'target'}
        position={pos}
        style={{
          left: px,
          top: py,
          width: 11,
          height: 11,
          background: dotColor,
          border: '2px solid #ffffff',
          borderRadius: 8,
          boxShadow: '0 0 0 1px rgba(15,23,42,0.6)',
          transform: 'translate(-50%, -50%)',
        }}
      />
      <span
        className="absolute pointer-events-none text-[9px] font-semibold text-slate-700 select-none"
        style={{
          left: px,
          top: py,
          ...labelOffsetFor(pos, px, py),
          textShadow: '0 0 3px #ffffff, 0 0 5px #ffffff',
          whiteSpace: 'nowrap',
        }}
      >
        {port.label}
      </span>
    </>
  );
}

void labelOffset;

function labelOffsetFor(pos: Position, px: number, py: number): React.CSSProperties {
  void px; void py;
  // Anchor the label OUTSIDE the body, just past the pin.
  switch (pos) {
    case Position.Left:   return { transform: 'translate(10px, -50%)' };
    case Position.Right:  return { transform: 'translate(calc(-100% - 10px), -50%)' };
    case Position.Top:    return { transform: 'translate(-50%, 10px)' };
    case Position.Bottom: return { transform: 'translate(-50%, calc(-100% - 10px))' };
  }
}

const ComponentNode = ({ id, data, selected }: NodeProps<ComponentNodeType>) => {
  const def = useAppStore((s) => s.componentDefs.get(data.defId));
  const toggleSwitch = useAppStore((s) => s.toggleSwitch);
  const setLoadOn = useAppStore((s) => s.setLoadOn);
  const setSelectorPosition = useAppStore((s) => s.setSelectorPosition);
  const fuseOpen = useAppStore((s) => s.engine.fuseOpen[id]);

  if (!def) return <div className="w-8 h-8 bg-red-500/40">missing def</div>;

  const w = def.size.w;
  const h = def.size.h;
  const bw = Math.max(w - 2 * STUB, 4);
  const bh = Math.max(h - 2 * STUB, 4);

  const onClick = () => {
    if (def.kind === 'switch') toggleSwitch(id);
    if (def.kind === 'load') setLoadOn(id, !data.on);
    if (def.kind === 'selectorSwitch' && def.selector) {
      const next = ((data.selectedPosition ?? def.selector.defaultPosition) + 1)
        % def.selector.positions.length;
      setSelectorPosition(id, next);
    }
  };

  return (
    <div
      className="relative"
      style={{ width: w, height: h }}
      onClick={onClick}
    >
      {/* Component name above the body (well outside, so pin labels don't collide) */}
      <div
        className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] text-slate-700 font-semibold pointer-events-none whitespace-nowrap select-none"
        style={{ textShadow: '0 0 3px #ffffff' }}
      >
        {def.name.length > 28 ? def.name.slice(0, 26) + '…' : def.name}
      </div>

      {/* SVG layer: body + stub lines. Body is INSET by STUB on every side. */}
      <svg
        width={w}
        height={h}
        className="absolute inset-0 pointer-events-none overflow-visible"
      >
        {/* selection / fault outline */}
        <rect
          x={STUB - 2} y={STUB - 2}
          width={bw + 4} height={bh + 4}
          rx="6"
          fill="none"
          stroke={selected ? '#facc15' : 'transparent'}
          strokeWidth="2"
          strokeDasharray={selected ? undefined : '3 3'}
        />
        {/* per-port stub lines, drawn first so the body covers their inner ends */}
        {def.ports.map((p) => {
          const ln = stubLine(p.rel, w, h);
          return (
            <line
              key={p.id + '-stub'}
              x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2}
              stroke="#475569" strokeWidth="1.6" strokeLinecap="round"
            />
          );
        })}
        {/* body (inset) */}
        <g transform={`translate(${STUB}, ${STUB})`}>
          <LookalikeBody def={def} data={data} bw={bw} bh={bh} fuseBlown={fuseOpen === true} />
        </g>
      </svg>

      {/* Fault badge */}
      {(data.faults?.length ?? 0) > 0 && (
        <div className="absolute -top-2 -right-2 px-1 rounded bg-red-600 text-white text-[9px] z-10">
          {data.faults.length}⚠
        </div>
      )}

      {/* Pin handles + labels overlay the SVG */}
      {def.ports.map((port) => (
        <PortPin key={port.id} port={port} w={w} h={h} />
      ))}
    </div>
  );
};

export default memo(ComponentNode);
