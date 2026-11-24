import { describe, expect, it } from 'vitest';
import { haversine } from '../src/geo';

describe('haversine', () => {
  it('returns 0 for identical points', () => {
    expect(haversine(0, 0, 0, 0)).toBe(0);
    expect(haversine(53.5436, 9.9391, 53.5436, 9.9391)).toBe(0);
  });
  it('1 degree of longitude at the equator is ~111.19 km', () => {
    // Earth circumference 40030 km / 360 = 111.19 km per degree at the equator.
    expect(haversine(0, 0, 0, 1)).toBeCloseTo(111.19, 0);
  });
  it('is symmetric', () => {
    expect(haversine(53.5436, 9.9391, 51.9445, 4.1377)).toBeCloseTo(
      haversine(51.9445, 4.1377, 53.5436, 9.9391),
      6,
    );
  });
  it('is sign-symmetric in longitude', () => {
    expect(haversine(0, 0, 0, 1)).toBeCloseTo(haversine(0, 0, 0, -1), 6);
  });
  it('Hamburg -> Rotterdam is within a plausible range', () => {
    const d = haversine(53.5436, 9.9391, 51.9445, 4.1377);
    expect(d).toBeGreaterThan(300);
    expect(d).toBeLessThan(600);
  });
  it('distance shrinks with latitude for a fixed longitude delta', () => {
    const equator = haversine(0, 0, 0, 1);
    const highLat = haversine(80, 0, 80, 1);
    expect(highLat).toBeLessThan(equator);
  });
});
