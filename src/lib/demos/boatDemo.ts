import type { BoatNode, BoatEdge } from '../../state/store';

/**
 * Boat house DC system from sketch.txt.
 *
 * Each rocker switch on the 6-gang panel is a 10-pin VJD2-style switch with its
 * OWN positive IN pin — they are NOT factory-bridged inside the panel (that's
 * what the optional jumper harness does). So we feed every switch from a
 * separate fuse-box circuit.
 *
 *   Battery → MRBF 40A → 200A disconnect → fuse-box.in
 *   Battery NEG ───────────────────────────────────→ fuse-box.MAIN GND  (8 AWG black)
 *
 *   For circuits 1..6 (one per panel switch):
 *     fuse-box.outN → panel.ipN → (panel internal switch swN) → panel.swN+ → load LN
 *     load LN → panel.swN- → (panel internal in- bus) → fuse-box.gndN  (16 AWG black)
 *
 *   For the panel accessories (USB-A, USB-B, voltmeter, cig outlet) — one feed:
 *     fuse-box.out7 → panel.accIn+ ;  panel internal in- ↘ via fuse-box.gnd7
 *     USB phones plug into Ua/Ub; 12V inflator plugs into Cig
 *
 *   Always-on bilge:
 *     battery+ → 5A inline → float switch → bilge pump → fuse-box.gnd12
 */

const node = (
  id: string,
  defId: string,
  x: number,
  y: number,
  data: Partial<BoatNode['data']> = {},
): BoatNode => ({
  id,
  type: 'component',
  position: { x, y },
  data: { defId, faults: [], ...data },
});

const edge = (
  id: string,
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string,
  wireDefId: string,
  lengthFt: number,
): BoatEdge => ({
  id,
  type: 'wire',
  source,
  sourceHandle,
  target,
  targetHandle,
  data: { wireDefId, lengthFt },
});

export const BOAT_DEMO_NODES: BoatNode[] = [
  // --- Battery ---
  node('B1', 'battery-100ah-agm', 40, 380),

  // --- Always-on bilge branch (top row) ---
  node('IF1', 'fuse-atc-5a',          240, 80,  { on: true }),
  node('FSW', 'switch-spst-rocker',   420, 100, { on: true }),  // float switch closed = water present
  node('BPA', 'load-bilge-pump',      640, 60,  { on: true }),

  // --- Main feed: MRBF → disconnect → 12-way fuse box ---
  node('MRBF', 'fuse-mrbf-40a',                 240, 380),
  node('DISC', 'ae-battery-disconnect-3pos',    420, 360, { selectedPosition: 1 }), // BAT1
  node('FB',   'ae-fuse-box-12way-led',         640, 320),

  // --- 6-gang rocker panel: each switch is independently fed (ip1..ip6).
  //     Panel sub-switches start in different states for demonstration ---
  node('PANEL', 'ae-rocker-panel-6gang-usb-volt', 1100, 380, {
    subStates: { sw1: { on: true }, sw3: { on: true } },
  }),

  // --- 6 loads downstream of the 6 panel switches, spread across the canvas ---
  node('L1', 'load-nav-led',             1900,  100, { on: true }), // Nav red+green
  node('L2', 'load-nav-led',             1900,  280, { on: true }), // Anchor white
  node('L3', 'transom-led-blue-4pc',     1900,  460, { on: true }), // Blue underwater LEDs ×4
  node('L4', 'load-nav-led',             1900,  640, { on: true }), // Spreader light (proxy)
  node('L5', 'load-nav-led',             1900,  820, { on: true }), // Fish finder (proxy)
  node('L6', 'load-nav-led',             1900, 1000, { on: true }), // Horn (proxy)

  // --- Devices plugged into the panel's USB-A, USB-B, and cigarette outlets ---
  node('UA',  'load-usb-phone',     2200,  300, { on: true }),  // Phone on USB-A
  node('UB',  'load-usb-phone',     2200,  500, { on: true }),  // Phone on USB-B
  node('CIG', 'load-12v-air-pump',  2200,  720, { on: false }), // 12V inflator on cig outlet
];

const W_FEED_BIG = 'wire-8awg-red';      // battery → MRBF → disconnect → fuse box
const W_FEED_PANEL = 'wire-12awg-red';   // fuse-box.out → panel.ipN (per-switch feed) and accIn+
const W_FEED_LOAD = 'wire-16awg-red';    // panel.swN+ → load
const W_RETURN_BIG = 'wire-8awg-black';  // battery NEG → fuse-box MAIN GND
const W_RETURN_LOAD = 'wire-16awg-black';// load.out → panel.swN- (and panel.in- → fuse-box.gndN)

export const BOAT_DEMO_EDGES: BoatEdge[] = [
  // --- Always-on bilge: battery+ → 5A inline → float switch → bilge → fuse-box GND
  edge('e_b_if1',   'B1',  'pos', 'IF1', 'a',         W_FEED_LOAD,  1),
  edge('e_if1_fsw', 'IF1', 'b',   'FSW', 'in',        W_FEED_LOAD,  0.5),
  edge('e_fsw_bpa', 'FSW', 'out', 'BPA', 'in',        W_FEED_LOAD,  1),
  edge('e_bpa_gnd', 'BPA', 'out', 'FB',  'gnd12',     W_RETURN_LOAD,4),

  // --- Main feed: battery+ → MRBF → disconnect → fuse-box.in ---
  edge('e_b_mrbf',    'B1',   'pos', 'MRBF', 'a',   W_FEED_BIG, 0.5),
  edge('e_mrbf_disc', 'MRBF', 'b',   'DISC', 'in1', W_FEED_BIG, 1),
  edge('e_disc_fb',   'DISC', 'out', 'FB',   'in',  W_FEED_BIG, 2),

  // --- Battery NEG → fuse-box MAIN GND (8 AWG black) ---
  edge('e_b_gnd', 'B1', 'neg', 'FB', 'main_gnd', W_RETURN_BIG, 1.5),

  // --- 6 panel switches each individually fused via fuse-box.outN → panel.ipN ---
  edge('e_fb1_p', 'FB', 'out1', 'PANEL', 'ip1', W_FEED_PANEL, 2),
  edge('e_fb2_p', 'FB', 'out2', 'PANEL', 'ip2', W_FEED_PANEL, 2),
  edge('e_fb3_p', 'FB', 'out3', 'PANEL', 'ip3', W_FEED_PANEL, 2),
  edge('e_fb4_p', 'FB', 'out4', 'PANEL', 'ip4', W_FEED_PANEL, 2),
  edge('e_fb5_p', 'FB', 'out5', 'PANEL', 'ip5', W_FEED_PANEL, 2),
  edge('e_fb6_p', 'FB', 'out6', 'PANEL', 'ip6', W_FEED_PANEL, 2),

  // --- Panel sub-switch outputs feed loads; loads return DIRECTLY to the fuse
  //     box's per-circuit GND screws (NOT through the panel — the panel's only
  //     ground pin is for its internal LED illumination + accessory bus). ---
  edge('e_p1_l1', 'PANEL', 'sw1+', 'L1', 'in',  W_FEED_LOAD,   6),
  edge('e_l1_g',  'L1',    'out',  'FB', 'gnd1',W_RETURN_LOAD, 6),

  edge('e_p2_l2', 'PANEL', 'sw2+', 'L2', 'in',  W_FEED_LOAD,   6),
  edge('e_l2_g',  'L2',    'out',  'FB', 'gnd2',W_RETURN_LOAD, 6),

  edge('e_p3_l3', 'PANEL', 'sw3+', 'L3', 'in',  W_FEED_LOAD,   6),
  edge('e_l3_g',  'L3',    'out',  'FB', 'gnd3',W_RETURN_LOAD, 6),

  edge('e_p4_l4', 'PANEL', 'sw4+', 'L4', 'in',  W_FEED_LOAD,   6),
  edge('e_l4_g',  'L4',    'out',  'FB', 'gnd4',W_RETURN_LOAD, 6),

  edge('e_p5_l5', 'PANEL', 'sw5+', 'L5', 'in',  W_FEED_LOAD,   6),
  edge('e_l5_g',  'L5',    'out',  'FB', 'gnd5',W_RETURN_LOAD, 6),

  edge('e_p6_l6', 'PANEL', 'sw6+', 'L6', 'in',  W_FEED_LOAD,   6),
  edge('e_l6_g',  'L6',    'out',  'FB', 'gnd6',W_RETURN_LOAD, 6),

  // --- Panel's own accessory bus (USB chargers + voltmeter + cig outlet) on
  //     fuse-box circuit 7. The panel's GND pin (= switch-LED ground) ties to
  //     the same circuit's GND screw. ---
  edge('e_fb7_acc', 'FB',    'out7', 'PANEL', 'accIn+', W_FEED_PANEL,   2),
  edge('e_pn_g',    'PANEL', 'in-',  'FB',    'gnd7',   W_RETURN_LOAD,  3),

  // --- USB devices plugged into the panel's Ua / Ub sockets — the USB outputs
  //     ARE on the panel (the device plugs into the panel itself), so the
  //     return naturally goes back through the panel's USB- pin to its
  //     internal accessory bus. ---
  edge('e_ua_in',  'PANEL', 'usba+', 'UA', 'in',  W_FEED_LOAD,   2),
  edge('e_ua_out', 'UA',    'out',   'PANEL', 'usba-', W_RETURN_LOAD, 2),
  edge('e_ub_in',  'PANEL', 'usbb+', 'UB', 'in',  W_FEED_LOAD,   2),
  edge('e_ub_out', 'UB',    'out',   'PANEL', 'usbb-', W_RETURN_LOAD, 2),

  // --- 12V inflator plugged into the panel's cigarette outlet ---
  edge('e_cig_in',  'PANEL', 'cig+', 'CIG', 'in',  W_FEED_LOAD,   2),
  edge('e_cig_out', 'CIG',   'out',  'PANEL', 'cig-', W_RETURN_LOAD, 2),
];
