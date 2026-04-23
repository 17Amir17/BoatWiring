import { useEffect, useRef } from 'react';
import { useAppStore } from './store';
import {
  loadLocal,
  saveLocal,
  type PersistedSchematic,
} from '../lib/storage/schematic';
import { BUILTIN_DEFS } from '../lib/components/builtins';

const BUILTIN_IDS = new Set(BUILTIN_DEFS.map((d) => d.id));

/**
 * Bidirectional persistence:
 *  - On mount, load from localStorage and hydrate the store.
 *  - On every change to nodes/edges/customDefs, debounce-save the schematic.
 */
export function usePersistence() {
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const saved = loadLocal();
    if (!saved) return;
    useAppStore.setState((s) => {
      const defs = new Map(s.componentDefs);
      for (const cd of saved.customDefs) defs.set(cd.id, cd);
      return {
        componentDefs: defs,
        nodes: saved.nodes,
        edges: saved.edges,
        defaultWireDefId: saved.defaultWireDefId,
        defaultWireLengthFt: saved.defaultWireLengthFt,
      };
    });
  }, []);

  useEffect(() => {
    let h: number | undefined;
    const unsub = useAppStore.subscribe((s) => {
      window.clearTimeout(h);
      h = window.setTimeout(() => {
        const customDefs = [...s.componentDefs.values()].filter((d) => !BUILTIN_IDS.has(d.id));
        const payload: PersistedSchematic = {
          version: 1,
          customDefs,
          nodes: s.nodes,
          edges: s.edges,
          defaultWireDefId: s.defaultWireDefId,
          defaultWireLengthFt: s.defaultWireLengthFt,
        };
        saveLocal(payload);
      }, 500);
    });
    return () => {
      unsub();
      window.clearTimeout(h);
    };
  }, []);
}
