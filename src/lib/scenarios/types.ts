import type { Fault } from '../../types';
import type { useAppStore } from '../../state/store';

export interface ScenarioContext {
  store: typeof useAppStore;
}

export interface ScriptStep {
  atSec: number;
  /** Pure function applied at the given sim-time. */
  apply: (ctx: ScenarioContext) => void;
}

export interface AssertSpec {
  atSec: number;
  label: string;
  /** Returns null on pass, error message on fail. */
  check: (ctx: ScenarioContext) => string | null;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  /** Snapshot of nodes/edges to seed the canvas (or migration from current). */
  setup: (ctx: ScenarioContext) => void;
  script: ScriptStep[];
  asserts: AssertSpec[];
  timeScale: number;
  durationSec: number;
}

export type FaultDescriptor =
  | { target: { kind: 'node' | 'edge'; id: string }; fault: Fault };
