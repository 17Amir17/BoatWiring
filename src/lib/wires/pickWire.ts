import type { ComponentDef, WireDef } from '../../types';

/**
 * Estimate the steady-state current a wire connecting these two components
 * should be sized for. Returns 0 if neither component constrains it (e.g. two
 * busbars), in which case callers should fall back to the user's default.
 */
export function expectedCurrentBetween(
  a: ComponentDef | undefined,
  b: ComponentDef | undefined,
): number {
  return Math.max(currentForOne(a), currentForOne(b));
}

function currentForOne(def: ComponentDef | undefined): number {
  if (!def) return 0;
  const s = def.specs;
  const num = (v: unknown) => (typeof v === 'number' ? v : 0);
  switch (def.kind) {
    case 'load': {
      const watts = num(s.wattsOn);
      return watts > 0 ? watts / 12 : 0;
    }
    case 'fuse':
    case 'breaker':
      return num(s.ratingA);
    case 'switch':
      return num(s.ratedA);
    case 'selectorSwitch':
      return num(s.ratedA);
    case 'battery':
      // Battery alone doesn't dictate gauge — use a conservative house-load default.
      return 30;
    case 'fuseBlock':
      return num(s.ratedA) || 30;
    case 'dcdc':
      return num(s.iLimitA);
    default:
      return 0;
  }
}

/**
 * Pick the smallest wire whose ampacity ≥ 1.5× the target current. Falls back
 * to the user's previously-chosen default if nothing in the registry fits.
 */
export function pickWireForCurrent(
  wireDefs: Map<string, WireDef>,
  targetA: number,
  fallbackId: string,
): string {
  if (targetA <= 0) return fallbackId;
  const margin = targetA * 1.5;
  // Sort wires by ampacity ascending and pick the first that meets the margin.
  const sorted = [...wireDefs.values()].sort((x, y) => x.maxAmps - y.maxAmps);
  for (const w of sorted) {
    if (w.maxAmps >= margin) return w.id;
  }
  // Nothing big enough — return the largest available (it'll still over-current,
  // but at least it's the closest match).
  return sorted[sorted.length - 1]?.id ?? fallbackId;
}
