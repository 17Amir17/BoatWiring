import type { Scenario } from './types';

/** Engine crank: brief huge current pulse. We model by injecting a voltage sag fault
 *  on the cranking battery and verifying bus voltage stays above 9V. */
export const engineCrank: Scenario = {
  id: 'engine-crank',
  name: 'Engine Crank',
  description:
    'Simulate a 2-second cranking event by sagging the battery to 10.5V. Verify lights survive.',
  timeScale: 1,
  durationSec: 5,
  setup: () => {},
  script: [
    {
      atSec: 1,
      apply: ({ store }) => {
        const s = store.getState();
        const bat = s.nodes.find((n) => s.componentDefs.get(n.data.defId)?.kind === 'battery');
        if (!bat) return;
        s.injectFault({ kind: 'node', id: bat.id }, { kind: 'voltageSag', vOverride: 10.5 });
      },
    },
    {
      atSec: 3,
      apply: ({ store }) => {
        const s = store.getState();
        const bat = s.nodes.find((n) => s.componentDefs.get(n.data.defId)?.kind === 'battery');
        if (!bat) return;
        s.clearFaults({ kind: 'node', id: bat.id });
      },
    },
  ],
  asserts: [
    {
      atSec: 2,
      label: 'bus stays above 9V during crank',
      check: ({ store }) => {
        const v = Object.values(store.getState().engine.nodeVoltages);
        const peakV = Math.max(...v.filter((x) => x > 0), 0);
        return peakV >= 9 ? null : `bus dropped to ${peakV.toFixed(2)}V`;
      },
    },
  ],
};
