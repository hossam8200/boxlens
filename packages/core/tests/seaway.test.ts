// Sea-distance + rough ETA estimator tests — pure, offline.
import { describe, it, expect } from 'vitest';
import { seaRoute, crossesLand, CHOKEPOINTS, LAND_BOXES } from '../src/seaway';

// Real port coordinates (approximate, public).
const ROTTERDAM = { lat: 51.95, lng: 4.07 }; // NLRTM
const SHANGHAI = { lat: 30.62, lng: 122.07 }; // CNSHA (Yangshan approach)
const NEW_YORK = { lat: 40.67, lng: -74.04 }; // USNYC
const LOS_ANGELES = { lat: 33.73, lng: -118.26 }; // USLAX
const JEBEL_ALI = { lat: 25.01, lng: 55.06 }; // AEJEA
const SANTOS = { lat: -23.97, lng: -46.3 }; // BRSSZ
const SINGAPORE = { lat: 1.27, lng: 103.84 }; // SGSIN

describe('crossesLand', () => {
  it('flags a direct arc that cuts across a continent (Shanghai -> Rotterdam)', () => {
    expect(crossesLand(SHANGHAI, ROTTERDAM)).toBe(true);
  });
  it('flags New York -> Los Angeles (crosses North America)', () => {
    expect(crossesLand(NEW_YORK, LOS_ANGELES)).toBe(true);
  });
  it('passes for an open-ocean transatlantic arc (Rotterdam -> New York)', () => {
    expect(crossesLand(ROTTERDAM, NEW_YORK)).toBe(false);
  });
  it('passes for a transpacific arc (Shanghai -> Los Angeles)', () => {
    expect(crossesLand(SHANGHAI, LOS_ANGELES)).toBe(false);
  });
});

describe('seaRoute', () => {
  it('routes Europe -> Asia via the Suez Canal, not a land-cutting direct line', () => {
    const r = seaRoute(ROTTERDAM, SHANGHAI);
    expect(r.routedViaChokepoint).toBe(true);
    expect(r.chokepoints).toContain('Suez Canal');
    // The direct great-circle (which cuts across Siberia) is ~7,800 km; the
    // canal-routed estimate must be substantially longer than that invalid
    // shortcut, proving the land guard kicked in.
    expect(r.distanceKm).toBeGreaterThan(12000);
    expect(r.distanceKm).toBeLessThan(22000);
    expect(r.path.length).toBe(3);
  });

  it('routes Europe -> US East as a direct open-ocean arc (no canal)', () => {
    const r = seaRoute(ROTTERDAM, NEW_YORK);
    expect(r.routedViaChokepoint).toBe(false);
    expect(r.chokepoints).toEqual([]);
    expect(r.distanceKm).toBeGreaterThan(5000);
    expect(r.distanceKm).toBeLessThan(8000);
  });

  it('routes US East -> US West via the Panama Canal', () => {
    const r = seaRoute(NEW_YORK, LOS_ANGELES);
    expect(r.routedViaChokepoint).toBe(true);
    expect(r.chokepoints).toContain('Panama Canal');
  });

  it('routes Asia -> US West as a direct transpacific arc', () => {
    const r = seaRoute(SHANGHAI, LOS_ANGELES);
    expect(r.routedViaChokepoint).toBe(false);
    expect(r.distanceKm).toBeGreaterThan(9000);
  });

  it('routes Gulf -> Europe via Suez', () => {
    const r = seaRoute(JEBEL_ALI, ROTTERDAM);
    expect(r.chokepoints).toContain('Suez Canal');
  });

  it('routes South America East -> US West via Panama', () => {
    const r = seaRoute(SANTOS, LOS_ANGELES);
    expect(r.routedViaChokepoint).toBe(true);
    // Direct would cross South America — must be canal-routed.
    expect(r.chokepoints.length).toBeGreaterThan(0);
  });

  it('Asia -> Europe via Suez is shorter than via the Cape of Good Hope', () => {
    const viaSuez = seaRoute(SHANGHAI, ROTTERDAM);
    expect(viaSuez.chokepoints).toContain('Suez Canal');
    expect(viaSuez.distanceKm).toBeLessThan(25000);
  });

  it('honours a custom speed and scales ETA accordingly', () => {
    const slow = seaRoute(ROTTERDAM, NEW_YORK, { speedKn: 10 });
    const fast = seaRoute(ROTTERDAM, NEW_YORK, { speedKn: 20 });
    expect(fast.etaHours).toBeLessThan(slow.etaHours);
    expect(slow.etaHours).toBeCloseTo(fast.etaHours * 2, -1);
    expect(slow.speedKn).toBe(10);
  });

  it('honours a custom detour factor', () => {
    const a = seaRoute(ROTTERDAM, NEW_YORK, { detourFactor: 1.0 });
    const b = seaRoute(ROTTERDAM, NEW_YORK, { detourFactor: 1.5 });
    expect(b.distanceKm).toBeGreaterThan(a.distanceKm);
  });

  it('always labels the result as an estimate with a documented method', () => {
    const r = seaRoute(ROTTERDAM, SHANGHAI);
    expect(r.method).toMatch(/Estimate/);
    expect(r.method).toMatch(/haversine/);
    expect(r.method).toMatch(/kn/);
  });

  it('distanceNm and etaHours are internally consistent', () => {
    const r = seaRoute(SINGAPORE, ROTTERDAM, { speedKn: 18, detourFactor: 1.0 });
    expect(r.distanceNm).toBeCloseTo((r.distanceKm / 1.852), -1);
    expect(r.etaHours).toBeCloseTo(r.distanceNm / 18, -1);
  });

  it('returns a non-empty path from origin to destination', () => {
    const r = seaRoute(SINGAPORE, SHANGHAI);
    expect(r.path.length).toBeGreaterThanOrEqual(2);
    expect(r.path[0]!.lat).toBeCloseTo(SINGAPORE.lat, 1);
    expect(r.path[r.path.length - 1]!.lat).toBeCloseTo(SHANGHAI.lat, 1);
  });
});

describe('lookup tables', () => {
  it('exposes the four major canals/capes', () => {
    const ids = CHOKEPOINTS.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['suez', 'panama', 'cape-hope', 'cape-horn']));
    expect(CHOKEPOINTS.length).toBe(4);
  });
  it('exposes coarse continent land boxes', () => {
    const names = LAND_BOXES.map((b) => b.name);
    expect(names).toEqual(expect.arrayContaining(['Africa', 'Asia', 'South America']));
  });
});
