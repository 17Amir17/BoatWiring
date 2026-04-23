import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { useAppStore } from '../state/store';
import type { ComponentDef, ComponentNodeData, Port } from '../types';

type ComponentNodeType = Node<ComponentNodeData, 'component'>;

function pickPosition(rel: { x: number; y: number }): Position {
  if (rel.x <= 0.05) return Position.Left;
  if (rel.x >= 0.95) return Position.Right;
  if (rel.y <= 0.05) return Position.Top;
  return Position.Bottom;
}

function PortPin({ port, def }: { port: Port; def: ComponentDef }) {
  const pos = pickPosition(port.rel);
  const left = `${port.rel.x * 100}%`;
  const top = `${port.rel.y * 100}%`;
  const isPower = port.role === 'source' || port.label === '+';
  const isGround = port.role === 'sink' && (port.label === '-' || port.label.toLowerCase().includes('gnd'));
  return (
    <>
      <Handle
        id={port.id}
        type={isPower ? 'source' : 'target'}
        position={pos}
        style={{
          left,
          top,
          width: 10,
          height: 10,
          background: isPower ? '#facc15' : isGround ? '#1f2937' : '#94a3b8',
          border: '2px solid #0f1115',
          borderRadius: 6,
        }}
      />
      <span
        className="absolute text-[9px] text-slate-300 select-none pointer-events-none"
        style={{
          left,
          top,
          transform: pinLabelTransform(pos),
          whiteSpace: 'nowrap',
        }}
      >
        {port.label}
      </span>
      <span aria-hidden className="hidden">{def.id}</span>
    </>
  );
}

function pinLabelTransform(pos: Position): string {
  switch (pos) {
    case Position.Left:   return 'translate(8px, -50%)';
    case Position.Right:  return 'translate(calc(-100% - 8px), -50%)';
    case Position.Top:    return 'translate(-50%, 8px)';
    case Position.Bottom: return 'translate(-50%, calc(-100% - 8px))';
  }
}

function BatteryOverlay({ id }: { id: string }) {
  const soc = useAppStore((s) => s.engine.soc[id]);
  const v = useAppStore((s) => {
    const def = [...s.componentDefs.values()].find((d) => d.kind === 'battery');
    void def;
    // The actual terminal voltage is published per-port; just show SOC here.
    return soc;
  });
  void v;
  const pct = Math.round((soc ?? 1) * 100);
  return (
    <div className="absolute inset-x-1 bottom-1 h-2 rounded bg-slate-700 overflow-hidden">
      <div
        className="h-full"
        style={{
          width: `${pct}%`,
          background: pct > 50 ? '#22c55e' : pct > 20 ? '#facc15' : '#ef4444',
        }}
      />
      <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white drop-shadow">
        {pct}%
      </span>
    </div>
  );
}

function SwitchLever({ on }: { on: boolean }) {
  return (
    <div
      className={`absolute inset-x-2 top-1/2 -translate-y-1/2 h-3 rounded transition-colors ${
        on ? 'bg-emerald-400' : 'bg-slate-600'
      }`}
    >
      <div
        className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-slate-100 shadow transition-all ${
          on ? 'right-0' : 'left-0'
        }`}
      />
    </div>
  );
}

function SelectorIndicator({ pos, count }: { pos: number; count: number }) {
  const angle = (pos / Math.max(count - 1, 1)) * 270 - 135;
  return (
    <div className="absolute inset-2 rounded-full border-2 border-slate-600 flex items-center justify-center">
      <div
        className="absolute w-0.5 h-1/2 bg-yellow-400 origin-bottom"
        style={{ top: '5%', transform: `rotate(${angle}deg)` }}
      />
      <span className="text-[9px] text-yellow-200 font-mono">{pos}</span>
    </div>
  );
}

function FuseBody({ blown }: { blown: boolean }) {
  return (
    <div className={`absolute inset-2 rounded ${blown ? 'bg-red-900/40' : 'bg-amber-700/30'}`}>
      {blown && (
        <svg viewBox="0 0 20 20" className="absolute inset-0 w-full h-full text-red-500">
          <path d="M3 3 L17 17 M17 3 L3 17" stroke="currentColor" strokeWidth="2" />
        </svg>
      )}
    </div>
  );
}

function LoadBody({ on, glow }: { on: boolean; glow: number }) {
  // glow ∈ [0..1] — modulated by current/voltage
  return (
    <div
      className={`absolute inset-2 rounded-full ${on ? 'bg-amber-300' : 'bg-slate-700'}`}
      style={{
        boxShadow: on
          ? `0 0 ${4 + glow * 16}px ${glow * 6}px rgba(252,211,77,${0.4 + glow * 0.4})`
          : 'none',
        opacity: on ? 0.5 + glow * 0.5 : 1,
      }}
    />
  );
}

const ComponentNode = ({ id, data, selected }: NodeProps<ComponentNodeType>) => {
  const def = useAppStore((s) => s.componentDefs.get(data.defId));
  const toggleSwitch = useAppStore((s) => s.toggleSwitch);
  const setLoadOn = useAppStore((s) => s.setLoadOn);
  const setSelectorPosition = useAppStore((s) => s.setSelectorPosition);

  const portVoltages = useAppStore((s) => s.engine.nodeVoltages);
  const fuseOpen = useAppStore((s) => s.engine.fuseOpen[id]);

  if (!def) return <div className="w-8 h-8 bg-red-500/40">missing def</div>;

  const w = def.size.w;
  const h = def.size.h;

  // Compute glow: voltage at first port / 12V
  const v1 = portVoltages[`${id}/${def.ports[0]?.id}`] ?? 0;
  const v2 = portVoltages[`${id}/${def.ports[1]?.id}`] ?? 0;
  const dropV = Math.abs(v1 - v2);
  const glow = Math.min(1, dropV / 12);

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
      className={`relative bg-panel-bg border rounded-md shadow-md text-slate-200 ${
        selected ? 'border-yellow-400' : 'border-panel-border'
      }`}
      style={{ width: w, height: h }}
      onClick={onClick}
    >
      <div className="absolute inset-x-0 -top-5 text-[10px] text-slate-400 truncate text-center">
        {def.name}
      </div>

      {def.kind === 'battery' && <BatteryOverlay id={id} />}
      {def.kind === 'switch' && <SwitchLever on={data.on === true} />}
      {def.kind === 'selectorSwitch' && def.selector && (
        <SelectorIndicator
          pos={data.selectedPosition ?? def.selector.defaultPosition}
          count={def.selector.positions.length}
        />
      )}
      {(def.kind === 'fuse' || def.kind === 'breaker') && (
        <FuseBody blown={fuseOpen === true} />
      )}
      {def.kind === 'load' && <LoadBody on={data.on !== false} glow={glow} />}

      {(data.faults?.length ?? 0) > 0 && (
        <div className="absolute -top-2 -right-2 px-1 rounded bg-red-600 text-white text-[9px]">
          {data.faults.length}⚠
        </div>
      )}

      {def.ports.map((port) => (
        <PortPin key={port.id} port={port} def={def} />
      ))}
    </div>
  );
};

export default memo(ComponentNode);
