import { describe, expect, it } from 'vitest';
import {
  GOLDEN,
  LETTER_VALUES,
  checkDigit,
  normalize,
  runGoldenTests,
  suggestCorrected,
  validate,
} from '../src/iso6346';

describe('LETTER_VALUES', () => {
  it('assigns A=10 and skips multiples of 11', () => {
    expect(LETTER_VALUES['A']).toBe(10);
    expect(LETTER_VALUES['B']).toBe(12); // 11 skipped
    expect(LETTER_VALUES['K']).toBe(21);
    expect(LETTER_VALUES['L']).toBe(23); // 22 skipped
    expect(LETTER_VALUES['U']).toBe(32);
    expect(LETTER_VALUES['V']).toBe(34); // 33 skipped
    expect(LETTER_VALUES['Z']).toBe(38);
  });
  it('never contains a multiple of 11', () => {
    for (const v of Object.values(LETTER_VALUES)) expect(v % 11).not.toBe(0);
  });
});

describe('normalize', () => {
  it('uppercases and strips whitespace', () => {
    expect(normalize('csqu 3054383')).toBe('CSQU3054383');
    expect(normalize(' msku1234565 ')).toBe('MSKU1234565');
  });
  it('strips hyphens', () => {
    expect(normalize('MSCU-123456-7')).toBe('MSCU1234567');
    expect(normalize('CSQU-305438-3')).toBe('CSQU3054383');
  });
  it('handles lowercase + spaces + hyphens together', () => {
    expect(normalize(' csqu - 3054383 ')).toBe('CSQU3054383');
  });
});

describe('checkDigit', () => {
  it('returns 3 for the CSQU305438 golden case', () => {
    expect(checkDigit('CSQU305438')).toBe(3);
  });
  it('returns 5 for MSKU123456', () => {
    expect(checkDigit('MSKU123456')).toBe(5);
  });
  it('applies the 10 -> 0 rule: MSCU663987 yields 0', () => {
    // The raw remainder for this owner+serial is 10, which the ISO rule maps to 0.
    expect(checkDigit('MSCU663987')).toBe(0);
  });
  it('returns null for a bad-format prefix', () => {
    expect(checkDigit('1234567890')).toBeNull();
    expect(checkDigit('CSQU3054')).toBeNull();
    expect(checkDigit('CSQU30543A')).toBeNull();
  });
});

describe('validate — golden cases', () => {
  it('all golden cases match expected validity', () => {
    expect(runGoldenTests()).toEqual([]);
  });
  it('CSQU3054383 is valid with check digit 3', () => {
    const r = validate('CSQU3054383');
    expect(r.valid).toBe(true);
    expect(r.checkDigit).toBe(3);
    expect(r.expected).toBe(3);
    expect(r.errors).toEqual([]);
  });
});

describe('validate — input shapes', () => {
  it('accepts lowercase input', () => {
    expect(validate('csqu3054383').valid).toBe(true);
    expect(validate('msku1234565').valid).toBe(true);
  });
  it('accepts spaces and hyphens', () => {
    expect(validate('CSQU 3054383').valid).toBe(true);
    expect(validate('CSQU-3054383').valid).toBe(true);
    expect(validate('CSQU 305438-3').valid).toBe(true);
  });
  it('rejects wrong length (too short)', () => {
    const r = validate('MSCU66398');
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('Must be 11 characters'))).toBe(true);
  });
  it('rejects wrong length (too long)', () => {
    const r = validate('CSQU30543833');
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('Must be 11 characters'))).toBe(true);
  });
  it('rejects bad owner letters', () => {
    const r = validate('12345678901');
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('First 4 characters must be letters'))).toBe(true);
  });
  it('rejects a non-digit serial (category letters in the serial)', () => {
    const r = validate('CSQU30543AB');
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('Last 7 characters must be digits'))).toBe(true);
  });
  it('reports expected vs got on a check-digit mismatch', () => {
    const r = validate('MSCU6639871'); // correct is 0
    expect(r.valid).toBe(false);
    expect(r.expected).toBe(0);
    expect(r.checkDigit).toBe(1);
    expect(r.errors.some((e) => /expected 0, got 1/.test(e))).toBe(true);
  });
  it('produces a normalized form that strips noise', () => {
    expect(validate(' csqu-3054383 ').normalized).toBe('CSQU3054383');
  });
});

describe('suggestCorrected', () => {
  it('appends the correct check digit to a valid prefix+serial', () => {
    expect(suggestCorrected('csqu305438')).toBe('CSQU3054383');
    expect(suggestCorrected('MSCU663987')).toBe('MSCU6639870');
  });
  it('suggests the fix for a wrong-check-digit input', () => {
    expect(suggestCorrected('MSCU6639871')).toBe('MSCU6639870');
  });
  it('returns null when the owner letters are wrong', () => {
    expect(suggestCorrected('1234567890')).toBeNull();
  });
  it('returns null when the serial is too short / non-digit', () => {
    expect(suggestCorrected('CSQU3054')).toBeNull();
    expect(suggestCorrected('CSQU30543A')).toBeNull();
  });
});

describe('GOLDEN', () => {
  it('is frozen and covers valid + invalid cases', () => {
    expect(Object.isFrozen(GOLDEN)).toBe(true);
    expect(GOLDEN.some((g) => g.valid)).toBe(true);
    expect(GOLDEN.some((g) => !g.valid)).toBe(true);
  });
});
