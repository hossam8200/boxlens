// NGA World Port Index provider tests — pure, offline (fixture-loaded).
import { describe, it, expect } from 'vitest';
import {
  nearestWpi,
  enrichPort,
  wpiForCountry,
  WPI_PORT_COUNT,
  WPI_WITH_DEPTH,
} from '../_lib/portIndex';

describe('portIndex — NGA World Port Index (Pub 150)', () => {
  it('loads thousands of ports, most with a recorded depth', () => {
    expect(WPI_PORT_COUNT).toBeGreaterThan(5000);
    expect(WPI_WITH_DEPTH).toBeGreaterThan(3000);
  });

  it('nearestWpi matches a named port with depth near Rotterdam', () => {
    const m = nearestWpi(51.95, 4.07, 10);
    expect(m).not.toBeNull();
    expect(m!.name).toBeTruthy(); // not an unnamed sub-facility sounding
    expect(m!.distanceKm).toBeLessThanOrEqual(10);
    expect(m!.country).toBe('Netherlands');
  });

  it('nearestWpi matches Shanghai itself (depth recorded)', () => {
    const m = nearestWpi(31.22, 121.48, 10);
    expect(m).not.toBeNull();
    expect(m!.name!.toUpperCase()).toContain('SHANGHAI');
    expect(m!.depth_m).toBeGreaterThan(0);
  });

  it('prefers a named+depth port over a closer unnamed record', () => {
    // An unnamed null-depth point sits ~2.2 km from Rotterdam; the matcher
    // must skip it and return the named EUROPOORT (~3.4 km, depth ~34.7 m).
    const m = nearestWpi(51.95, 4.07, 10);
    expect(m).not.toBeNull();
    expect(m!.name).not.toBeNull();
    expect(m!.depth_m).not.toBeNull();
  });

  it('returns null in the open ocean', () => {
    expect(nearestWpi(40, -40, 10)).toBeNull(); // mid-Atlantic, no port within 10 km
  });

  it('enrichPort surfaces depth + harbor size + the matched WPI name', () => {
    const e = enrichPort(31.22, 121.48);
    expect(e.wpiName).toBeTruthy();
    expect(e.wpiDistanceKm).toBeLessThanOrEqual(10);
    expect(typeof e.depthM === 'number' || e.depthM === null).toBe(true);
    expect(e.harborSize === null || typeof e.harborSize === 'string').toBe(true);
  });

  it('wpiForCountry returns ports for a known country name', () => {
    const nl = wpiForCountry('Netherlands', 50);
    expect(nl.length).toBeGreaterThan(0);
    expect(nl[0]!.country.toLowerCase()).toBe('netherlands');
  });

  it('wpiForCountry is case-insensitive and empty-safe', () => {
    expect(wpiForCountry('nEtHeRlAnDs', 5).length).toBeGreaterThan(0);
    expect(wpiForCountry('', 5)).toEqual([]);
  });
});
