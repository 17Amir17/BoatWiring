import { useEffect } from 'react';
import { useAppStore } from './store';

/** 10 Hz simulation loop bound to the store's `running` flag. */
export function useSimLoop() {
  const running = useAppStore((s) => s.engine.running);
  const tick = useAppStore((s) => s.tick);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => tick(0.1), 100);
    return () => clearInterval(id);
  }, [running, tick]);
}
