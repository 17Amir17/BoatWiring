import { useEffect, useRef } from 'react';
import { useAppStore } from './store';
import {
  loadLocal,
  saveLocal,
  type PersistedSchematic,
} from '../lib/storage/schematic';
import { loadComponentDefs } from '../lib/components/registry';

/** All ids loaded from disk (builtins + cart-imported customs). These come from
 *  JSON files via import.meta.glob and should always reflect the on-disk state —
 *  localStorage must NOT shadow them or edits to the JSON would silently no-op. */
const ON_DISK_IDS = new Set(loadComponentDefs().map((d) => d.id));

/**
 * Bidirectional persistence:
 *  - On mount, hydrate user-only state (nodes, edges, defaults) from localStorage.
 *    User-added defs (created in the in-app Component Editor) are restored here too,
 *    but ANY def whose id matches an on-disk JSON is skipped — the JSON wins.
 *  - On every change, debounce-save user-added defs and the schematic.
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
      for (const cd of saved.customDefs) {
        if (ON_DISK_IDS.has(cd.id)) continue; // never let saved state shadow JSON
        defs.set(cd.id, cd);
      }
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
        const customDefs = [...s.componentDefs.values()].filter(
          (d) => !ON_DISK_IDS.has(d.id),
        );
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
