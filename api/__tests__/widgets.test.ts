import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveWidget, WIDGET_IDS_BY_DASHBOARD } from '../_lib/widgets';
import type { DashboardId } from '../../app/src/dashboards/framework/types';

// Executive + compliance widgets are now derived from REAL Open-Meteo marine
// conditions per port (no SAMPLE fixtures). Stub the provider responses so the
// tests are deterministic and network-free: every port resolves to a FAIL
// condition (wave 3.5 m >= 3 m), so counts/rates are predictable.
const OM_BODY = {
  current: {
    wave_height: 3.5,
    wave_period: 6,
    swell_wave_height: 0.5,
    wind_speed_10m: 40, // ~21.6 kt -> pass on wind, but wave dominates -> fail
    visibility: 5000, // 5 km -> pass
  },
  utc_offset_seconds: 0,
  daily: {
    time: ['2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01'],
    wind_speed_10m_max: [10, 25, 40, 15, 20, 30, 5],
    visibility_mean: [10000, 4000, 800, 10000, 5000, 2000, 10000],
    wave_height_max: [0.5, 1.8, 3.2, 0.8, 1.2, 2.5, 0.4],
  },
};

const fetchMock = vi.fn(async () => ({
  ok: true,
  status: 200,
  json: async () => OM_BODY,
}));

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveWidget — executive (real operational conditions)', () => {
  it('checks-today = number of ports in the global sample, badged DAILY', async () => {
    const p = await resolveWidget('executive', 'checks-today');
    expect(p.provenance.class).toBe('DAILY');
    expect(p.value).toBe(8); // MAJOR_PORTS global sample
    expect(p.provenance.source).toMatch(/Open-Meteo/i);
  });

  it('fail-rate reflects the real classification (all fail -> 100%)', async () => {
    const p = await resolveWidget('executive', 'fail-rate');
    expect(p.provenance.class).toBe('DAILY');
    expect(p.value).toBe(100);
    expect(p.unit).toBe('%');
    expect(p.series?.length).toBe(7); // 7-day trend
  });

  it('active-ports rows carry real wind/wave/class for the map + table', async () => {
    const p = await resolveWidget('executive', 'active-ports');
    const rows = p.rows ?? [];
    expect(rows.length).toBe(8);
    expect(rows[0]).toHaveProperty('Wind');
    expect(rows[0]).toHaveProperty('Wave');
    expect(rows[0]).toHaveProperty('Class');
    // NGA WPI enrichment columns (Depth / Harbor / MaxVessel) are present on
    // every row — '—' when no WPI port lies within the match radius.
    expect(rows[0]).toHaveProperty('Depth');
    expect(rows[0]).toHaveProperty('Harbor');
    expect(rows[0]).toHaveProperty('MaxVessel');
  });

  it('port-characteristics returns NGA Pub 150 detail (ANNUAL) for the representative port', async () => {
    const p = await resolveWidget('executive', 'port-characteristics');
    expect(p.provenance.source).toMatch(/NGA World Port Index/);
    // Global sample[0] = Rotterdam -> WPI match EUROPOORT -> ANNUAL + rows.
    expect(p.provenance.class).toBe('ANNUAL');
    expect((p.rows ?? []).length).toBeGreaterThan(0);
  });

  it('free-tier-budget is LIVE quota (not weather)', async () => {
    const p = await resolveWidget('executive', 'free-tier-budget');
    expect(p.provenance.class).toBe('LIVE');
    expect(typeof p.value).toBe('number');
  });
});

describe('resolveWidget — compliance (real operational conditions)', () => {
  it('iso-violations counts failing ports (DAILY, real)', async () => {
    const p = await resolveWidget('compliance', 'iso-violations');
    expect(p.provenance.class).toBe('DAILY');
    expect(p.value).toBe(8); // all 8 sample ports fail (wave >= 3 m)
    expect(p.rows?.length).toBeGreaterThan(0);
  });

  it('vgm-overweight is an honest ESTIMATE proxy', async () => {
    const p = await resolveWidget('compliance', 'vgm-overweight');
    expect(p.provenance.class).toBe('ESTIMATE');
    expect(p.value).toBe(8); // wave >= 2 m on all sample ports
    expect(p.provenance.method).toMatch(/ESTIMATE|no free/i);
  });

  it('rule-matrix has per-rule Pass/Warn/Fail counts', async () => {
    const p = await resolveWidget('compliance', 'rule-matrix');
    const rows = p.rows ?? [];
    expect(rows.length).toBeGreaterThan(0);
    const overall = rows.find((r) => String(r['Rule']).includes('Overall'));
    expect(overall).toBeTruthy();
    expect(Number(overall!['Fail'])).toBe(8);
  });

  it('health non-budget widgets still return the SAMPLE fixture', async () => {
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
    // Skip the provider widgets that call real third-party APIs not stubbed
    // here (weather/chokepoints/trade/cost). executive/compliance go through
    // the stubbed Open-Meteo fetch above.
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
