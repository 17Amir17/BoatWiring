/** DC resistance of solid copper at ~20°C, ohms per foot. */
const OHMS_PER_FOOT: Record<number, number> = {
  4: 0.000292,
  6: 0.000465,
  8: 0.000739,
  10: 0.00118,
  12: 0.00187,
  14: 0.00297,
  16: 0.00472,
  18: 0.00750,
  20: 0.0119,
  22: 0.0189,
};

/** Marine-rated ampacity (single conductor, 105°C insulation, engine-room temp). */
const AMPACITY: Record<number, number> = {
  4: 130,
  6: 100,
  8: 70,
  10: 55,
  12: 40,
  14: 30,
  16: 22,
  18: 16,
  20: 11,
  22: 7,
};

export function wireResistance(gaugeAWG: number, lengthFt: number): number {
  const ohmsPerFt = OHMS_PER_FOOT[gaugeAWG] ?? 0.005;
  return ohmsPerFt * Math.max(lengthFt, 0.01);
}

export function wireAmpacity(gaugeAWG: number): number {
  return AMPACITY[gaugeAWG] ?? 10;
}
