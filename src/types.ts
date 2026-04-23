export type ComponentKind =
  | 'battery'
  | 'busbar'
  | 'fuseBlock'
  | 'fuse'
  | 'breaker'
  | 'switch'
  | 'selectorSwitch'
  | 'composite'
  | 'harness'
  | 'connector'
  | 'dcdc'
  | 'indicator'
  | 'load'
  | 'accessory'
  | 'custom';

export type PortRole = 'source' | 'sink' | 'passthrough';

export interface Port {
  id: string;
  label: string;
  rel: { x: number; y: number };
  role: PortRole;
}

export interface SourceRef {
  platform: 'aliexpress' | 'manual';
  url: string;
  sku?: string;
  sellerTitle: string;
  seller?: string;
  priceUSD?: number;
  images: string[];
  fetchedAt: string;
}

export interface SubComponent {
  id: string;
  subKind: Exclude<ComponentKind, 'composite' | 'custom' | 'accessory'>;
  specs: Record<string, number | string>;
  label?: string;
}

export type InternalEndpoint =
  | { subId: string; portId: string }
  | { external: string };

export interface InternalWire {
  a: InternalEndpoint;
  b: InternalEndpoint;
  rOhm?: number;
}

export interface SelectorSpec {
  positions: {
    label: string;
    conduct: [string, string][];
  }[];
  defaultPosition: number;
}

export interface HarnessSpec {
  pairs: {
    inPortId: string;
    outPortId: string;
    gaugeAWG: number;
    lengthIn: number;
    color: string;
  }[];
}

export type ConnectorType =
  | 'ringLug'
  | 'buttSplice'
  | 'spade'
  | 'heatShrinkSolder'
  | 'fuseHolder'
  | 'mrbfLug';

export interface ComponentDef {
  id: string;
  kind: ComponentKind;
  name: string;
  imageRef?: string;
  size: { w: number; h: number };
  ports: Port[];
  specs: Record<string, number | string>;
  source?: SourceRef;
  qtyOwned?: number;
  subComponents?: SubComponent[];
  internalWiring?: InternalWire[];
  selector?: SelectorSpec;
  harness?: HarnessSpec;
  connectorType?: ConnectorType;
  wireGaugeRange?: [number, number];
  canAttachToWireEnd?: boolean;
}

export interface WireDef {
  id: string;
  name: string;
  gaugeAWG: number;
  maxAmps: number;
  insulationColor: string;
  source?: SourceRef;
}

export type Fault =
  | { kind: 'open' }
  | { kind: 'short'; rOhm: number }
  | { kind: 'water'; leakOhm: number }
  | { kind: 'voltageSag'; vOverride: number }
  | { kind: 'degraded'; factor: number };

export interface ComponentNodeData extends Record<string, unknown> {
  defId: string;
  on?: boolean;
  level?: number;
  selectedPosition?: number;
  faults: Fault[];
}

export interface WireData extends Record<string, unknown> {
  wireDefId: string;
  lengthFt: number;
  endATerminalDefId?: string;
  endBTerminalDefId?: string;
  faults?: Fault[];
}

export interface SimState {
  nodeVoltages: Record<string, number>;
  edgeCurrents: Record<string, number>;
  soc: Record<string, number>;
  fuseOpen: Record<string, boolean>;
  fuseI2T: Record<string, number>;
  tSec: number;
  timeScale: number;
  running: boolean;
}

export const GROUND_NODE = '__GND__';
