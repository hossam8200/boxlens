import { describe, it, expect } from 'vitest';
import { parseHash, serializeFilters, buildHash } from '../filters';

describe('parseHash', () => {
  it('parses dashboard + filters', () => {
    const r = parseHash('#/dashboards/executive?port=DEHAM&country=DE&compare=1');
    expect(r.dashboard).toBe('executive');
    expect(r.filters).toEqual({ port: 'DEHAM', country: 'DE', compare: true });
  });

  it('parses a dashboard with no filters', () => {
    expect(parseHash('#/dashboards/weather')).toEqual({ dashboard: 'weather', filters: {} });
  });

  it('returns null dashboard for an empty hash', () => {
    expect(parseHash('')).toEqual({ dashboard: null, filters: {} });
  });

  it('decodes encoded values', () => {
    const r = parseHash('#/dashboards/executive?port=DE%20HAM');
    expect(r.filters.port).toBe('DE HAM');
  });
});

describe('serializeFilters', () => {
  it('encodes values and orders keys', () => {
    expect(serializeFilters({ port: 'DE HAM', compare: true })).toBe('port=DE%20HAM&compare=1');
  });
  it('omits empty filters', () => {
    expect(serializeFilters({})).toBe('');
  });
  it('omits falsy compare', () => {
    expect(serializeFilters({ compare: false })).toBe('');
  });
});

describe('buildHash round-trip', () => {
  it('build then parse yields the same filters', () => {
    const filters = { port: 'DEHAM', country: 'DE', from: '2026-11-01', to: '2026-11-24', compare: true };
    const h = buildHash('executive', filters);
    expect(h).toBe('#/dashboards/executive?port=DEHAM&country=DE&from=2026-11-01&to=2026-11-24&compare=1');
    expect(parseHash(h).filters).toEqual(filters);
  });
});
