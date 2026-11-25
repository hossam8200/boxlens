// Per-widget resolver: maps (dashboard, widgetId) → WidgetPayload.
//
// Own-app-data widgets (executive, compliance) read SAMPLE fixtures clearly
// badged SAMPLE — the demo build has no real check-log DB behind it. External
// widgets call the keyless provider adapters through cache+quota+breaker and
// wrap the result in a WidgetPayload with the right data-class + attribution.
// AIS widgets return UNAVAILABLE without a key (configured via env), and IMF
// PortWatch widgets are always UNAVAILABLE (no public REST API).
import { buildProvenance } from './provenance.js';
import {
  fetchOpenMeteoMarine,
  fetchNagerHolidays,
  fetchFrankfurterRates,
  fetchWorldBankIndicator,
  fetchEonetEvents,
  fetchUsgsEarthquakes,
} from './providers.js';
import { executiveWidget, complianceWidget, healthWidget } from './fixtures.js';
import type { DashboardId, WidgetPayload } from '../../app/src/dashboards/framework/types.js';
import type { ProviderLimit } from './quota.js';
import { PROVIDER_LIMITS, quotaSnapshot } from './quota.js';

const HAS_AIS_KEY = Boolean(process.env.AISSTREAM_KEY);

/** Methodology strings linked from the ESTIMATE / UNAVAILABLE badges. */
const METHODS = {
  congestion:
    'Congestion = queue×8 + waiting×15, capped at 100 (core/congestion.ts).',
  risk:
    'Risk = weather(wind×2 + wave×15 + swell×5, capped) + visibility(0–30) + ' +
    'congestion(0–30) + holiday(0 or 15), capped at 100 (core/risk.ts).',
  transit:
    'IMF PortWatch has no public REST API (verified 2026-11-24). ' +
    'Transit KPIs render UNAVAILABLE; the hazard map below uses real NASA EONET + USGS feeds.',
  ais:
    'AIS vessel positions require an aisstream.io API key + a cron ingestion ' +
    'job (see DATA_SOURCES.md). Rendered UNAVAILABLE until AISSTREAM_KEY is set.',
  freight:
    'Freight index is a SAMPLE estimate derived from public spot-rate ranges ' +
    '(Drewry WCI / SCFI bands); wire a paid feed for live values.',
};

/** Resolve a single widget payload, never throwing. */
export async function resolveWidget(
  dashboard: DashboardId,
  widgetId: string,
  filters: { port?: string; country?: string } = {},
): Promise<WidgetPayload> {
  try {
    switch (dashboard) {
      case 'executive':
        return executiveWidget(widgetId);
      case 'compliance':
        return complianceWidget(widgetId);
      case 'weather':
        return resolveWeatherWidget(widgetId, filters);
      case 'chokepoints':
        return resolveChokepointsWidget(widgetId);
      case 'trade':
        return resolveTradeWidget(widgetId);
      case 'cost':
        return resolveCostWidget(widgetId);
      case 'vessel':
        return resolveVesselWidget(widgetId);
      case 'health':
        return resolveHealthWidget(widgetId);
      default:
        return unavailable(widgetId, dashboard, 'Unknown dashboard.');
    }
  } catch (err) {
    return unavailable(widgetId, dashboard, err instanceof Error ? err.message : 'Fetch failed.');
  }
}

/** Resolve all widget payloads for a dashboard. */
export async function resolveDashboard(
  dashboard: DashboardId,
  widgetIds: readonly string[],
  filters: { port?: string; country?: string } = {},
): Promise<{ widget: string; payload: WidgetPayload }[]> {
  const entries = await Promise.all(
    widgetIds.map(async (w) => ({ widget: w, payload: await resolveWidget(dashboard, w, filters) })),
  );
  return entries;
}

// ---- Weather widgets (Open-Meteo Marine + risk score) ----

// A small fallback port-coordinate table when the filter is empty / unknown.
const PORT_COORDS: Record<string, { lat: number; lng: number; country: string; name: string }> = {
  DEHAM: { lat: 53.54, lng: 9.98, country: 'DE', name: 'Hamburg' },
  NLRTM: { lat: 51.95, lng: 4.07, country: 'NL', name: 'Rotterdam' },
  SGSGP: { lat: 1.26, lng: 103.84, country: 'SG', name: 'Singapore' },
  CNSHA: { lat: 31.22, lng: 121.48, country: 'CN', name: 'Shanghai' },
  USLAX: { lat: 33.74, lng: -118.27, country: 'US', name: 'Los Angeles' },
  AEDXB: { lat: 25.27, lng: 55.30, country: 'AE', name: 'Dubai' },
};

function resolvePort(filters: { port?: string; country?: string }) {
  const code = (filters.port ?? '').toUpperCase();
  if (code && PORT_COORDS[code]) return { code, ...PORT_COORDS[code] };
  return { code: 'NLRTM', ...PORT_COORDS.NLRTM! };
}

async function resolveWeatherWidget(
  widgetId: string,
  filters: { port?: string; country?: string },
): Promise<WidgetPayload> {
  const port = resolvePort(filters);
  if (widgetId === 'marine-snapshot') {
    const r = await fetchOpenMeteoMarine(port.lat, port.lng);
    return {
      value: r.data,
      unit: '',
      provenance: buildProvenance({
        source: 'Open-Meteo Marine + Forecast',
        class: 'DAILY',
        ttl: 1800,
        stale: r.stale,
        attribution: '© Open-Meteo (CC-BY 4.0)',
      }),
    };
  }
  if (widgetId === 'risk-score') {
    const r = await fetchOpenMeteoMarine(port.lat, port.lng);
    // Holiday check (cached daily).
    let isHoliday = false;
    try {
      const year = new Date().getFullYear();
      const h = await fetchNagerHolidays(year, port.country);
      const todayIso = new Date().toISOString().slice(0, 10);
      isHoliday = h.data.some((x) => x.date === todayIso);
    } catch {
      // Holiday failure does NOT fail the risk score; treated as not-holiday.
    }
    // Synthetic port vessel snapshot (no live queue without AIS); badged ESTIMATE.
    const vessels = [
      { queue: 4, status: 'waiting' },
      { queue: 2, status: 'berthed' },
    ];
    // Compose the ESTIMATE input — computed server-side so the badge is honest.
    const weather = clamp(Math.round(r.data.windKnots * 2), 0, 50) +
      clamp(Math.round(r.data.waveM * 15), 0, 30) +
      clamp(Math.round(r.data.swellM * 5), 0, 20);
    const vis = r.data.visibilityKm >= 10 ? 0 : Math.round(30 - (r.data.visibilityKm / 10) * 30);
    const queue = vessels.reduce((a, x) => a + x.queue, 0);
    const waiting = vessels.filter((x) => x.status === 'waiting').length;
    const cong = clamp(Math.round(((queue * 8 + waiting * 15) / 100) * 30), 0, 30);
    const hol = isHoliday ? 15 : 0;
    const score = clamp(weather + vis + cong + hol, 0, 100);
    return {
      value: score,
      unit: '/100',
      provenance: buildProvenance({
        source: 'BoxLens (risk.ts) · Open-Meteo · Nager.Date',
        class: 'ESTIMATE',
        ttl: 1800,
        stale: r.stale,
        method: METHODS.risk,
        attribution: '© Open-Meteo (CC-BY 4.0) · Nager.Date (MIT)',
      }),
      rows: [
        { Factor: 'Weather', Contribution: weather },
        { Factor: 'Visibility', Contribution: vis },
        { Factor: 'Congestion', Contribution: cong },
        { Factor: 'Holiday', Contribution: hol },
        { Factor: 'Total', Contribution: score },
      ],
    };
  }
  if (widgetId === 'holidays') {
    const year = new Date().getFullYear();
    const h = await fetchNagerHolidays(year, port.country);
    return {
      value: h.data.length,
      unit: `days in ${year}`,
      provenance: buildProvenance({
        source: 'Nager.Date',
        class: 'DAILY',
        ttl: 86400,
        stale: h.stale,
        attribution: 'Nager.Date (MIT)',
      }),
      rows: h.data.slice(0, 12).map((x) => ({ Date: x.date, Holiday: x.name, Type: x.types.join(', ') })),
    };
  }
  return unavailable(widgetId, 'weather', `Unknown widget "${widgetId}".`);
}

// ---- Chokepoints widgets (NASA EONET + USGS; IMF transit UNAVAILABLE) ----

async function resolveChokepointsWidget(widgetId: string): Promise<WidgetPayload> {
  if (widgetId === 'eonet-events') {
    const r = await fetchEonetEvents(14);
    return {
      value: r.data.length,
      unit: 'open events',
      provenance: buildProvenance({
        source: 'NASA EONET',
        class: 'LIVE',
        ttl: 3600,
        stale: r.stale,
        attribution: 'Credit: NASA EONET',
      }),
      rows: r.data.slice(0, 15).map((e) => ({ Event: e.title, Category: e.category, Lat: e.lat, Lng: e.lng })),
    };
  }
  if (widgetId === 'usgs-quakes') {
    const r = await fetchUsgsEarthquakes();
    return {
      value: r.data.length,
      unit: 'M≥4.5 (week)',
      provenance: buildProvenance({
        source: 'USGS Earthquakes',
        class: 'LIVE',
        ttl: 3600,
        stale: r.stale,
        attribution: 'Public domain (USGS)',
      }),
      rows: r.data.slice(0, 15).map((q) => ({ Place: q.place, Magnitude: q.mag, Lat: q.lat, Lng: q.lng })),
    };
  }
  if (widgetId === 'transit-kpis') {
    return {
      value: null,
      provenance: buildProvenance({
        source: 'IMF PortWatch',
        class: 'UNAVAILABLE',
        ttl: 60,
        method: METHODS.transit,
      }),
    };
  }
  return unavailable(widgetId, 'chokepoints', `Unknown widget "${widgetId}".`);
}

// ---- Trade widgets (World Bank, annual) ----

const WB_INDICATORS: Record<string, { code: string; name: string; unit: string }> = {
  'trade-gdp-pct': { code: 'NE.TRD.GNFS.ZS', name: 'Trade (% of GDP)', unit: '%' },
  'container-throughput': { code: 'IS.SHP.GOOD.TU', name: 'Container port throughput (TEU)', unit: 'TEU' },
  'lpi-overall': { code: 'LP.LPI.OVRL.XQ', name: 'Logistics Performance Index', unit: 'score' },
};

async function resolveTradeWidget(widgetId: string): Promise<WidgetPayload> {
  const ind = WB_INDICATORS[widgetId];
  if (!ind) return unavailable(widgetId, 'trade', `Unknown widget "${widgetId}".`);
  const r = await fetchWorldBankIndicator(ind.code);
  const withValue = r.data.filter((x) => x.value !== null);
  return {
    value: withValue.length,
    unit: ind.unit,
    provenance: buildProvenance({
      source: `World Bank — ${ind.name}`,
      class: 'ANNUAL',
      ttl: 604800,
      stale: r.stale,
      attribution: 'World Bank Open Data',
    }),
    rows: withValue
      .filter((x) => x.iso3 && x.iso3.length === 3)
      .slice(0, 20)
      .map((x) => ({ Country: x.country, ISO3: x.iso3, Value: x.value ?? '', Year: x.year })),
  };
}

// ---- Cost & Currency widgets (Frankfurter ECB FX) ----

async function resolveCostWidget(widgetId: string): Promise<WidgetPayload> {
  if (widgetId === 'fx-rates') {
    const r = await fetchFrankfurterRates('USD', ['EUR', 'GBP', 'CNY', 'JPY', 'AED', 'SGD']);
    return {
      value: r.data.date,
      unit: 'ECB rate date',
      provenance: buildProvenance({
        source: 'Frankfurter (ECB reference rates)',
        class: 'DAILY',
        ttl: 43200,
        stale: r.stale,
        attribution: '© European Central Bank / Frankfurter',
      }),
      rows: Object.entries(r.data.rates).map(([k, v]) => ({ Pair: `USD/${k}`, Rate: v })),
    };
  }
  if (widgetId === 'freight-index') {
    return {
      // SAMPLE estimate (no live freight feed on the free tier).
      value: 1425,
      unit: 'USD/40ft (spot est.)',
      provenance: buildProvenance({
        source: 'BoxLens (sample spot-range)',
        class: 'SAMPLE',
        ttl: 86400,
        method: METHODS.freight,
        attribution: 'Illustrative — wire Drewry WCI / SCFI for live values',
      }),
      series: [1180, 1220, 1280, 1340, 1410, 1425],
      labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'],
    };
  }
  return unavailable(widgetId, 'cost', `Unknown widget "${widgetId}".`);
}

// ---- Vessel widgets (aisstream.io — UNAVAILABLE without key) ----

async function resolveVesselWidget(widgetId: string): Promise<WidgetPayload> {
  if (!HAS_AIS_KEY) {
    return {
      value: null,
      provenance: buildProvenance({
        source: 'aisstream.io',
        class: 'UNAVAILABLE',
        ttl: 60,
        method: `AIS widget "${widgetId}" requires an aisstream.io API key + cron. ` + METHODS.ais,
      }),
    };
  }
  // When a key IS set, the real ingestion runs as a GitHub Actions cron that
  // writes AIS snapshots to Supabase; the dashboard would read those. This
  // demo path stays UNAVAILABLE until that cron is wired — return UNAVAILABLE
  // with a method explaining the next step.
  return {
    value: null,
    provenance: buildProvenance({
      source: 'aisstream.io',
      class: 'UNAVAILABLE',
      ttl: 60,
      method: `AIS widget "${widgetId}": AISSTREAM_KEY is set, but the ingestion cron + Supabase read path is not wired in this demo.`,
    }),
  };
}

// ---- Health widgets (own-app + provider budget snapshot) ----

async function resolveHealthWidget(widgetId: string): Promise<WidgetPayload> {
  if (widgetId === 'budget-used') {
    const snap = await quotaSnapshot();
    const usedPct = Math.round(
      (snap.reduce((a, x) => a + x.used, 0) /
        Math.max(1, snap.reduce((a, x) => a + x.limit, 0))) *
        100,
    );
    return {
      value: usedPct,
      unit: '% of free tier',
      provenance: buildProvenance({
        source: 'BoxLens quota manager',
        class: 'LIVE',
        ttl: 60,
      }),
      rows: snap.map((s) => ({
        Provider: s.provider,
        Used: s.used,
        Limit: s.limit,
        Window: `${Math.round(s.windowSec / 3600)}h`,
      })),
    };
  }
  // Fallback to a SAMPLE own-app fixture for the other health widgets.
  return healthWidget(widgetId);
}

function unavailable(widgetId: string, dashboard: string, reason: string): WidgetPayload {
  return {
    value: null,
    provenance: buildProvenance({
      source: 'BoxLens',
      class: 'UNAVAILABLE',
      ttl: 60,
      method: `Widget "${widgetId}" on "${dashboard}" unavailable: ${reason}`,
    }),
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Surface the configured provider limits to the UI (read-only). */
export function providerLimits(): Record<string, ProviderLimit> {
  return PROVIDER_LIMITS;
}

export { quotaSnapshot };

/** Widget IDs registered per dashboard (matches app/src/dashboards/framework/registry.ts). */
export const WIDGET_IDS_BY_DASHBOARD: Record<DashboardId, string[]> = {
  executive: [
    'checks-today',
    'pass-rate',
    'warn-rate',
    'fail-rate',
    'free-tier-budget',
    'active-ports',
    'top-failures',
  ],
  compliance: ['rule-matrix', 'owner-coverage', 'iso-violations', 'vgm-overweight'],
  weather: ['marine-snapshot', 'risk-score', 'holidays'],
  chokepoints: ['eonet-events', 'usgs-quakes', 'transit-kpis'],
  trade: ['trade-gdp-pct', 'container-throughput', 'lpi-overall'],
  cost: ['fx-rates', 'freight-index'],
  vessel: ['ais-snapshot', 'ais-port-density'],
  health: ['budget-used', 'cache-hit-rate', 'error-rate', 'breaker-state'],
  'classic-analytics': [],
};
