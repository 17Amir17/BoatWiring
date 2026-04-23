import type { ComponentDef } from '../../../types';

const battery100Ah: ComponentDef = {
  id: 'battery-100ah-agm',
  kind: 'battery',
  name: '100Ah AGM',
  size: { w: 100, h: 70 },
  ports: [
    { id: 'pos', label: '+', rel: { x: 0.85, y: 0.2 }, role: 'source' },
    { id: 'neg', label: '-', rel: { x: 0.15, y: 0.2 }, role: 'sink' },
  ],
  specs: { capacityAh: 100, vNominal: 12.7, rInternalOhm: 0.012, chemistry: 'AGM' },
};

const busbar4: ComponentDef = {
  id: 'busbar-4post',
  kind: 'busbar',
  name: '4-post bus bar',
  size: { w: 120, h: 30 },
  ports: [
    { id: 'p1', label: '1', rel: { x: 0.1, y: 0.5 }, role: 'passthrough' },
    { id: 'p2', label: '2', rel: { x: 0.37, y: 0.5 }, role: 'passthrough' },
    { id: 'p3', label: '3', rel: { x: 0.63, y: 0.5 }, role: 'passthrough' },
    { id: 'p4', label: '4', rel: { x: 0.9, y: 0.5 }, role: 'passthrough' },
  ],
  specs: { ratedA: 250 },
};

const fuseATC: (ratingA: number) => ComponentDef = (a) => ({
  id: `fuse-atc-${a}a`,
  kind: 'fuse',
  name: `ATC ${a}A`,
  size: { w: 30, h: 22 },
  ports: [
    { id: 'a', label: 'A', rel: { x: 0.5, y: 0.05 }, role: 'passthrough' },
    { id: 'b', label: 'B', rel: { x: 0.5, y: 0.95 }, role: 'passthrough' },
  ],
  specs: { ratingA: a, formFactor: 'ATC', voltageRating: 32 },
});

const fuseMRBF40: ComponentDef = {
  id: 'fuse-mrbf-40a',
  kind: 'fuse',
  name: 'MRBF 40A',
  size: { w: 50, h: 30 },
  ports: [
    { id: 'a', label: 'A', rel: { x: 0.1, y: 0.5 }, role: 'passthrough' },
    { id: 'b', label: 'B', rel: { x: 0.9, y: 0.5 }, role: 'passthrough' },
  ],
  specs: { ratingA: 40, formFactor: 'MRBF', voltageRating: 58 },
};

const switchSPST: ComponentDef = {
  id: 'switch-spst-rocker',
  kind: 'switch',
  name: 'Rocker SPST',
  size: { w: 60, h: 40 },
  ports: [
    { id: 'in', label: 'IN', rel: { x: 0.1, y: 0.5 }, role: 'passthrough' },
    { id: 'out', label: 'OUT', rel: { x: 0.9, y: 0.5 }, role: 'passthrough' },
  ],
  specs: { ratedA: 20, ratedV: 12 },
};

const selectorBatteryDisconnect: ComponentDef = {
  id: 'selector-1-2-both-off',
  kind: 'selectorSwitch',
  name: 'Battery Disconnect 1-2-BOTH-OFF',
  size: { w: 80, h: 80 },
  ports: [
    { id: 'in1', label: 'IN1', rel: { x: 0.1, y: 0.25 }, role: 'passthrough' },
    { id: 'in2', label: 'IN2', rel: { x: 0.1, y: 0.75 }, role: 'passthrough' },
    { id: 'out', label: 'OUT', rel: { x: 0.9, y: 0.5 }, role: 'passthrough' },
  ],
  specs: { ratedA: 200, peakA: 600 },
  selector: {
    defaultPosition: 0,
    positions: [
      { label: 'OFF', conduct: [] },
      { label: 'BAT1', conduct: [['in1', 'out']] },
      { label: 'BAT2', conduct: [['in2', 'out']] },
      { label: 'BOTH', conduct: [['in1', 'out'], ['in2', 'out'], ['in1', 'in2']] },
    ],
  },
};

const navLight: ComponentDef = {
  id: 'load-nav-led',
  kind: 'load',
  name: 'Nav LED 6W',
  size: { w: 50, h: 50 },
  ports: [
    { id: 'in', label: '+', rel: { x: 0.1, y: 0.5 }, role: 'sink' },
    { id: 'out', label: '-', rel: { x: 0.9, y: 0.5 }, role: 'sink' },
  ],
  specs: { wattsOn: 6, vMin: 10, vMax: 30, inrushA: 0.2 },
};

const bilgePump: ComponentDef = {
  id: 'load-bilge-pump',
  kind: 'load',
  name: 'Bilge Pump 30W',
  size: { w: 60, h: 60 },
  ports: [
    { id: 'in', label: '+', rel: { x: 0.1, y: 0.5 }, role: 'sink' },
    { id: 'out', label: '-', rel: { x: 0.9, y: 0.5 }, role: 'sink' },
  ],
  specs: { wattsOn: 30, vMin: 10, vMax: 14, inrushA: 5 },
};

const ringLug: ComponentDef = {
  id: 'connector-ring-1/4',
  kind: 'connector',
  name: 'Ring Lug 16AWG / 1/4"',
  size: { w: 20, h: 14 },
  ports: [
    { id: 'wire', label: 'wire', rel: { x: 0.1, y: 0.5 }, role: 'passthrough' },
    { id: 'stud', label: 'stud', rel: { x: 0.9, y: 0.5 }, role: 'passthrough' },
  ],
  specs: { ratedA: 22, gaugeAWG: 16, studDiameterIn: 0.25 },
  connectorType: 'ringLug',
  wireGaugeRange: [16, 14],
  canAttachToWireEnd: true,
};

const buttSplice: ComponentDef = {
  id: 'connector-butt-splice-16-14',
  kind: 'connector',
  name: 'Heat-Shrink Butt Splice 16-14AWG',
  size: { w: 30, h: 12 },
  ports: [
    { id: 'a', label: 'A', rel: { x: 0.05, y: 0.5 }, role: 'passthrough' },
    { id: 'b', label: 'B', rel: { x: 0.95, y: 0.5 }, role: 'passthrough' },
  ],
  specs: { ratedA: 22, gaugeAWG: 16 },
  connectorType: 'buttSplice',
  wireGaugeRange: [16, 14],
  canAttachToWireEnd: false,
};

const usbCharger: ComponentDef = {
  id: 'dcdc-usb-2.1a',
  kind: 'dcdc',
  name: 'USB-A 5V 2.1A',
  size: { w: 30, h: 30 },
  ports: [
    { id: 'IN+', label: 'IN+', rel: { x: 0, y: 0.25 }, role: 'sink' },
    { id: 'IN-', label: 'IN-', rel: { x: 0, y: 0.75 }, role: 'sink' },
    { id: 'OUT+', label: 'USB+', rel: { x: 1, y: 0.25 }, role: 'source' },
    { id: 'OUT-', label: 'USB-', rel: { x: 1, y: 0.75 }, role: 'sink' },
  ],
  specs: { vIn: 12, vOut: 5, iLimitA: 2.1, eff: 0.85 },
};

const voltmeter: ComponentDef = {
  id: 'indicator-voltmeter',
  kind: 'indicator',
  name: 'LED Voltmeter',
  size: { w: 30, h: 18 },
  ports: [
    { id: '+', label: '+', rel: { x: 0.1, y: 0.5 }, role: 'sink' },
    { id: '-', label: '-', rel: { x: 0.9, y: 0.5 }, role: 'sink' },
  ],
  specs: { vRange: '6-30' },
};

export const BUILTIN_DEFS: ComponentDef[] = [
  battery100Ah,
  busbar4,
  fuseATC(5),
  fuseATC(10),
  fuseATC(15),
  fuseATC(20),
  fuseATC(25),
  fuseATC(30),
  fuseMRBF40,
  switchSPST,
  selectorBatteryDisconnect,
  navLight,
  bilgePump,
  ringLug,
  buttSplice,
  usbCharger,
  voltmeter,
];
