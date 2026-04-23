// Fault application is integrated directly into stamping.ts (applyFaultToR
// for components, "water" leak resistors added per-port). This file exposes
// helpers for defining/clearing faults from the UI.

import type { Fault } from '../../types';

export const FAULT_PRESETS: { label: string; build: () => Fault }[] = [
  { label: 'Open (broken)', build: () => ({ kind: 'open' }) },
  { label: 'Dead short', build: () => ({ kind: 'short', rOhm: 0.01 }) },
  { label: 'Water intrusion', build: () => ({ kind: 'water', leakOhm: 50 }) },
  { label: 'Battery sag → 10.5V', build: () => ({ kind: 'voltageSag', vOverride: 10.5 }) },
  { label: 'Degraded ×1.5 draw', build: () => ({ kind: 'degraded', factor: 1.5 }) },
];
