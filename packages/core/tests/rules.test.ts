import { describe, expect, it } from 'vitest';
import { RULES, evaluate } from '../src/rules';
import type { ContainerSpec, EvaluateInput } from '../src/types';

const okSpec: ContainerSpec = {
  sizeType: '42G1',
  tare: 3700,
  maxGross: 30480,
  maxPayload: 26780,
  csc: { approved: true },
  quality: 'ok',
};

function ev(o: Partial<EvaluateInput>) {
  return evaluate({
    valid: true,
    spec: okSpec,
    weight: 0,
    sizeType: '42G1',
    ...o,
  });
}

describe('RULES library', () => {
  it('defines R1..R8', () => {
    expect(RULES).toHaveLength(8);
    expect(RULES.map((r) => r.id)).toEqual(['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8']);
  });
  it('has R1 fail and R8 nodata', () => {
    expect(RULES.find((r) => r.id === 'R1')?.severity).toBe('fail');
    expect(RULES.find((r) => r.id === 'R8')?.severity).toBe('nodata');
  });
});

describe('evaluate — pass', () => {
  it('passes a valid, within-limit, current-CSC, fresh record', () => {
    const r = ev({ weight: 20000 });
    expect(r.result).toBe('pass');
    expect(r.reasons).toEqual([]);
  });
});

describe('evaluate — fail', () => {
  it('fails on an invalid check digit', () => {
    const r = evaluate({ valid: false, spec: okSpec, weight: 0, sizeType: '42G1' });
    expect(r.result).toBe('fail');
    expect(r.reasons).toContain('Invalid check digit');
  });
  it('fails on VGM > max gross', () => {
    const r = ev({ weight: 28000 }); // 28000 + 3700 = 31700 > 30480
    expect(r.result).toBe('fail');
    expect(r.reasons.some((s) => /VGM > max gross \(30480\)/.test(s))).toBe(true);
  });
  it('fails on cargo > max payload (when gross is fine)', () => {
    const r = evaluate({
      valid: true,
      spec: { ...okSpec, tare: 1000, maxGross: 50000, maxPayload: 20000, sizeType: '22G1' },
      weight: 25000,
      sizeType: '22G1',
    });
    expect(r.result).toBe('fail');
    expect(r.reasons.some((s) => /Cargo > max payload \(20000\)/.test(s))).toBe(true);
  });
});

describe('evaluate — nodata', () => {
  it('returns nodata when valid but no record', () => {
    const r = evaluate({ valid: true, spec: null, weight: 0 });
    expect(r.result).toBe('nodata');
    expect(r.reasons).toContain('No technical record');
  });
});

describe('evaluate — warn', () => {
  it('warns on a size/type mismatch', () => {
    const r = ev({ weight: 20000, sizeType: '22G1' });
    expect(r.result).toBe('warn');
    expect(r.reasons.some((s) => /Size\/type mismatch \(42G1\)/.test(s))).toBe(true);
  });
  it('warns when CSC is not approved', () => {
    const r = evaluate({
      valid: true,
      spec: { ...okSpec, csc: { approved: false } },
      weight: 20000,
      sizeType: '42G1',
    });
    expect(r.result).toBe('warn');
    expect(r.reasons).toContain('CSC not approved');
  });
  it('warns when data is stale', () => {
    const r = evaluate({
      valid: true,
      spec: { ...okSpec, quality: 'stale' },
      weight: 20000,
      sizeType: '42G1',
    });
    expect(r.result).toBe('warn');
    expect(r.reasons).toContain('Stale data');
  });
});

describe('evaluate — precedence', () => {
  it('fail (bad check digit) dominates nodata: invalid + no record stays fail', () => {
    const r = evaluate({ valid: false, spec: null, weight: 0 });
    expect(r.result).toBe('fail');
    expect(r.reasons).toContain('Invalid check digit');
    expect(r.reasons).toContain('No technical record');
  });
  it('fail (overweight) dominates a size/type warn', () => {
    const r = ev({ weight: 28000, sizeType: '22G1' });
    expect(r.result).toBe('fail');
    expect(r.reasons.some((s) => /VGM > max gross/.test(s))).toBe(true);
    expect(r.reasons.some((s) => /Size\/type mismatch/.test(s))).toBe(true);
  });
  it('multiple warns accumulate without escalating to fail', () => {
    const r = evaluate({
      valid: true,
      spec: { ...okSpec, csc: { approved: false }, quality: 'stale', sizeType: '42G1' },
      weight: 20000,
      sizeType: '22G1',
    });
    expect(r.result).toBe('warn');
    expect(r.reasons).toContain('CSC not approved');
    expect(r.reasons).toContain('Stale data');
    expect(r.reasons.some((s) => /Size\/type mismatch/.test(s))).toBe(true);
  });
  it('null CSC on a manual record does not warn', () => {
    const r = evaluate({
      valid: true,
      spec: { ...okSpec, csc: null },
      weight: 20000,
      sizeType: '42G1',
    });
    expect(r.result).toBe('pass');
  });
});
