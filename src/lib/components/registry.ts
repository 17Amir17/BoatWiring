import type { ComponentDef, WireDef } from '../../types';
import { BUILTIN_DEFS } from './builtins';
import { BUILTIN_WIRES } from '../wires/builtins';

// Auto-load every JSON in custom/. Vite resolves these at build time.
const customDefs = import.meta.glob<{ default: ComponentDef }>('./custom/*.json', { eager: true });
const importedWires = import.meta.glob<{ default: WireDef }>('../wires/imported/*.json', {
  eager: true,
});

export function loadComponentDefs(): ComponentDef[] {
  const out: ComponentDef[] = [...BUILTIN_DEFS];
  for (const mod of Object.values(customDefs)) {
    out.push(mod.default);
  }
  return out;
}

export function loadWireDefs(): WireDef[] {
  const out: WireDef[] = [...BUILTIN_WIRES];
  for (const mod of Object.values(importedWires)) {
    out.push(mod.default);
  }
  return out;
}
