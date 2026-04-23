import { useState } from 'react';
import { useAppStore } from '../state/store';
import { SCENARIOS } from '../lib/scenarios';

export default function ScenarioPanel() {
  const running = useAppStore((s) => s.engine.running);
  const timeScale = useAppStore((s) => s.engine.timeScale);
  const startSim = useAppStore((s) => s.startSim);
  const stopSim = useAppStore((s) => s.stopSim);
  const setTimeScale = useAppStore((s) => s.setTimeScale);
  const resetSim = useAppStore((s) => s.resetSim);
  const [results, setResults] = useState<{ label: string; pass: boolean; msg?: string }[] | null>(null);

  const runScenario = (id: string) => {
    const sc = SCENARIOS.find((s) => s.id === id);
    if (!sc) return;
    sc.setup({ store: useAppStore });
    useAppStore.setState((s) => ({
      engine: { ...s.engine, running: true, timeScale: sc.timeScale },
    }));
    for (const step of sc.script) {
      setTimeout(() => step.apply({ store: useAppStore }), (step.atSec / sc.timeScale) * 1000);
    }
    const live: { label: string; pass: boolean; msg?: string }[] = [];
    for (const a of sc.asserts) {
      setTimeout(() => {
        const err = a.check({ store: useAppStore });
        live.push({ label: a.label, pass: err === null, msg: err ?? undefined });
        setResults([...live]);
      }, (a.atSec / sc.timeScale) * 1000);
    }
    setTimeout(
      () =>
        useAppStore.setState((s) => ({
          engine: { ...s.engine, running: false },
        })),
      (sc.durationSec / sc.timeScale) * 1000,
    );
  };

  return (
    <div className="flex items-center gap-3 px-4 h-9 bg-panel-bg border-b border-panel-border text-xs">
      <button
        className={`px-3 py-0.5 rounded ${
          running ? 'bg-red-700/60 hover:bg-red-700/80' : 'bg-emerald-700/60 hover:bg-emerald-700/80'
        }`}
        onClick={() => (running ? stopSim() : startSim())}
      >
        {running ? '■ stop' : '▶ run'}
      </button>
      <button
        className="px-2 py-0.5 rounded bg-panel-hover hover:bg-slate-700/40"
        onClick={resetSim}
      >
        ⟲ reset
      </button>
      <div className="flex items-center gap-1">
        <span className="text-slate-500">speed</span>
        {[1, 10, 60, 600].map((n) => (
          <button
            key={n}
            className={`px-2 py-0.5 rounded text-[11px] ${
              timeScale === n ? 'bg-yellow-600/40 text-yellow-100' : 'bg-panel-hover hover:bg-slate-700/40'
            }`}
            onClick={() => setTimeScale(n)}
          >
            {n}×
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 ml-4">
        <span className="text-slate-500">scenario</span>
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            title={s.description}
            className="px-2 py-0.5 rounded bg-panel-hover hover:bg-slate-700/40 text-[11px]"
            onClick={() => runScenario(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>
      {results && (
        <div className="ml-4 flex items-center gap-2">
          {results.map((r, i) => (
            <span
              key={i}
              className={r.pass ? 'text-emerald-400' : 'text-red-400'}
              title={r.msg}
            >
              {r.pass ? '✓' : '✗'} {r.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
