// VGM (Verified Gross Mass) Method 2 — SOLAS regulation VI/2.
// Method 2: VGM = tare + (cargo + packing + dunnage). Here `cargo` carries the
// combined cargo + packing + dunnage weight, as in the production UI.

import type { VgmResult } from './types';

/** Compute the Method 2 VGM from tare and combined cargo weight. */
export function computeMethod2(tare: number, cargo: number): number {
  return tare + cargo;
}

/**
 * Check a computed VGM against the container's limits. Returns warning strings
 * (empty array = within limits). Checks max gross (VGM) and max payload (cargo).
 */
export function checkLimits(
  vgm: number,
  cargo: number,
  maxGross: number,
  maxPayload: number,
): string[] {
  const w: string[] = [];
  if (vgm > maxGross) w.push(`VGM (${vgm}) exceeds max gross mass (${maxGross}).`);
  if (cargo > maxPayload) w.push(`Cargo (${cargo}) exceeds max payload (${maxPayload}).`);
  return w;
}

/** Combined Method 2 computation + limit check. */
export function evaluate(
  tare: number,
  cargo: number,
  maxGross: number,
  maxPayload: number,
): VgmResult {
  const vgm = computeMethod2(tare, cargo);
  const warnings = checkLimits(vgm, cargo, maxGross, maxPayload);
  return { tare, cargo, vgm, within: warnings.length === 0, warnings };
}
