// ISO 6346 container-number check digit, validation and correction.
// Algorithm is the authoritative ISO 6346 method; CSQU3054383 anchors the
// worked example in the Wikipedia ISO 6346 article (check digit 3).

import type { ValidationResult } from './types';

/** ISO 6346 letter->value map (skips multiples of 11). A=10, B=12, ..., Z=38. */
export const LETTER_VALUES: Readonly<Record<string, number>> = (() => {
  const m: Record<string, number> = {};
  let n = 10;
  for (let c = 65; c <= 90; c++) {
    if (n % 11 === 0) n++;
    if (n % 11 === 0) n++;
    m[String.fromCharCode(c)] = n;
    n++;
  }
  return Object.freeze(m);
})();

/** Normalise raw user input: uppercase, strip whitespace and hyphens. */
export function normalize(num: string): string {
  return String(num ?? '').toUpperCase().replace(/[\s-]/g, '');
}

/**
 * Compute the ISO 6346 check digit for a 10-char owner+serial (4 letters + 6
 * digits). Returns the digit 0-9, or null if the format is invalid. When the
 * raw remainder (sum % 11) is 10, the recorded digit is 0 (the "10 -> 0" rule).
 */
export function checkDigit(id: string): number | null {
  if (!/^[A-Z]{4}\d{6}$/.test(id)) return null;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = id[i]!;
    const v = ch >= '0' && ch <= '9' ? +ch : LETTER_VALUES[ch]!;
    sum += v * Math.pow(2, i);
  }
  return (sum % 11) % 10;
}

/** Full validation of an 11-character container number. */
export function validate(num: string): ValidationResult {
  const id = normalize(num);
  const result: ValidationResult = {
    input: num,
    normalized: id,
    valid: false,
    checkDigit: null,
    expected: null,
    errors: [],
  };
  if (id.length !== 11) {
    result.errors.push('Must be 11 characters (4 letters + 6 digits + 1 check digit)');
    return result;
  }
  if (!/^[A-Z]{4}/.test(id)) result.errors.push('First 4 characters must be letters (owner code)');
  if (!/^\d{7}$/.test(id.slice(4))) result.errors.push('Last 7 characters must be digits');
  if (result.errors.length) return result;
  const expected = checkDigit(id.slice(0, 10));
  result.expected = expected;
  result.checkDigit = +id[10]!;
  result.valid = result.checkDigit === expected;
  if (!result.valid && expected !== null) {
    result.errors.push(`Check digit mismatch: expected ${expected}, got ${result.checkDigit}`);
  }
  return result;
}

/**
 * Suggest the corrected container number: the 10-char prefix+serial with the
 * correct check digit appended. Accepts either a 10-char prefix+serial or an
 * 11-char number with a wrong check digit (the trailing digit is ignored).
 * Returns null when the prefix/serial cannot be fixed (wrong owner letters,
 * wrong length, non-digit serial).
 */
export function suggestCorrected(num: string): string | null {
  const id = normalize(num);
  const head = id.slice(0, 10);
  if (!/^[A-Z]{4}\d{6}$/.test(head)) return null;
  const cd = checkDigit(head);
  return cd === null ? null : head + cd;
}

/** Golden reference cases (CSQU3054383 anchors the Wikipedia worked example). */
export const GOLDEN: ReadonlyArray<{ id: string; valid: boolean }> = Object.freeze([
  { id: 'CSQU3054383', valid: true },
  { id: 'MSKU1234565', valid: true },
  { id: 'TCNU4852000', valid: true },
  { id: 'ONEU5678907', valid: true },
  { id: 'CMAU3456787', valid: true },
  { id: 'MSCU6639871', valid: false }, // wrong check digit (correct is 0)
  { id: 'MSCU66398', valid: false }, // too short
  { id: '12345678901', valid: false }, // letters missing
]);

/** Run the golden cases; returns the list of failures (empty = all pass). */
export function runGoldenTests(): string[] {
  const fails: string[] = [];
  for (const g of GOLDEN) {
    const r = validate(g.id);
    if (r.valid !== g.valid) fails.push(`${g.id} expected ${g.valid} got ${r.valid}`);
  }
  return fails;
}
