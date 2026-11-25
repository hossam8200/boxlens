import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchFrankfurterRates } from '../_lib/providers';

// Mock global fetch for the Frankfurter adapter. The cache (in-memory) is
// fresh per test file (vitest isolates module graphs), and we use a unique
// `base` per assertion so cache keys do not collide.
const originalFetch = globalThis.fetch;

function mockFetch(body: unknown, status = 200): void {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof globalThis.fetch;
}

beforeEach(() => {
  // Make AISSTREAM_KEY undefined so vessel tests in other files don't trip; we
  // don't touch it here, but isolate fetch per test.
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('fetchFrankfurterRates', () => {
  it('parses ECB reference rates into a normalised shape', async () => {
    mockFetch({
      base: 'USD',
      date: '2026-11-24',
      rates: { EUR: 0.92, GBP: 0.79, CNY: 7.18 },
    });
    const r = await fetchFrankfurterRates('USD', ['EUR', 'GBP', 'CNY']);
    expect(r.data.base).toBe('USD');
    expect(r.data.date).toBe('2026-11-24');
    expect(r.data.rates.EUR).toBeCloseTo(0.92);
    expect(r.data.rates.GBP).toBeCloseTo(0.79);
    expect(r.data.rates.CNY).toBeCloseTo(7.18);
    expect(r.stale).toBe(false);
  });

  it('falls back to today when the source omits the date', async () => {
    mockFetch({ base: 'USD', rates: { EUR: 0.9 } });
    const r = await fetchFrankfurterRates('USDX', ['EUR']); // unique base to avoid cache
    expect(r.data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns an empty rates map when the source returns none', async () => {
    mockFetch({ base: 'USD', rates: {} });
    const r = await fetchFrankfurterRates('USDY', ['EUR']);
    expect(r.data.rates).toEqual({});
  });
});
