import type { Scenario } from './types';

/** Simulate overnight at anchor: anchor light + bilge cycling. */
export const anchorOvernight: Scenario = {
  id: 'anchor-overnight',
  name: 'Anchor Overnight (10h compressed)',
  description:
    'Run typical overnight house loads (anchor light, bilge cycles) and watch SOC drain.',
  timeScale: 600, // 10 minutes wall = 100 hours sim
  durationSec: 36000,
  setup: ({ store }) => {
    store.setState((s) => ({
      nodes: s.nodes.map((n) => {
        const def = s.componentDefs.get(n.data.defId);
        if (!def) return n;
        // Switch on small loads (LED nav lights), keep big loads off.
        if (def.kind === 'load') {
          const on = (def.specs.wattsOn as number) <= 10;
          return { ...n, data: { ...n.data, on } };
        }
        return n;
      }),
    }));
  },
  script: [],
  asserts: [
    {
      atSec: 36000,
      label: 'SOC > 30% after 10h',
      check: ({ store }) => {
        const soc = store.getState().engine.soc;
        const min = Math.min(...Object.values(soc), 1);
        return min >= 0.3 ? null : `expected SOC ≥ 0.3, min was ${min.toFixed(2)}`;
      },
    },
  ],
};
