import type { Scenario } from './types';

export const everythingOn: Scenario = {
  id: 'everything-on',
  name: 'Everything On',
  description:
    'Turn every load on. Watch which fuse blows first when totals exceed wiring/fuse limits.',
  timeScale: 10,
  durationSec: 60,
  setup: ({ store }) => {
    // Turn on every switch + load.
    store.setState((s) => ({
      nodes: s.nodes.map((n) => {
        const def = s.componentDefs.get(n.data.defId);
        if (!def) return n;
        if (def.kind === 'switch' || def.kind === 'load') {
          return { ...n, data: { ...n.data, on: true } };
        }
        return n;
      }),
    }));
  },
  script: [],
  asserts: [
    {
      atSec: 30,
      label: 'no fuse blew within 30s',
      check: ({ store }) => {
        const fo = store.getState().engine.fuseOpen;
        const blown = Object.entries(fo).filter(([, b]) => b);
        return blown.length === 0
          ? null
          : `expected no blown fuses, found: ${blown.map(([k]) => k).join(', ')}`;
      },
    },
  ],
};
