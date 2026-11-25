// ISO 6346 size/type decoder tests — pure, offline.
import { describe, it, expect } from 'vitest';
import {
  decodeSizeType,
  specForSizeType,
  normalizeSizeType,
  LENGTH_CODES,
  HEIGHT_CODES,
  TYPE_CODES,
} from '../src/sizetype';

describe('normalizeSizeType', () => {
  it('uppercases and strips whitespace/hyphens', () => {
    expect(normalizeSizeType(' 22g1 ')).toBe('22G1');
    expect(normalizeSizeType('22-G1')).toBe('22G1');
    expect(normalizeSizeType('45 R0')).toBe('45R0');
  });
});

describe('decodeSizeType', () => {
  it('decodes the canonical 20-ft dry example', () => {
    const r = decodeSizeType('22G1');
    expect(r.valid).toBe(true);
    expect(r.lengthFt).toBe(20);
    expect(r.lengthLabel).toBe('20 ft');
    expect(r.heightLabel).toContain('8 ft 6 in');
    expect(r.typeGroup).toMatch(/General purpose/);
    expect(r.typeLabel).toMatch(/vents/);
    expect(r.category).toBe('dry');
  });

  it('decodes a 40-ft high-cube reefer', () => {
    const r = decodeSizeType('45R0');
    expect(r.valid).toBe(true);
    expect(r.lengthFt).toBe(40);
    expect(r.heightLabel).toContain('high-cube');
    expect(r.category).toBe('reefer');
  });

  it('decodes a 40-ft tank', () => {
    const r = decodeSizeType('42T1');
    expect(r.valid).toBe(true);
    expect(r.lengthFt).toBe(40);
    expect(r.category).toBe('tank');
    expect(r.typeLabel).toMatch(/dangerous/i);
  });

  it('decodes a 20-ft open-top with one door', () => {
    const r = decodeSizeType('22U1');
    expect(r.valid).toBe(true);
    expect(r.category).toBe('open-top');
  });

  it('decodes a 40-ft flat with fixed ends', () => {
    const r = decodeSizeType('42P1');
    expect(r.valid).toBe(true);
    expect(r.category).toBe('flat');
  });

  it('decodes a 45-ft high-cube dry (L5G1)', () => {
    const r = decodeSizeType('L5G1');
    expect(r.valid).toBe(true);
    expect(r.lengthFt).toBe(45);
    expect(r.heightLabel).toContain('high-cube');
    expect(r.category).toBe('dry');
  });

  it('falls back to the type-group prefix for exotic full codes', () => {
    // 22R7 is a valid reefer prefix R but not in the explicit TYPE_CODES list.
    const r = decodeSizeType('22R7');
    expect(r.lengthFt).toBe(20);
    expect(r.category).toBe('reefer');
    expect(r.typeGroup).toMatch(/Thermal/);
  });

  it('flags an unknown length code as invalid but still decodes type', () => {
    const r = decodeSizeType('92G1');
    expect(r.valid).toBe(false);
    expect(r.lengthFt).toBeNull();
    expect(r.errors.some((e) => e.includes('Unknown length'))).toBe(true);
    expect(r.category).toBe('dry');
  });

  it('flags a bad format', () => {
    const r = decodeSizeType('G1');
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('normalises input before decoding', () => {
    expect(decodeSizeType(' 22g-1 ').valid).toBe(true);
  });
});

describe('specForSizeType', () => {
  it('returns ISO 668 nominal specs for 22G1', () => {
    const s = specForSizeType('22G1');
    expect(s).not.toBeNull();
    expect(s!.tare).toBe(2230);
    expect(s!.maxGross).toBe(30480);
    expect(s!.maxPayload).toBe(28250);
    expect(s!.source).toMatch(/ISO 668/);
    expect(s!.quality).toBe('ok');
  });

  it('returns high-cube specs for 45G1', () => {
    const s = specForSizeType('45G1');
    expect(s).not.toBeNull();
    expect(s!.maxGross).toBe(32500);
    expect(s!.special?.capacity).toMatch(/76.3/);
  });

  it('returns reefer specs for 45R0', () => {
    const s = specForSizeType('45R0');
    expect(s).not.toBeNull();
    expect(s!.category ?? true).toBeTruthy();
    expect(s!.maxGross).toBe(34000);
  });

  it('returns null for an unsupported-but-valid code', () => {
    expect(specForSizeType('22U1')).toBeNull();
  });

  it('returns null for a bad code', () => {
    expect(specForSizeType('nope')).toBeNull();
  });
});

describe('lookup tables', () => {
  it('covers 20/40/45/48/53 ft lengths', () => {
    expect(LENGTH_CODES['2']?.ft).toBe(20);
    expect(LENGTH_CODES['4']?.ft).toBe(40);
    expect(LENGTH_CODES.L?.ft).toBe(45);
    expect(LENGTH_CODES.M?.ft).toBe(48);
    expect(LENGTH_CODES.P?.ft).toBe(53);
  });

  it('covers standard and high-cube heights', () => {
    expect(HEIGHT_CODES['2']).toMatch(/8 ft 6 in/);
    expect(HEIGHT_CODES['5']).toMatch(/high-cube/);
  });

  it('includes the G/R/T/U/P groups', () => {
    expect(TYPE_CODES.G1).toBeDefined();
    expect(TYPE_CODES.R0).toBeDefined();
    expect(TYPE_CODES.T1).toBeDefined();
    expect(TYPE_CODES.U1).toBeDefined();
    expect(TYPE_CODES.P1).toBeDefined();
  });
});
