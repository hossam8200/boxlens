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
  fetchOverpassNearby,
} from './providers.js';
import { seaRoute } from './seaway.js';
import { healthWidget } from './fixtures.js';
import { getPortConditions, getPortTrend7, portCount } from './portConditions.js';
import { nearestWpi, WPI_PORT_COUNT } from './portIndex.js';
import type { DashboardId, WidgetPayload, Provenance, DataClass } from '../../app/src/dashboards/framework/types.js';
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
  operational:
    'Operational compliance derived from real Open-Meteo Marine conditions per ' +
    'port in the filter scope. Each port is classified pass/warn/fail: fail = ' +
    'wind \u226534 kt OR wave \u22653 m OR visibility \u22641 km; warn = wind \u226522 kt OR wave ' +
    '\u22651.5 m OR visibility \u22644 km; pass otherwise. Headline KPIs, the per-port ' +
    'table, the active-ports map and the 7-day trend (representative-port ' +
    'forecast) are all real. Container-compliance KPIs that need the app\u2019s own ' +
    'check-log DB are not available on the free tier.',
  vgm:
    'VGM overweight is an ESTIMATE: there is no free public container-weight ' +
    'feed. The proxy flags ports where heavy sea (wave \u2265 2 m) elevates ' +
    'weighbridge-motion risk for VGM Method 2 weighing. Wire a paid VGM/AIS ' +
    'cargo feed for real overweight declarations.',
  portchars:
    'NGA Publication 150 (World Port Index, 2019 ed.) physical characteristics ' +
    'matched to each port by nearest coordinate (\u2264 10 km, preferring a named ' +
    'port with a recorded depth). ' + WPI_PORT_COUNT +
    ' ports indexed. Port particulars are not comprehensive and may change ' +
    'without notice \u2014 verify against current NGA Pub 150 / port authority ' +
    'notices before any navigation decision.',
  searoute:
    'Chokepoint-aware great-circle estimate: the direct arc is tested against a ' +
    'coarse landmass mask and rerouted via Suez / Panama / Cape of Good Hope / ' +
    'Cape Horn when it would cross a continent. Distance \u00d7 1.2 detour factor; ' +
    'ETA = distance \u00f7 assumed 18 kn. Pure offline computation \u2014 verify ' +
    'against the carrier schedule.',
  nearby:
    'Container terminals, depots and port-industrial sites within 15 km of the ' +
    'representative port, queried live from OpenStreetMap via the Overpass API ' +
    '(\u00a9 OSM contributors, ODbL). Cached 24 h. OSM coverage is uneven \u2014 an ' +
    'empty result means nothing is mapped there, not that no facility exists.',
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
        return await resolveExecutiveWidget(widgetId, filters);
      case 'compliance':
        return await resolveComplianceWidget(widgetId, filters);
      case 'weather':
        return await resolveWeatherWidget(widgetId, filters);
      case 'chokepoints':
        return await resolveChokepointsWidget(widgetId);
      case 'trade':
        return await resolveTradeWidget(widgetId);
      case 'cost':
        return await resolveCostWidget(widgetId);
      case 'vessel':
        return await resolveVesselWidget(widgetId);
      case 'health':
        return await resolveHealthWidget(widgetId);
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

// ---- Executive + Compliance (real operational conditions) ----
//
// Reframed from SAMPLE container-compliance fixtures to real, free, keyless
// Open-Meteo marine conditions per port in the current filter scope. Each port
// is classified pass/warn/fail (see portConditions.classify); the headline KPIs,
// per-port table, active-ports map and 7-day trend are all derived from that
// real data. VGM-overweight stays an honest ESTIMATE (no free weight feed).

const COND_SOURCE = 'Open-Meteo Marine (real per-port conditions)';
const COND_ATTR = '\u00a9 Open-Meteo (CC-BY 4.0) \u00b7 UN/LOCODE (UNECE)';

function condProv(stale: boolean, opts: { klass?: DataClass; method?: string } = {}): Provenance {
  return buildProvenance({
    source: COND_SOURCE,
    class: opts.klass ?? 'DAILY',
    ttl: 1800,
    stale,
    method: opts.method ?? METHODS.operational,
    attribution: COND_ATTR,
  });
}

function pct(n: number, d: number): number {
  return d ? Math.round((n / d) * 1000) / 10 : 0;
}

async function resolveExecutiveWidget(
  widgetId: string,
  filters: { port?: string; country?: string },
): Promise<WidgetPayload> {
  const scope = await getPortConditions(filters);
  const ports = scope.ports;
  const n = ports.length;
  const passN = ports.filter((p) => p.cls === 'pass').length;
  const warnN = ports.filter((p) => p.cls === 'warn').length;
  const failN = ports.filter((p) => p.cls === 'fail').length;

  if (widgetId === 'checks-today') {
    return { value: n, unit: 'ports checked', provenance: condProv(scope.stale) };
  }
  if (widgetId === 'pass-rate' || widgetId === 'warn-rate' || widgetId === 'fail-rate') {
    const t = await getPortTrend7(filters);
    const want = widgetId === 'pass-rate' ? 'pass' : widgetId === 'warn-rate' ? 'warn' : 'fail';
    const head = widgetId === 'pass-rate' ? pct(passN, n) : widgetId === 'warn-rate' ? pct(warnN, n) : pct(failN, n);
    return {
      value: head,
      unit: '%',
      provenance: condProv(scope.stale),
      series: t.rows.map((r) => (r.cls === want ? 100 : 0)),
      labels: t.labels,
    };
  }
  if (widgetId === 'free-tier-budget') {
    const snap = await quotaSnapshot();
    const used = snap.reduce((a, x) => a + x.used, 0);
    const lim = Math.max(1, snap.reduce((a, x) => a + x.limit, 0));
    return {
      value: Math.round((used / lim) * 100),
      unit: '% of free tier',
      provenance: buildProvenance({ source: 'BoxLens quota manager', class: 'LIVE', ttl: 60 }),
      rows: snap.map((s) => ({
        Provider: s.provider,
        Used: s.used,
        Limit: s.limit,
        Window: `${Math.round(s.windowSec / 3600)}h`,
      })),
    };
  }
  if (widgetId === 'active-ports') {
    return {
      value: n,
      unit: scope.sample ? 'sample ports' : 'ports monitored',
      provenance: condProv(scope.stale),
      rows: ports.map((p) => ({
        Port: `${p.name} (${p.code})`,
        Country: p.country,
        Lat: p.lat,
        Lng: p.lng,
        Wind: p.windKnots,
        Wave: p.waveM,
        Vis: p.visKm,
        Depth: p.enr.depthM != null ? `${p.enr.depthM} m` : '—',
        Harbor: p.enr.harborSize ?? '—',
        MaxVessel: p.enr.maxVessel ?? '—',
        Class: p.cls,
        Score: p.score,
      })),
    };
  }
  if (widgetId === 'top-failures') {
    const top = [...ports].sort((a, b) => b.score - a.score).slice(0, 10);
    return {
      value: null,
      provenance: condProv(scope.stale),
      rows: top.map((p) => ({
        Port: `${p.name} (${p.code})`,
        Country: p.country,
        Wind: p.windKnots,
        Wave: p.waveM,
        Depth: p.enr.depthM != null ? `${p.enr.depthM} m` : '—',
        Harbor: p.enr.harborSize ?? '—',
        Score: p.score,
      })),
    };
  }
  if (widgetId === 'port-characteristics') {
    // Full NGA Pub 150 physical detail for the representative port in scope.
    const port = ports[0]!;
    if (!port) return unavailable(widgetId, 'executive', 'No port in scope.');
    const m = nearestWpi(port.lat, port.lng, 10);
    if (!m) {
      return {
        value: null,
        provenance: buildProvenance({
          source: 'NGA World Port Index (Pub 150)',
          class: 'UNAVAILABLE',
          ttl: 604800,
          method: `No NGA Pub 150 port within 10 km of ${port.name}. The index covers ${WPI_PORT_COUNT} ports; some UN/LOCODE entries (inland depots, small terminals) have no WPI match.`,
        }),
      };
    }
    const d = (v: number | null) => (v != null ? `${v} m` : '—');
    return {
      value: m.depth_m,
      unit: 'm max depth',
      provenance: buildProvenance({
        source: 'NGA World Port Index (Pub 150)',
        class: 'ANNUAL',
        ttl: 604800,
        stale: scope.stale,
        attribution: 'NGA Publication 150 (2019 ed.)',
        method: `Nearest WPI match: ${m.name}, ${m.distanceKm} km from ${port.name}. ` + METHODS.portchars,
      }),
      rows: [
        { Field: 'WPI port', Value: m.name },
        { Field: 'Country', Value: m.country },
        { Field: 'Max recorded depth', Value: d(m.depth_m) },
        { Field: 'Channel depth', Value: d(m.channel_depth_m) },
        { Field: 'Cargo pier depth', Value: d(m.cargo_pier_depth_m) },
        { Field: 'Anchorage depth', Value: d(m.anchorage_depth_m) },
        { Field: 'Tidal range', Value: d(m.tidal_range_m) },
        { Field: 'Harbor size', Value: m.port_size || '—' },
        { Field: 'Max vessel', Value: m.max_vessel || '—' },
        { Field: 'Entrance: heavy swell', Value: m.restriction_swell ? 'Restricted' : 'No' },
        { Field: 'Entrance: ice', Value: m.restriction_ice ? 'Restricted' : 'No' },
        { Field: 'Entrance: tide', Value: m.restriction_tide ? 'Restricted' : 'No' },
        { Field: 'Match distance', Value: `${m.distanceKm} km` },
      ],
    };
  }
  if (widgetId === 'nearby-terminals') {
    // Real nearby container terminals / depots from OpenStreetMap Overpass.
    const port = ports[0]!;
    if (!port) return unavailable(widgetId, 'executive', 'No port in scope.');
    try {
      const r = await fetchOverpassNearby(port.lat, port.lng, 15000);
      if (!r.data.length) {
        return {
          value: 0,
          unit: 'nearby facilities',
          provenance: buildProvenance({
            source: 'OpenStreetMap Overpass',
            class: 'UNAVAILABLE',
            ttl: 86400,
            stale: r.stale,
            attribution: '© OpenStreetMap contributors (ODbL)',
            method: `No container terminals or depots mapped within 15 km of ${port.name} in OpenStreetMap. OSM coverage is uneven \u2014 this is not an absence of facilities, only of mapped data.`,
          }),
        };
      }
      return {
        value: r.data.length,
        unit: 'nearby facilities',
        provenance: buildProvenance({
          source: 'OpenStreetMap Overpass',
          class: 'DAILY',
          ttl: 86400,
          stale: r.stale,
          attribution: '© OpenStreetMap contributors (ODbL)',
          method: METHODS.nearby,
        }),
        rows: r.data.slice(0, 15).map((f) => ({
          Facility: f.name,
          Type: f.type,
          Distance: `${f.distanceKm} km`,
          Lat: f.lat,
          Lng: f.lng,
        })),
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Overpass fetch failed';
      return {
        value: null,
        provenance: buildProvenance({
          source: 'OpenStreetMap Overpass',
          class: 'UNAVAILABLE',
          ttl: 300,
          attribution: '© OpenStreetMap contributors (ODbL)',
          method: `Overpass unreachable from this deploy (${reason}). The public instances rate-limit shared cloud egress IPs; set OVERPASS_URL to a self-hosted Overpass endpoint for live nearby-terminal data.`,
        }),
      };
    }
  }
  return unavailable(widgetId, 'executive', `Unknown widget "${widgetId}".`);
}

async function resolveComplianceWidget(
  widgetId: string,
  filters: { port?: string; country?: string },
): Promise<WidgetPayload> {
  const scope = await getPortConditions(filters);
  const ports = scope.ports;

  if (widgetId === 'rule-matrix') {
    type Field = 'wind' | 'wave' | 'vis' | 'cls';
    const rules: { Rule: string; field: Field }[] = [
      { Rule: 'Wind threshold (\u226522 kt)', field: 'wind' },
      { Rule: 'Wave threshold (\u22651.5 m)', field: 'wave' },
      { Rule: 'Visibility (\u22644 km)', field: 'vis' },
      { Rule: 'Overall operational', field: 'cls' },
    ];
    const rows = rules.map(({ Rule, field }) => {
      let p = 0, w = 0, f = 0;
      for (const port of ports) {
        if (field === 'wind') {
          if (port.windKnots >= 34) f++;
          else if (port.windKnots >= 22) w++;
          else p++;
        } else if (field === 'wave') {
          if (port.waveM >= 3) f++;
          else if (port.waveM >= 1.5) w++;
          else p++;
        } else if (field === 'vis') {
          if (port.visKm <= 1) f++;
          else if (port.visKm <= 4) w++;
          else p++;
        } else if (port.cls === 'fail') f++;
        else if (port.cls === 'warn') w++;
        else p++;
      }
      return { Rule, Pass: p, Warn: w, Fail: f };
    });
    return { value: null, provenance: condProv(scope.stale), rows };
  }

  if (widgetId === 'owner-coverage') {
    // Reframed as country coverage: ports with live data vs the country total.
    const byCountry = new Map<string, number>();
    for (const p of ports) {
      byCountry.set(p.country, (byCountry.get(p.country) ?? 0) + 1);
    }
    const cc = filters.country?.toUpperCase();
    const rows = Array.from(byCountry.entries()).map(([country, withData]) => {
      const total = cc ? portCount(cc) : portCount(country);
      return {
        Country: country,
        Ports: withData,
        'With data %': pct(withData, Math.max(withData, total)),
      };
    });
    const withData = ports.length;
    const total = cc ? portCount(cc) : ports.length;
    return {
      value: pct(withData, Math.max(withData, total)),
      unit: '% ports with live data',
      provenance: condProv(scope.stale),
      rows,
    };
  }

  if (widgetId === 'iso-violations') {
    const failing = ports.filter((p) => p.cls === 'fail');
    const t = await getPortTrend7(filters);
    return {
      value: failing.length,
      unit: 'ports failing thresholds',
      provenance: condProv(scope.stale),
      series: t.rows.map((r) => (r.cls === 'fail' ? 1 : 0)),
      labels: t.labels,
      rows: failing.map((p) => ({
        Port: `${p.name} (${p.code})`,
        Country: p.country,
        Wind: p.windKnots,
        Wave: p.waveM,
        Vis: p.visKm,
        Depth: p.enr.depthM != null ? `${p.enr.depthM} m` : '—',
        Harbor: p.enr.harborSize ?? '—',
        Issue:
          p.windKnots >= 34
            ? 'Wind \u2265 34 kt'
            : p.waveM >= 3
              ? 'Wave \u2265 3 m'
              : p.visKm <= 1
                ? 'Vis \u2264 1 km'
                : 'threshold breached',
      })),
    };
  }

  if (widgetId === 'vgm-overweight') {
    // ESTIMATE proxy: heavy sea (wave \u2265 2 m) elevates weighbridge-motion risk.
    const atRisk = ports
      .filter((p) => p.waveM >= 2)
      .sort((a, b) => b.waveM - a.waveM);
    return {
      value: atRisk.length,
      unit: 'ports at elevated risk (est.)',
      provenance: condProv(scope.stale, { klass: 'ESTIMATE', method: METHODS.vgm }),
      rows: atRisk.map((p) => ({
        Port: `${p.name} (${p.code})`,
        Country: p.country,
        'Wave m': p.waveM,
        Risk: p.waveM >= 3 ? 'High' : 'Moderate',
      })),
    };
  }

  return unavailable(widgetId, 'compliance', `Unknown widget "${widgetId}".`);
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
  if (widgetId === 'sea-route') {
    // Chokepoint-aware sea-distance + ETA showcase for major container lanes.
    // Pure offline computation (packages/core seaway) — gives the Chokepoints
    // dashboard real transit content where IMF PortWatch is UNAVAILABLE.
    const LANES = [
      { from: { name: 'Rotterdam', lat: 51.95, lng: 4.07 }, to: { name: 'Shanghai', lat: 31.22, lng: 121.48 } },
      { from: { name: 'Shanghai', lat: 31.22, lng: 121.48 }, to: { name: 'Los Angeles', lat: 33.74, lng: -118.27 } },
      { from: { name: 'Rotterdam', lat: 51.95, lng: 4.07 }, to: { name: 'Los Angeles', lat: 33.74, lng: -118.27 } },
      { from: { name: 'Singapore', lat: 1.26, lng: 103.84 }, to: { name: 'Rotterdam', lat: 51.95, lng: 4.07 } },
      { from: { name: 'Shanghai', lat: 31.22, lng: 121.48 }, to: { name: 'Hamburg', lat: 53.54, lng: 9.98 } },
    ];
    const computed = LANES.map((l) => ({
      lane: `${l.from.name} \u2192 ${l.to.name}`,
      r: seaRoute(l.from, l.to),
    }));
    const head = computed[0]!;
    return {
      value: head.r.distanceKm,
      unit: 'km Rotterdam\u2192Shanghai',
      provenance: buildProvenance({
        source: 'BoxLens sea-route estimator (offline)',
        class: 'ESTIMATE',
        ttl: 604800,
        method: METHODS.searoute,
      }),
      rows: computed.map((c) => ({
        Lane: c.lane,
        Distance: `${c.r.distanceKm} km`,
        'Naut. mi': c.r.distanceNm,
        ETA: `${c.r.etaDays} d`,
        Chokepoints: c.r.chokepoints.length ? c.r.chokepoints.join(' + ') : 'direct',
      })),
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
  // Voyage ETA showcase — real (estimated) transit content for the major
  // container lanes. Gives the Vessel dashboard genuine content alongside the
  // honest AIS-unavailable cards. Pure offline (packages/core seaway) — never
  // depends on the AIS key.
  if (widgetId === 'voyage-eta') {
    const LANES = [
      { from: { name: 'Rotterdam', lat: 51.95, lng: 4.07 }, to: { name: 'Shanghai', lat: 31.22, lng: 121.48 } },
      { from: { name: 'Shanghai', lat: 31.22, lng: 121.48 }, to: { name: 'Los Angeles', lat: 33.74, lng: -118.27 } },
      { from: { name: 'Singapore', lat: 1.26, lng: 103.84 }, to: { name: 'Rotterdam', lat: 51.95, lng: 4.07 } },
      { from: { name: 'Yantian', lat: 22.59, lng: 114.31 }, to: { name: 'Jebel Ali', lat: 25.01, lng: 55.06 } },
      { from: { name: 'Los Angeles', lat: 33.74, lng: -118.27 }, to: { name: 'Savannah', lat: 32.08, lng: -81.09 } },
    ];
    const computed = LANES.map((l) => ({
      lane: `${l.from.name} \u2192 ${l.to.name}`,
      r: seaRoute(l.from, l.to),
    }));
    const head = computed[0]!;
    return {
      value: head.r.etaDays,
      unit: 'd Rotterdam\u2192Shanghai',
      provenance: buildProvenance({
        source: 'BoxLens sea-route estimator (offline)',
        class: 'ESTIMATE',
        ttl: 604800,
        method: METHODS.searoute,
      }),
      rows: computed.map((c) => ({
        Lane: c.lane,
        Distance: `${c.r.distanceKm} km`,
        ETA: `${c.r.etaDays} d`,
        Chokepoints: c.r.chokepoints.length ? c.r.chokepoints.join(' + ') : 'direct',
      })),
    };
  }
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
    'port-characteristics',
    'nearby-terminals',
  ],
  compliance: ['rule-matrix', 'owner-coverage', 'iso-violations', 'vgm-overweight'],
  weather: ['marine-snapshot', 'risk-score', 'holidays'],
  chokepoints: ['eonet-events', 'usgs-quakes', 'transit-kpis', 'sea-route'],
  trade: ['trade-gdp-pct', 'container-throughput', 'lpi-overall'],
  cost: ['fx-rates', 'freight-index'],
  vessel: ['ais-snapshot', 'ais-port-density', 'voyage-eta'],
  health: ['budget-used', 'cache-hit-rate', 'error-rate', 'breaker-state'],
  'classic-analytics': [],
};
