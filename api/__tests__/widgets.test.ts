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

// World Bank stub payloads — a mix of aggregate regions (AFE, WLD) and real
// countries (AFG, CHN, USA, SGP). Used to prove the trade resolver excludes
// aggregates, ranks by value descending, and reports the top country as the
// headline (not a row count). mrnev=1 means every record has a non-null value.
const WB_COUNTRIES = [
  { pages: 1, total: 6 },
  [
    { id: 'AFE', region: { id: 'NA' }, name: 'Africa Eastern and Southern' },
    { id: 'WLD', region: { id: 'NA' }, name: 'World' },
    { id: 'AFG', region: { id: 'MEA' }, name: 'Afghanistan' },
    { id: 'CHN', region: { id: 'EAS' }, name: 'China' },
    { id: 'USA', region: { id: 'NAC' }, name: 'United States' },
    { id: 'SGP', region: { id: 'EAS' }, name: 'Singapore' },
  ],
];
const WB_INDICATOR = [
  { pages: 1, total: 6 },
  [
    { countryiso3code: 'AFE', country: { value: 'Africa Eastern and Southern' }, value: 51.99, date: '2025' },
    { countryiso3code: 'WLD', country: { value: 'World' }, value: 100, date: '2024' },
    { countryiso3code: 'SGP', country: { value: 'Singapore' }, value: 320.5, date: '2024' },
    { countryiso3code: 'CHN', country: { value: 'China' }, value: 38.2, date: '2024' },
    { countryiso3code: 'USA', country: { value: 'United States' }, value: 27.3, date: '2024' },
    { countryiso3code: 'AFG', country: { value: 'Afghanistan' }, value: 55.1, date: '2023' },
  ],
];

const fetchMock = vi.fn(async (url: string) => ({
  ok: true,
  status: 200,
  json: async () => {
    const u = String(url ?? '');
    if (u.includes('/indicator/')) return WB_INDICATOR;
    if (u.includes('worldbank.org')) return WB_COUNTRIES;
    return OM_BODY;
  },
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

  it('nearby-terminals degrades to UNAVAILABLE when OSM has no mapped facilities (graceful)', async () => {
    // The global fetch stub returns the Open-Meteo body for every call, so the
    // Overpass response has no `elements` array -> the widget must return a
    // clean UNAVAILABLE (0 facilities) payload, never throw.
    const p = await resolveWidget('executive', 'nearby-terminals');
    expect(p.provenance.source).toMatch(/OpenStreetMap/);
    expect(p.provenance.class).toBe('UNAVAILABLE');
    expect(p.value).toBe(0);
  });

  it('sea-route showcase returns an ESTIMATE table of major lanes with real distances', async () => {
    const p = await resolveWidget('chokepoints', 'sea-route');
    expect(p.provenance.class).toBe('ESTIMATE');
    expect(p.provenance.source).toMatch(/sea-route estimator/);
    expect((p.rows ?? []).length).toBe(5);
    expect(typeof p.value).toBe('number');
    expect(p.value as number).toBeGreaterThan(0); // Rotterdam -> Shanghai distance
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

describe('data confirmation — every widget resolves with an honest data class', () => {
  // resolveWidget has a top-level try/catch, so no widget can reject — every
  // one resolves to a real payload or an UNAVAILABLE payload. This confirms
  // each registered widget carries a valid provenance class + a non-empty
  // source (honest labelling), including the provider-backed dashboards
  // (weather / chokepoints / trade / cost / vessel) the suite above skips.
  const VALID = new Set(['LIVE', 'DAILY', 'ANNUAL', 'SAMPLE', 'ESTIMATE', 'UNAVAILABLE']);
  for (const [dash, ids] of Object.entries(WIDGET_IDS_BY_DASHBOARD) as [DashboardId, string[]][]) {
    for (const id of ids) {
      it(`${dash}/${id} resolves with a valid data class + source`, async () => {
        const p = await resolveWidget(dash, id);
        expect(p.provenance).toBeDefined();
        expect(VALID.has(p.provenance.class)).toBe(true);
        expect(typeof p.provenance.source).toBe('string');
        expect(p.provenance.source.length).toBeGreaterThan(0);
      });
    }
  }
});

describe('data confirmation — real widgets carry real data (value + rows)', () => {
  it('vessel voyage-eta returns an ESTIMATE table of 5 major lanes', async () => {
    const p = await resolveWidget('vessel', 'voyage-eta');
    expect(p.provenance.class).toBe('ESTIMATE');
    expect((p.rows ?? []).length).toBe(5);
    expect(typeof p.value).toBe('number');
    expect(p.value as number).toBeGreaterThan(0); // Rotterdam→Shanghai days
  });

  it('executive port-characteristics carries NGA WPI rows (ANNUAL)', async () => {
    const p = await resolveWidget('executive', 'port-characteristics');
    expect(p.provenance.class).toBe('ANNUAL');
    expect((p.rows ?? []).length).toBeGreaterThan(0);
  });

  it('executive active-ports carries real per-port rows (DAILY)', async () => {
    const p = await resolveWidget('executive', 'active-ports');
    expect(p.provenance.class).toBe('DAILY');
    expect((p.rows ?? []).length).toBeGreaterThan(0);
  });

  it('compliance iso-violations counts failing ports (DAILY, real)', async () => {
    const p = await resolveWidget('compliance', 'iso-violations');
    expect(p.provenance.class).toBe('DAILY');
    expect(p.value).toBe(8);
    expect((p.rows ?? []).length).toBeGreaterThan(0);
  });

  it('chokepoints eonet-events resolves (LIVE) even when the stub returns no events', async () => {
    const p = await resolveWidget('chokepoints', 'eonet-events');
    expect(p.provenance.class).toBe('LIVE');
    expect(typeof p.value).toBe('number');
  });
});

describe('resolveWidget — trade (World Bank Top-N, real countries only)', () => {
  it('excludes aggregate regions, ranks descending, headline = top country value', async () => {
    const p = await resolveWidget('trade', 'trade-gdp-pct');
    expect(p.provenance.class).toBe('ANNUAL');
    const rows = p.rows ?? [];
    // 4 real countries in the stub (AFE + WLD aggregates excluded).
    expect(rows.length).toBe(4);
    // sorted descending: Singapore (320.5) first, United States (27.3) last.
    expect(rows[0]!.Country).toBe('Singapore');
    expect(rows[0]!.Value).toBe(320.5);
    expect(rows[rows.length - 1]!.Country).toBe('United States');
    // headline value is the top country's value, not a row count.
    expect(p.value).toBe(320.5);
    // no aggregate region names leaked through.
    const names = rows.map((r) => String(r.Country)).join('|');
    expect(names).not.toContain('Africa Eastern');
    expect(names).not.toContain('World');
  });

  it('container-throughput + lpi-overall share the same real-country filter + ranking', async () => {
    const ct = await resolveWidget('trade', 'container-throughput');
    const lpi = await resolveWidget('trade', 'lpi-overall');
    expect((ct.rows ?? []).length).toBe(4);
    expect((lpi.rows ?? []).length).toBe(4);
    expect(ct.rows![0]!.Country).toBe('Singapore'); // same stub → same ranking
    expect(lpi.rows![0]!.Country).toBe('Singapore');
    // no aggregate iso3 codes (AFE/WLD) in either table.
    for (const r of [...(ct.rows ?? []), ...(lpi.rows ?? [])]) {
      expect(r.ISO3).not.toBe('AFE');
      expect(r.ISO3).not.toBe('WLD');
    }
  });
});
