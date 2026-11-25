// Port operational-risk score (Dashboard 3 — Port Weather & Operational Risk).
//
// Pure, deterministic, documented (linked from Methodology). The score blends
// four measurable inputs into a 0–100 gauge value:
//
//   base            = weather_risk (0–100)        // wind, wave, swell combined
//   visibility      = visibility penalty (0–30)   // fog / heavy rain
//   congestion      = port congestion (0–30)      // queue + waiting vessels
//   holiday         = holiday risk (0 or 15)      // public holiday in country
//
// Final = clamp(base + visibility + congestion + holiday, 0, 100).
//
// Each input is itself a documented sub-formula; inputs are clamped at the
// boundary so callers cannot overshoot. Pure → fully unit-tested.

import { score as congestionScore, type PortVessel } from './congestion';

export interface WeatherInputs {
  /** Mean wind speed over the port area, in knots (10-minute average). */
  windKnots: number;
  /** Significant wave height, in metres. */
  waveM: number;
  /** Primary swell height, in metres (0 if none reported). */
  swellM: number;
}

export interface RiskInputs extends WeatherInputs {
  /** Visibility in kilometres; < 1 km is fog. */
  visibilityKm: number;
  /** Vessels at the port (queue + status), used for congestion. */
  vessels: ReadonlyArray<PortVessel>;
  /** True when a public holiday is observed in the port's country today. */
  isHoliday: boolean;
}

/** Weather-risk sub-score: weighted sum of wind, wave, swell, each capped. */
export function weatherRisk(input: WeatherInputs): number {
  const wind = clamp(Math.round(input.windKnots * 2), 0, 50); // 25 kt → 50 pts
  const wave = clamp(Math.round(input.waveM * 15), 0, 30);    // 2.0 m → 30 pts
  const swell = clamp(Math.round(input.swellM * 5), 0, 20);   // 4.0 m → 20 pts
  return clamp(wind + wave + swell, 0, 100);
}

/** Visibility penalty: 30 in fog (< 1 km), 0 above 10 km, linear in between. */
export function visibilityPenalty(km: number): number {
  if (!Number.isFinite(km) || km <= 0) return 30;
  if (km < 1) return 30; // fog
  if (km >= 10) return 0;
  // Linear from just-under-30 (at 1 km) to 0 (at 10 km).
  return Math.round(30 - (km / 10) * 30);
}

/** Holiday bump: 15 when a public holiday is observed today, else 0. */
export function holidayBump(isHoliday: boolean): number {
  return isHoliday ? 15 : 0;
}

/** Congestion contribution to operational risk (capped at 30). */
export function congestionContribution(vessels: ReadonlyArray<PortVessel>): number {
  const full = congestionScore(vessels); // 0–100
  // Compress the 0–100 congestion score into 0–30 risk points.
  return Math.round((full / 100) * 30);
}

/**
 * Combined operational-risk score for a port, 0–100. Pure.
 *
 * Threshold convention (rendered as the gauge colour):
 *   < 34   low (green)
 *   34–66  medium (amber)
 *   > 66   high (red)
 */
export function operationalRisk(input: RiskInputs): number {
  const weather = weatherRisk(input);
  const vis = visibilityPenalty(input.visibilityKm);
  const cong = congestionContribution(input.vessels);
  const hol = holidayBump(input.isHoliday);
  return clamp(weather + vis + cong + hol, 0, 100);
}

/** Bucket label for a 0–100 score, matching the gauge colour thresholds. */
export function riskBucket(score: number): 'low' | 'medium' | 'high' {
  if (score < 34) return 'low';
  if (score <= 66) return 'medium';
  return 'high';
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
