import { useAppStore } from '../state/store';

export default function GaugeStrip() {
  const soc = useAppStore((s) => s.engine.soc);
  const nodeVoltages = useAppStore((s) => s.engine.nodeVoltages);
  const edgeCurrents = useAppStore((s) => s.engine.edgeCurrents);
  const tSec = useAppStore((s) => s.engine.tSec);

  const battEntries = Object.entries(soc);
  const avgSoc = battEntries.length
    ? battEntries.reduce((a, [, v]) => a + v, 0) / battEntries.length
    : 1;

  // Bus voltage proxy: average voltage of all positive-side ports.
  const vs = Object.entries(nodeVoltages).filter(([k, v]) => k.endsWith('/pos') && v > 6);
  const busV = vs.length ? vs.reduce((a, [, v]) => a + v, 0) / vs.length : 0;

  const totalAmps = Object.values(edgeCurrents).reduce(
    (a, v) => a + Math.abs(v),
    0,
  );

  return (
    <div className="flex items-center gap-6 px-4 h-9 bg-panel-bg border-b border-panel-border text-xs">
      <Stat label="Bus" value={`${busV.toFixed(2)} V`} />
      <Stat label="Σ |I|" value={`${totalAmps.toFixed(2)} A`} />
      <Stat label="SOC" value={`${(avgSoc * 100).toFixed(0)} %`} />
      <Stat label="t" value={fmtTime(tSec)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-[10px] text-slate-500">{label}</span>
      <span className="font-mono text-slate-200">{value}</span>
    </div>
  );
}

function fmtTime(s: number): string {
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const r = (s - m * 60).toFixed(0);
  if (m < 60) return `${m}m${r}s`;
  const h = Math.floor(m / 60);
  return `${h}h${m - h * 60}m`;
}
