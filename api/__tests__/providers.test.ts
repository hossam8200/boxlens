import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchFrankfurterRates, fetchOverpassNearby } from '../_lib/providers';

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

describe('fetchOverpassNearby', () => {
  it('parses OSM elements into named facilities, sorted by distance, skipping unnamed', async () => {
    // Realistic Overpass response: a named cargo-terminal node, a named depot
    // way (with center), and an unnamed node that must be dropped.
    mockFetch({
      elements: [
        { type: 'node', id: 1, lat: 51.96, lon: 4.1, tags: { name: 'Euromax Terminal', 'seamark:type': 'cargo_terminal' } },
        { type: 'way', id: 2, center: { lat: 51.94, lon: 4.05 }, tags: { name: 'Maasvlakte Depot', industrial: 'depot' } },
        { type: 'node', id: 3, lat: 51.97, lon: 4.08, tags: { 'seamark:type': 'cargo_terminal' } },
      ],
    });
    const r = await fetchOverpassNearby(51.95, 4.07, 15000);
    expect(r.data.length).toBe(2); // unnamed node dropped
    expect(r.data[0]!.name).toBe('Maasvlakte Depot'); // closer to (51.95,4.07)
    expect(r.data[0]!.type).toBe('Depot');
    expect(r.data[1]!.name).toBe('Euromax Terminal');
    expect(r.data[1]!.type).toBe('Cargo terminal');
    expect(r.data[0]!.distanceKm).toBeLessThanOrEqual(r.data[1]!.distanceKm);
    expect(r.stale).toBe(false);
  });

  it('returns an empty list (not a throw) when Overpass has no elements', async () => {
    mockFetch({ elements: [] });
    const r = await fetchOverpassNearby(40.0, -40.0, 15000); // unique coord -> no cache collision
    expect(r.data).toEqual([]);
  });

  it('falls back to the second Overpass instance when the primary fails', async () => {
    const body = {
      elements: [
        { type: 'node', id: 9, lat: 1.3, lon: 103.9, tags: { name: 'Tanjong Pagar', 'seamark:type': 'cargo_terminal' } },
      ],
    };
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 504, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => body }) as unknown as typeof globalThis.fetch;
    const r = await fetchOverpassNearby(1.26, 103.84, 15000); // Singapore, unique key
    expect(r.data.length).toBe(1);
    expect(r.data[0]!.name).toBe('Tanjong Pagar');
    expect(r.data[0]!.type).toBe('Cargo terminal');
  });
});
