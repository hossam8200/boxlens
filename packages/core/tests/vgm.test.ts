import { describe, expect, it } from 'vitest';
import { checkLimits, computeMethod2, evaluate } from '../src/vgm';

describe('computeMethod2', () => {
  it('sums tare and cargo', () => {
    expect(computeMethod2(3700, 20000)).toBe(23700);
    expect(computeMethod2(0, 0)).toBe(0);
  });
});

describe('checkLimits', () => {
  it('returns no warnings when within both limits', () => {
    expect(checkLimits(23700, 20000, 30480, 26780)).toEqual([]);
  });
  it('flags VGM exceeding max gross', () => {
    const w = checkLimits(31700, 28000, 30480, 26780);
    expect(w.some((s) => /VGM \(31700\) exceeds max gross mass \(30480\)/.test(s))).toBe(true);
  });
  it('flags cargo exceeding max payload independently of gross', () => {
    // vgm 26000 < maxGross 50000, but cargo 25000 > maxPayload 20000
    const w = checkLimits(26000, 25000, 50000, 20000);
    expect(w.some((s) => /Cargo \(25000\) exceeds max payload \(20000\)/.test(s))).toBe(true);
    expect(w.some((s) => /max gross/.test(s))).toBe(false);
  });
});

describe('evaluate', () => {
  it('is within limits for a normal load', () => {
    const r = evaluate(3700, 20000, 30480, 26780);
    expect(r.vgm).toBe(23700);
    expect(r.within).toBe(true);
    expect(r.warnings).toEqual([]);
  });
  it('flags overweight (VGM > max gross)', () => {
    const r = evaluate(3700, 28000, 30480, 26780);
    expect(r.within).toBe(false);
    expect(r.warnings.some((s) => /max gross/.test(s))).toBe(true);
  });
  it('flags payload-only excess when gross is fine', () => {
    const r = evaluate(1000, 25000, 50000, 20000);
    expect(r.vgm).toBe(26000);
    expect(r.within).toBe(false);
    expect(r.warnings.some((s) => /max payload/.test(s))).toBe(true);
    expect(r.warnings.some((s) => /max gross/.test(s))).toBe(false);
  });
  it('reports both limits when both are breached', () => {
    const r = evaluate(3700, 28000, 30480, 26780);
    expect(r.warnings.some((s) => /max gross/.test(s))).toBe(true);
    expect(r.warnings.some((s) => /max payload/.test(s))).toBe(true);
  });
  it('handles zero cargo (tare only)', () => {
    const r = evaluate(3700, 0, 30480, 26780);
    expect(r.vgm).toBe(3700);
    expect(r.within).toBe(true);
  });
  it('carries tare and cargo through the result', () => {
    const r = evaluate(3700, 20000, 30480, 26780);
    expect(r.tare).toBe(3700);
    expect(r.cargo).toBe(20000);
  });
});
