import type { WireDef } from '../../types';

export const BUILTIN_WIRES: WireDef[] = [
  // Reds (positive feeds)
  { id: 'wire-4awg-red',  name: '4 AWG Red',  gaugeAWG: 4,  maxAmps: 130, insulationColor: '#dc2626' },
  { id: 'wire-6awg-red',  name: '6 AWG Red',  gaugeAWG: 6,  maxAmps: 100, insulationColor: '#dc2626' },
  { id: 'wire-8awg-red',  name: '8 AWG Red',  gaugeAWG: 8,  maxAmps: 70,  insulationColor: '#dc2626' },
  { id: 'wire-10awg-red', name: '10 AWG Red', gaugeAWG: 10, maxAmps: 55,  insulationColor: '#dc2626' },
  { id: 'wire-12awg-red', name: '12 AWG Red', gaugeAWG: 12, maxAmps: 40,  insulationColor: '#dc2626' },
  { id: 'wire-14awg-red', name: '14 AWG Red', gaugeAWG: 14, maxAmps: 30,  insulationColor: '#dc2626' },
  { id: 'wire-16awg-red', name: '16 AWG Red', gaugeAWG: 16, maxAmps: 22,  insulationColor: '#dc2626' },
  { id: 'wire-18awg-red', name: '18 AWG Red', gaugeAWG: 18, maxAmps: 16,  insulationColor: '#dc2626' },
  // Blacks (negative returns / grounds)
  { id: 'wire-4awg-black',  name: '4 AWG Black',  gaugeAWG: 4,  maxAmps: 130, insulationColor: '#0b0b0b' },
  { id: 'wire-6awg-black',  name: '6 AWG Black',  gaugeAWG: 6,  maxAmps: 100, insulationColor: '#0b0b0b' },
  { id: 'wire-8awg-black',  name: '8 AWG Black',  gaugeAWG: 8,  maxAmps: 70,  insulationColor: '#0b0b0b' },
  { id: 'wire-10awg-black', name: '10 AWG Black', gaugeAWG: 10, maxAmps: 55,  insulationColor: '#0b0b0b' },
  { id: 'wire-12awg-black', name: '12 AWG Black', gaugeAWG: 12, maxAmps: 40,  insulationColor: '#0b0b0b' },
  { id: 'wire-14awg-black', name: '14 AWG Black', gaugeAWG: 14, maxAmps: 30,  insulationColor: '#0b0b0b' },
  { id: 'wire-16awg-black', name: '16 AWG Black', gaugeAWG: 16, maxAmps: 22,  insulationColor: '#0b0b0b' },
  { id: 'wire-18awg-black', name: '18 AWG Black', gaugeAWG: 18, maxAmps: 16,  insulationColor: '#0b0b0b' },
];
