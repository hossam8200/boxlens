import { describe, it, expect } from 'vitest';
import { isAllowed, checkAndIncrement, quotaSnapshot, PROVIDER_LIMITS } from '../_lib/quota';

describe('isAllowed', () => {
  it('allows under the limit', () => expect(isAllowed(5, 10)).toBe(true));
  it('allows at the limit', () => expect(isAllowed(10, 10)).toBe(true));
  it('blocks over the limit', () => expect(isAllowed(11, 10)).toBe(false));
  it('blocks when the limit is zero (no free API)', () => expect(isAllowed(0, 0)).toBe(false));
});

describe('checkAndIncrement', () => {
  it('increments and allows under the limit', async () => {
    const a = await checkAndIncrement('quota-test-1');
    const b = await checkAndIncrement('quota-test-1');
    expect(a.allowed).toBe(true);
    expect(a.used).toBe(1);
    expect(b.used).toBe(2);
    expect(a.limit).toBe(1000); // default for unknown providers
  });

  it('blocks IMF (no free API, limit 0)', async () => {
    const r = await checkAndIncrement('imf');
    expect(r.allowed).toBe(false);
    expect(r.limit).toBe(0);
  });
});

describe('quotaSnapshot', () => {
  it('returns every documented provider with its limit', async () => {
    const snap = await quotaSnapshot();
    expect(snap).toHaveLength(Object.keys(PROVIDER_LIMITS).length);
    const imf = snap.find((p) => p.provider === 'imf');
    expect(imf?.limit).toBe(0);
    const om = snap.find((p) => p.provider === 'open-meteo');
    expect(om?.limit).toBe(9000);
    for (const p of snap) {
      expect(p.used).toBeGreaterThanOrEqual(0);
      expect(p.windowSec).toBe(86_400);
    }
  });
});
