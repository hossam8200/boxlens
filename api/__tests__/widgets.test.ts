import { describe, it, expect } from 'vitest';
import { resolveWidget, WIDGET_IDS_BY_DASHBOARD } from '../_lib/widgets';
import type { DashboardId } from '../../app/src/dashboards/framework/types';

describe('resolveWidget — own-app-data fixtures', () => {
  it('executive widgets return the SAMPLE fixture value', async () => {
    const p = await resolveWidget('executive', 'checks-today');
    expect(p.provenance.class).toBe('SAMPLE');
    expect(p.value).toBe(1284);
    expect(p.series).toBeDefined();
    expect(p.series!.length).toBeGreaterThan(0);
  });

  it('compliance widgets return the SAMPLE fixture value', async () => {
    const p = await resolveWidget('compliance', 'iso-violations');
    expect(p.provenance.class).toBe('SAMPLE');
    expect(p.value).toBe(17);
    expect(p.rows?.length).toBeGreaterThan(0);
  });

  it('health non-budget widgets return the SAMPLE fixture', async () => {
    const p = await resolveWidget('health', 'cache-hit-rate');
    expect(p.provenance.class).toBe('SAMPLE');
    expect(p.value).toBe(91.3);
  });
});

describe('resolveWidget — UNAVAILABLE honesty', () => {
  it('vessel widgets render UNAVAILABLE without an AISSTREAM_KEY', async () => {
    const p = await resolveWidget('vessel', 'ais-snapshot');
    expect(p.provenance.class).toBe('UNAVAILABLE');
    expect(p.value).toBeNull();
    expect(p.provenance.method).toMatch(/aisstream\.io/i);
  });

  it('chokepoints transit-kpis are UNAVAILABLE (no IMF API)', async () => {
    const p = await resolveWidget('chokepoints', 'transit-kpis');
    expect(p.provenance.class).toBe('UNAVAILABLE');
    expect(p.provenance.method).toMatch(/IMF PortWatch/i);
  });

  it('unknown widget on a known dashboard returns UNAVAILABLE with a reason', async () => {
    const p = await resolveWidget('executive', 'no-such-widget');
    expect(p.provenance.class).toBe('UNAVAILABLE');
    expect(p.provenance.method).toContain('no-such-widget');
  });

  it('unknown dashboard returns UNAVAILABLE', async () => {
    const p = await resolveWidget('health', 'totally-unknown');
    expect(p.provenance.class).toBe('UNAVAILABLE');
  });
});

describe('resolveWidget — never throws', () => {
  it('returns a payload (never rejects) for every registered widget id', async () => {
    // Skip provider-backed widgets (weather/chokepoints/trade/cost) — they call
    // real fetch and are exercised separately. Pure paths only here.
    const skip = new Set<DashboardId>(['weather', 'chokepoints', 'trade', 'cost']);
    for (const [dash, ids] of Object.entries(WIDGET_IDS_BY_DASHBOARD) as [DashboardId, string[]][]) {
      if (skip.has(dash as DashboardId)) continue;
      for (const id of ids) {
        const p = await resolveWidget(dash as DashboardId, id);
        expect(p).toBeDefined();
        expect(p.provenance).toBeDefined();
        expect(typeof p.provenance.source).toBe('string');
      }
    }
  });
});
