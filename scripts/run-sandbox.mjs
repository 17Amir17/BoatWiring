#!/usr/bin/env node
/**
 * Headless sandbox runner.
 *
 * Usage:
 *   node scripts/run-sandbox.mjs <defJsonPath> <fixtureJsonPath>
 *
 * defJsonPath:     a ComponentDef JSON (e.g. src/lib/components/custom/<slug>.json)
 * fixtureJsonPath: a SandboxScenario JSON with optional "expect" assertions:
 *
 *   {
 *     "drive":   [{ "portId": "out", "source": { "kind": "voltage", "v": 12 } }],
 *     "state":   { "on": true, "selectedPosition": 1, "faults": [] },
 *     "soc":     1.0,
 *     "fuseOpen":{ "F1": false },
 *     "expect": {
 *        "voltages": { "out":  { "min": 11.5, "max": 12.5 } },
 *        "currents": { "out":  { "min":  0.4, "max":  0.6, "negate": false } }
 *     }
 *   }
 *
 * Exit codes: 0 pass, 1 expectation failure, 2 invalid input.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Run via `tsx scripts/run-sandbox.mjs` (or `npm run sandbox -- ...`) so the
// dynamic import below can resolve TypeScript source directly.

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node scripts/run-sandbox.mjs <defJson> <fixtureJson>');
  process.exit(2);
}
const [defPath, fixturePath] = args;

let def, fixture;
try {
  def = JSON.parse(readFileSync(resolve(defPath), 'utf8'));
} catch (e) {
  console.error(`Failed to read def: ${e.message}`);
  process.exit(2);
}
try {
  fixture = JSON.parse(readFileSync(resolve(fixturePath), 'utf8'));
} catch (e) {
  console.error(`Failed to read fixture: ${e.message}`);
  process.exit(2);
}

const { runSandbox } = await import('../src/lib/sim/sandbox.ts');

const result = runSandbox(def, {
  drive: fixture.drive ?? [],
  state: fixture.state,
  soc: fixture.soc,
  fuseOpen: fixture.fuseOpen,
  subStates: fixture.subStates,
  probes: fixture.probes,
});

console.log(`def=${def.id} kind=${def.kind} converged=${result.converged}`);
console.log('voltages:');
for (const [port, v] of Object.entries(result.voltages)) {
  console.log(`  ${port}: ${v.toFixed(4)} V`);
}
console.log('drive currents:');
for (const [port, i] of Object.entries(result.driveCurrents)) {
  console.log(`  ${port}: ${i.toFixed(4)} A`);
}

let failed = 0;
const exp = fixture.expect ?? {};
const checkRange = (label, actual, range) => {
  const a = actual ?? Number.NaN;
  if (Number.isNaN(a) || a < range.min || a > range.max) {
    console.error(`FAIL ${label}: ${a} not in [${range.min}, ${range.max}]`);
    failed++;
  }
};
for (const [port, range] of Object.entries(exp.voltages ?? {})) {
  checkRange(`V[${port}]`, result.voltages[port], range);
}
for (const [port, range] of Object.entries(exp.currents ?? {})) {
  let v = result.driveCurrents[port] ?? Number.NaN;
  if (range.negate) v = -v;
  checkRange(`I[${port}]`, v, range);
}

if (failed > 0) {
  console.error(`${failed} expectation(s) failed`);
  process.exit(1);
}
console.log('OK');
process.exit(0);
