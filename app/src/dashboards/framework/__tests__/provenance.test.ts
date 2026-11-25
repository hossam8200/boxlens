import { describe, it, expect } from 'vitest';
import { formatAge, isStale, badgeParts, displayValue } from '../provenance';
import type { Provenance, WidgetPayload } from '../types';

const NOW = Date.UTC(2026, 10, 24, 12, 0, 0); // 2026-11-24T12:00:00Z
const iso = (offsetMs: number) => new Date(NOW - offsetMs).toISOString();

describe('formatAge', () => {
  it('just now under 60s', () => {
    expect(formatAge(iso(10_000), NOW)).toBe('just now');
  });
  it('minutes', () => {
    expect(formatAge(iso(5 * 60_000), NOW)).toBe('5m ago');
  });
  it('hours', () => {
    expect(formatAge(iso(3 * 3_600_000), NOW)).toBe('3h ago');
  });
  it('days', () => {
    expect(formatAge(iso(2 * 86_400_000), NOW)).toBe('2d ago');
  });
  it('absolute date beyond 30d', () => {
    expect(formatAge(iso(40 * 86_400_000), NOW)).toBe('on 2026-10-15');
  });
  it('unknown age on bad input', () => {
    expect(formatAge('not-a-date', NOW)).toBe('unknown age');
  });
});

describe('isStale', () => {
  it('reflects the provenance.stale flag', () => {
    const p: Provenance = { source: 'x', fetchedAt: iso(0), ttl: 60, stale: true, class: 'LIVE' };
    expect(isStale(p)).toBe(true);
    const q: Provenance = { ...p, stale: false };
    expect(isStale(q)).toBe(false);
  });
});

describe('badgeParts', () => {
  it('carries class, source and age', () => {
    const p: Provenance = {
      source: 'Open-Meteo Marine',
      fetchedAt: iso(5 * 60_000),
      ttl: 1800,
      stale: false,
      class: 'DAILY',
      attribution: '© Open-Meteo (CC-BY 4.0)',
    };
    const b = badgeParts(p, NOW);
    expect(b.classLabel).toBe('DAILY');
    expect(b.cls).toBe('dc-daily');
    expect(b.source).toBe('Open-Meteo Marine');
    expect(b.ageText).toBe('5m ago');
    expect(b.stale).toBe(false);
    expect(b.attribution).toBe('© Open-Meteo (CC-BY 4.0)');
  });
});

describe('displayValue', () => {
  it('shows the value when present', () => {
    const p: WidgetPayload<number> = {
      value: 94.2,
      unit: '%',
      provenance: { source: 'x', fetchedAt: iso(0), ttl: 60, stale: false, class: 'LIVE' },
    };
    expect(displayValue(p)).toBe('94.2');
  });
  it('shows Unavailable for UNAVAILABLE nulls', () => {
    const p: WidgetPayload<null> = {
      value: null,
      provenance: { source: 'x', fetchedAt: iso(0), ttl: 60, stale: false, class: 'UNAVAILABLE' },
    };
    expect(displayValue(p)).toBe('Unavailable');
  });
});
