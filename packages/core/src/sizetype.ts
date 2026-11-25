// ISO 6346 container size/type code decoder (Annex A length & height codes,
// Annex C type codes) + ISO 668 series-1 nominal specs. Pure lookup, offline,
// no network — the free tier always has it.
//
// The size/type code is the 4-character block after the owner code on a
// container (e.g. CSQU305438 / 22G1 → 20-ft, 8'6", general-purpose, one door).
//   - char 1 : length code        (2 = 20 ft, 4 = 40 ft, L = 45 ft, M = 48 ft)
//   - char 2 : height code        (2 = 8'6", 5 = 9'6" high-cube, ...)
//   - chars 3-4 : type code        (G0/G1 general, R0..R9 reefer, T0..T9 tank, ...)
//
// The length/height/type tables below cover the codes that account for the
// overwhelming majority of containers in service. Exotic or retired codes
// decode to "unknown" rather than a guess — the honesty rule: missing means
// missing.

import type { ContainerSpec } from './types';

export interface SizeTypeResult {
  input: string;
  normalized: string;
  valid: boolean;
  lengthFt: number | null;
  lengthLabel: string;
  heightLabel: string;
  typeCode: string;
  typeGroup: string;
  typeLabel: string;
  category: 'dry' | 'reefer' | 'tank' | 'open-top' | 'flat' | 'special' | 'unknown';
  errors: string[];
}

/** ISO 6346 Annex A — length code → feet. */
export const LENGTH_CODES: Readonly<Record<string, { ft: number; label: string }>> = Object.freeze({
  '2': { ft: 20, label: '20 ft' },
  '4': { ft: 40, label: '40 ft' },
  L: { ft: 45, label: '45 ft' },
  M: { ft: 48, label: '48 ft' },
  P: { ft: 53, label: '53 ft' },
});

/** ISO 6346 Annex A — height code → description. */
export const HEIGHT_CODES: Readonly<Record<string, string>> = Object.freeze({
  '0': '< 8 ft',
  '2': "8 ft 6 in (standard)",
  '4': '9 ft',
  '5': '9 ft 6 in (high-cube)',
  '6': '> 9 ft 6 in',
});

export type SizeTypeCategory = SizeTypeResult['category'];

interface TypeMeta {
  group: string;
  label: string;
  category: SizeTypeCategory;
}

/** ISO 6346 Annex C — type group prefix → category. */
export const TYPE_GROUPS: Readonly<Record<string, { group: string; category: SizeTypeCategory }>> =
  Object.freeze({
    G: { group: 'General purpose (closed)', category: 'dry' },
    V: { group: 'Ventilated (closed)', category: 'dry' },
    R: { group: 'Thermal / reefer', category: 'reefer' },
    H: { group: 'Heated', category: 'reefer' },
    T: { group: 'Tank', category: 'tank' },
    U: { group: 'Open-top', category: 'open-top' },
    P: { group: 'Flat / platform', category: 'flat' },
    S: { group: 'Named cargo (grain, etc.)', category: 'special' },
    A: { group: 'Air/surface (specialized)', category: 'special' },
  });

/** ISO 6346 Annex C — the most common full 2-char type codes with descriptions. */
export const TYPE_CODES: Readonly<Record<string, TypeMeta>> = Object.freeze({
  // General purpose
  G0: { group: 'General purpose (closed)', label: 'General purpose, no vents', category: 'dry' },
  G1: { group: 'General purpose (closed)', label: 'General purpose, with vents', category: 'dry' },
  G2: { group: 'General purpose (closed)', label: 'General purpose, human-rated (living quarters)', category: 'dry' },
  G3: { group: 'General purpose (closed)', label: 'General purpose, side doors', category: 'dry' },
  // Ventilated
  V0: { group: 'Ventilated (closed)', label: 'Ventilated, passive', category: 'dry' },
  V2: { group: 'Ventilated (closed)', label: 'Ventilated, mechanical', category: 'dry' },
  V4: { group: 'Ventilated (closed)', label: 'Ventilated, with side doors', category: 'dry' },
  // Thermal / reefer
  R0: { group: 'Thermal / reefer', label: 'Refrigerated/heated, mechanically', category: 'reefer' },
  R1: { group: 'Thermal / reefer', label: 'Refrigerated, mechanically (ventilated)', category: 'reefer' },
  R2: { group: 'Thermal / reefer', label: 'Refrigerated, mechanically (with vents)', category: 'reefer' },
  R3: { group: 'Thermal / reefer', label: 'Refrigerated, mechanically (CA/MA)', category: 'reefer' },
  R5: { group: 'Thermal / reefer', label: 'Insulated', category: 'reefer' },
  R7: { group: 'Thermal / reefer', label: 'Ventilated insulated', category: 'reefer' },
  R8: { group: 'Thermal / reefer', label: 'Refrigerated, expendable refrigerant', category: 'reefer' },
  R9: { group: 'Thermal / reefer', label: 'Other thermal', category: 'reefer' },
  // Tank
  T0: { group: 'Tank', label: 'Tank for liquids (non-dangerous)', category: 'tank' },
  T1: { group: 'Tank', label: 'Tank for liquids (dangerous)', category: 'tank' },
  T2: { group: 'Tank', label: 'Tank for gases (non-dangerous)', category: 'tank' },
  T3: { group: 'Tank', label: 'Tank for gases (dangerous)', category: 'tank' },
  T4: { group: 'Tank', label: 'Tank for solids (pressurized)', category: 'tank' },
  T5: { group: 'Tank', label: 'Tank for solids (non-pressurized)', category: 'tank' },
  T6: { group: 'Tank', label: 'Tank for solids (dangerous, pressurized)', category: 'tank' },
  T7: { group: 'Tank', label: 'Tank for solids (dangerous, non-pressurized)', category: 'tank' },
  T8: { group: 'Tank', label: 'Tank for liquids/gases (test ≥ 266 kPa)', category: 'tank' },
  T9: { group: 'Tank', label: 'Other tank', category: 'tank' },
  // Open-top
  U0: { group: 'Open-top', label: 'Open-top, no doors (tarpaulin cover)', category: 'open-top' },
  U1: { group: 'Open-top', label: 'Open-top, one door (tarpaulin cover)', category: 'open-top' },
  U2: { group: 'Open-top', label: 'Open-top, two doors (tarpaulin cover)', category: 'open-top' },
  U3: { group: 'Open-top', label: 'Open-top, no doors (solid cover)', category: 'open-top' },
  U4: { group: 'Open-top', label: 'Open-top, one door (solid cover)', category: 'open-top' },
  U5: { group: 'Open-top', label: 'Open-top, two doors (solid cover)', category: 'open-top' },
  U6: { group: 'Open-top', label: 'Open-top, side doors (tarpaulin)', category: 'open-top' },
  U9: { group: 'Open-top', label: 'Other open-top', category: 'open-top' },
  // Flat / platform
  P0: { group: 'Flat / platform', label: 'Flat, no ends/sides, no posts', category: 'flat' },
  P1: { group: 'Flat / platform', label: 'Flat, fixed ends, no posts', category: 'flat' },
  P2: { group: 'Flat / platform', label: 'Flat, fixed ends, fixed posts', category: 'flat' },
  P3: { group: 'Flat / platform', label: 'Flat, folding', category: 'flat' },
  P9: { group: 'Flat / platform', label: 'Other flat', category: 'flat' },
  // Named cargo
  S0: { group: 'Named cargo (grain, etc.)', label: 'Closed, for grain', category: 'special' },
  S1: { group: 'Named cargo (grain, etc.)', label: 'Closed, hanging garments', category: 'special' },
  S2: { group: 'Named cargo (grain, etc.)', label: 'Closed, side doors + living', category: 'special' },
});

/** Normalise raw size/type input: uppercase + strip whitespace/hyphens. */
export function normalizeSizeType(code: string): string {
  return String(code ?? '').toUpperCase().replace(/[\s-]/g, '');
}

/**
 * Decode a 4-character ISO 6346 size/type code. Always returns a result object;
 * `valid` is false and `errors` explains when the format is wrong. Unknown
 * length/height/type codes are reported as "unknown" rather than guessed.
 */
export function decodeSizeType(code: string): SizeTypeResult {
  const normalized = normalizeSizeType(code);
  const result: SizeTypeResult = {
    input: code,
    normalized,
    valid: false,
    lengthFt: null,
    lengthLabel: 'unknown',
    heightLabel: 'unknown',
    typeCode: normalized.slice(2),
    typeGroup: 'unknown',
    typeLabel: 'unknown',
    category: 'unknown',
    errors: [],
  };
  if (!/^[A-Z0-9]{4}$/.test(normalized)) {
    result.errors.push('Size/type code must be 4 alphanumeric characters');
    return result;
  }
  const lenCh = normalized[0]!;
  const hgtCh = normalized[1]!;
  const typeCode = normalized.slice(2);
  result.typeCode = typeCode;

  const len = LENGTH_CODES[lenCh];
  if (len) {
    result.lengthFt = len.ft;
    result.lengthLabel = len.label;
  }
  const hgt = HEIGHT_CODES[hgtCh];
  if (hgt) result.heightLabel = hgt;

  const t = TYPE_CODES[typeCode];
  if (t) {
    result.typeGroup = t.group;
    result.typeLabel = t.label;
    result.category = t.category;
  } else {
    // Fall back to the type-group prefix when the full code is exotic/retired.
    const prefix = TYPE_GROUPS[typeCode[0]!];
    if (prefix) {
      result.typeGroup = prefix.group;
      result.category = prefix.category;
      result.typeLabel = `${prefix.group} — specific code ${typeCode}`;
    }
  }

  result.valid = result.lengthFt !== null && hgt !== undefined && t !== undefined;
  if (result.lengthFt === null) result.errors.push(`Unknown length code "${lenCh}"`);
  if (hgt === undefined) result.errors.push(`Unknown height code "${hgtCh}"`);
  if (!t && !TYPE_GROUPS[typeCode[0]!]) result.errors.push(`Unknown type code "${typeCode}"`);
  return result;
}

/**
 * ISO 668 series-1 nominal tare / max gross / max payload / capacity for the
 * most common size/type codes. These are the published nominal figures; actual
 * per-container values vary by manufacturer and age — always verify against the
 * container's CSC plate before relying on them for a VGM declaration.
 */
export function specForSizeType(code: string): ContainerSpec | null {
  const r = decodeSizeType(code);
  if (!r.lengthFt) return null;
  const k = r.normalized;
  const table: Record<string, Omit<ContainerSpec, 'source' | 'quality'>> = {
    '22G0': { tare: 2230, maxGross: 30480, maxPayload: 28250, maxStacking: 192000, special: { capacity: '33.2 m³' } },
    '22G1': { tare: 2230, maxGross: 30480, maxPayload: 28250, maxStacking: 192000, special: { capacity: '33.2 m³' } },
    '22R1': { tare: 3080, maxGross: 30480, maxPayload: 27400, maxStacking: 192000, special: { capacity: '28.3 m³' } },
    '25G1': { tare: 2390, maxGross: 30480, maxPayload: 28090, maxStacking: 192000, special: { capacity: '37.2 m³ (high-cube 20 ft)' } },
    '42G0': { tare: 3740, maxGross: 30480, maxPayload: 26740, maxStacking: 192000, special: { capacity: '67.7 m³' } },
    '42G1': { tare: 3740, maxGross: 30480, maxPayload: 26740, maxStacking: 192000, special: { capacity: '67.7 m³' } },
    '44G0': { tare: 3740, maxGross: 30480, maxPayload: 26740, maxStacking: 192000, special: { capacity: '67.5 m³' } },
    '45G0': { tare: 3970, maxGross: 32500, maxPayload: 28530, maxStacking: 192000, special: { capacity: '76.3 m³' } },
    '45G1': { tare: 3970, maxGross: 32500, maxPayload: 28530, maxStacking: 192000, special: { capacity: '76.3 m³' } },
    '45R0': { tare: 4480, maxGross: 34000, maxPayload: 29520, maxStacking: 192000, special: { capacity: '67.0 m³' } },
    'L5G0': { tare: 4270, maxGross: 34000, maxPayload: 29730, maxStacking: 192000, special: { capacity: '86.1 m³ (45 ft high-cube)' } },
    'L5G1': { tare: 4270, maxGross: 34000, maxPayload: 29730, maxStacking: 192000, special: { capacity: '86.1 m³ (45 ft high-cube)' } },
  };
  const base = table[k];
  if (!base) return null;
  return {
    ...base,
    sizeType: k,
    source: 'ISO 668 series 1 (nominal) + ISO 6346 Annex A/C',
    quality: 'ok',
  };
}
