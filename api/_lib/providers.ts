// Keyless provider adapters. Every external call goes through cache (SWR),
// quota (free-tier guard) and a per-provider circuit breaker. Each adapter
// returns a normalised domain shape; the caller (widget resolver) wraps it in
// a WidgetPayload with provenance. Adapters throw on failure so the resolver
// can fall back to a stale or UNAVAILABLE payload — never an empty chart.
//
// Sources (verified 2026-11-24, see DATA_SOURCES.md):
//   open-meteo  Marine + Forecast APIs (CC-BY 4.0)
//   nager-date  Public holidays (MIT)
//   frankfurter ECB reference FX rates (free, key-less)
//   world-bank  Open data API (open data)
//   eonet       NASA EONET events (open)
//   usgs        USGS earthquakes GeoJSON (public domain)
import { getOrFetch } from './cache.js';
import { checkAndIncrement } from './quota.js';
import { getBreaker } from './circuitBreaker.js';
import { withTimeout } from './http.js';

const FETCH_TIMEOUT_MS = 8000;

async function guardedFetch(
  provider: string,
  url: string,
  cacheKey: string,
  cacheTtlSec: number,
): Promise<{ json: unknown; fetchedAt: number; stale: boolean }> {
  const swr = await getOrFetch(cacheKey, cacheTtlSec, async () => {
    const breaker = getBreaker(provider);
    if (!breaker.canRequest()) {
      throw new Error(`${provider} circuit open`);
    }
    const q = await checkAndIncrement(provider);
    if (!q.allowed) {
      throw new Error(`${provider} quota exhausted`);
    }
    try {
      const res = await withTimeout(fetch(url, { headers: { accept: 'application/json' } }), FETCH_TIMEOUT_MS);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      breaker.recordSuccess();
      return json;
    } catch (err) {
      breaker.recordFailure();
      throw err instanceof Error ? err : new Error(String(err));
    }
  });
  return { json: swr.value, fetchedAt: swr.fetchedAt, stale: swr.stale };
}

// ---- Open-Meteo Marine + Forecast (wind/wave/swell + visibility) ----

export interface MarineSnapshot {
  windKnots: number;
  waveM: number;
  swellM: number;
  visibilityKm: number;
  utcOffsetH: number;
}

export async function fetchOpenMeteoMarine(
  lat: number,
  lng: number,
): Promise<{ data: MarineSnapshot; fetchedAt: number; stale: boolean }> {
  const marineUrl =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}` +
    `&current=wave_height,wave_period,swell_wave_height`;
  const wxUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=wind_speed_10m,visibility`;
  const cacheKey = `om-marine:${lat.toFixed(2)},${lng.toFixed(2)}`;
  const swr = await getOrFetch(cacheKey, 1800, async () => {
    const [marine, wx] = await Promise.all([
      guardedFetch('open-meteo', marineUrl, `om:marine:${lat},${lng}`, 1800),
      guardedFetch('open-meteo', wxUrl, `om:wx:${lat},${lng}`, 1800),
    ]);
    const m = (marine.json as { current?: Record<string, number> }).current ?? {};
    const w = (wx.json as { current?: Record<string, number>, utc_offset_seconds?: number }).current ?? {};
    // Open-Meteo returns wind in km/h; convert to knots (1 kt = 1.852 km/h).
    const windKmh = typeof w.wind_speed_10m === 'number' ? w.wind_speed_10m : 0;
    return {
      windKnots: Math.round((windKmh / 1.852) * 10) / 10,
      waveM: typeof m.wave_height === 'number' ? Math.round(m.wave_height * 10) / 10 : 0,
      swellM: typeof m.swell_wave_height === 'number' ? Math.round(m.swell_wave_height * 10) / 10 : 0,
      visibilityKm: typeof w.visibility === 'number' ? Math.round(w.visibility / 1000 * 10) / 10 : 10,
      utcOffsetH: Math.round(((wx.json as { utc_offset_seconds?: number }).utc_offset_seconds ?? 0) / 3600),
    } as MarineSnapshot;
  });
  return { data: swr.value, fetchedAt: swr.fetchedAt, stale: swr.stale };
}

// ---- Open-Meteo 7-day daily forecast (executive/compliance real trend) ----

export interface DailyForecast {
  date: string;
  windMaxKnots: number;
  waveMaxM: number;
  visMeanKm: number;
}

export async function fetchOpenMeteoDaily7(
  lat: number,
  lng: number,
): Promise<{ data: DailyForecast[]; fetchedAt: number; stale: boolean }> {
  const wxUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&daily=wind_speed_10m_max,visibility_mean&timezone=auto&forecast_days=7`;
  const marineUrl =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}` +
    `&daily=wave_height_max&timezone=auto&forecast_days=7`;
  const cacheKey = `om-daily7:${lat.toFixed(2)},${lng.toFixed(2)}`;
  const swr = await getOrFetch(cacheKey, 1800, async () => {
    const [wx, marine] = await Promise.all([
      guardedFetch('open-meteo', wxUrl, `om:wx7:${lat},${lng}`, 1800),
      guardedFetch('open-meteo', marineUrl, `om:marine7:${lat},${lng}`, 1800),
    ]);
    const d = (wx.json as {
      daily?: { time?: string[]; wind_speed_10m_max?: number[]; visibility_mean?: number[] };
    }).daily ?? {};
    const m = (marine.json as { daily?: { time?: string[]; wave_height_max?: number[] } }).daily ?? {};
    const times = d.time ?? [];
    const out: DailyForecast[] = [];
    for (let i = 0; i < times.length; i++) {
      const windRaw = d.wind_speed_10m_max?.[i];
      const visRaw = d.visibility_mean?.[i];
      const waveRaw = m.wave_height_max?.[i];
      const windKmh = typeof windRaw === 'number' ? windRaw : 0;
      const visM = typeof visRaw === 'number' ? visRaw : 10000;
      const wave = typeof waveRaw === 'number' ? waveRaw : 0;
      out.push({
        date: times[i] ?? '',
        windMaxKnots: Math.round((windKmh / 1.852) * 10) / 10,
        waveMaxM: Math.round(wave * 10) / 10,
        visMeanKm: Math.round((visM / 1000) * 10) / 10,
      });
    }
    return out;
  });
  return { data: swr.value, fetchedAt: swr.fetchedAt, stale: swr.stale };
}

// ---- Nager.Date public holidays ----

export interface Holiday {
  date: string;
  name: string;
  types: string[];
}

export async function fetchNagerHolidays(
  year: number,
  countryCode: string,
): Promise<{ data: Holiday[]; fetchedAt: number; stale: boolean }> {
  const cc = countryCode.toUpperCase();
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${cc}`;
  const swr = await getOrFetch(`nager:${year}:${cc}`, 86400, async () => {
    const r = await guardedFetch('nager-date', url, `nager:${year}:${cc}`, 86400);
    const arr = (r.json as Array<{ date: string; localName: string; name: string; types?: string[] }>) ?? [];
    return arr.map((h) => ({ date: h.date, name: h.name, types: h.types ?? [] }));
  });
  return { data: swr.value, fetchedAt: swr.fetchedAt, stale: swr.stale };
}

// ---- Frankfurter ECB reference rates ----

export interface FxRates {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export async function fetchFrankfurterRates(
  base = 'USD',
  targets = ['EUR', 'GBP', 'CNY', 'JPY', 'AED', 'SGD'],
): Promise<{ data: FxRates; fetchedAt: number; stale: boolean }> {
  const t = targets.join(',');
  const url = `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${t}`;
  const swr = await getOrFetch(`frankfurter:${base}:${t}`, 43200, async () => {
    const r = await guardedFetch('frankfurter', url, `frankfurter:${base}:${t}`, 43200);
    const body = r.json as { base?: string; date?: string; rates?: Record<string, number> };
    return {
      base: body.base ?? base,
      date: body.date ?? new Date().toISOString().slice(0, 10),
      rates: body.rates ?? {},
    };
  });
  return { data: swr.value, fetchedAt: swr.fetchedAt, stale: swr.stale };
}

// ---- World Bank Open Data ----

export interface WbRow {
  country: string;
  iso3: string;
  value: number | null;
  year: number;
}

export async function fetchWorldBankIndicator(
  indicatorCode: string,
  perPage = 50,
): Promise<{ data: WbRow[]; fetchedAt: number; stale: boolean }> {
  const url =
    `https://api.worldbank.org/v2/country/all/indicator/${indicatorCode}` +
    `?format=json&per_page=${perPage}&mrnev=1`;
  const swr = await getOrFetch(`wb:${indicatorCode}`, 604800, async () => {
    const r = await guardedFetch('world-bank', url, `wb:${indicatorCode}`, 604800);
    const arr = (r.json as unknown[])[1] as
      | Array<{ country?: { value?: string; id?: string }; value?: number | null; date?: string }>
      | undefined;
    const rows: WbRow[] = (arr ?? []).map((r2) => ({
      country: r2.country?.value ?? '',
      iso3: r2.country?.id ?? '',
      value: r2.value ?? null,
      year: Number(r2.date ?? 0),
    }));
    return rows;
  });
  return { data: swr.value, fetchedAt: swr.fetchedAt, stale: swr.stale };
}

// ---- NASA EONET events ----

export interface EonetEvent {
  id: string;
  title: string;
  category: string;
  lat: number;
  lng: number;
  date: string;
}

export async function fetchEonetEvents(days = 14): Promise<{ data: EonetEvent[]; fetchedAt: number; stale: boolean }> {
  const url = `https://eonet.gsfc.nasa.gov/api/v3/events?days=${days}&status=open`;
  const swr = await getOrFetch(`eonet:${days}`, 3600, async () => {
    const r = await guardedFetch('eonet', url, `eonet:${days}`, 3600);
    const events = (r.json as { events?: Array<{ id: string; title: string; categories?: Array<{ title: string }>; geometry?: Array<{ type: string; coordinates: [number, number] | [[number, number][]]; date?: string }> }> }).events ?? [];
    const out: EonetEvent[] = [];
    for (const e of events) {
      const cat = e.categories?.[0]?.title ?? 'Unknown';
      const g = e.geometry?.[0];
      if (!g) continue;
      const coords = g.coordinates as unknown;
      let lng = 0; let lat = 0;
      if (g.type === 'Point' && Array.isArray(coords) && typeof coords[0] === 'number') {
        lng = coords[0]; lat = coords[1];
      }
      out.push({ id: e.id, title: e.title, category: cat, lat, lng, date: g.date ?? '' });
    }
    return out;
  });
  return { data: swr.value, fetchedAt: swr.fetchedAt, stale: swr.stale };
}

// ---- USGS earthquakes (GeoJSON feed, M≥4.5, past week) ----

export interface QuakeRow {
  id: string;
  place: string;
  mag: number;
  lng: number;
  lat: number;
  time: number;
}

export async function fetchUsgsEarthquakes(): Promise<{ data: QuakeRow[]; fetchedAt: number; stale: boolean }> {
  const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson';
  const swr = await getOrFetch('usgs:m25-week', 3600, async () => {
    const r = await guardedFetch('usgs', url, 'usgs:m25-week', 3600);
    const features = (r.json as { features?: Array<{ id: string; properties?: { place?: string; mag?: number; time?: number }; geometry?: { coordinates?: [number, number, number] } }> }).features ?? [];
    const out: QuakeRow[] = features
      .map((f) => ({
        id: String(f.id),
        place: f.properties?.place ?? 'Unknown',
        mag: typeof f.properties?.mag === 'number' ? Math.round(f.properties.mag * 10) / 10 : 0,
        lng: f.geometry?.coordinates?.[0] ?? 0,
        lat: f.geometry?.coordinates?.[1] ?? 0,
        time: f.properties?.time ?? 0,
      }))
      .filter((q) => q.mag >= 4.5)
      .sort((a, b) => b.mag - a.mag)
      .slice(0, 50);
    return out;
  });
  return { data: swr.value, fetchedAt: swr.fetchedAt, stale: swr.stale };
}

// ---- OpenStreetMap Overpass (nearby container terminals / depots) ----
// Keyless, free (public instance, rate-limited). OSM data is crowd-sourced
// and uneven — an empty result means nothing is *mapped* there, not that no
// facility exists. Cached 24 h; © OpenStreetMap contributors, ODbL.

function havKm(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371;
  const dLat = ((la2 - la1) * Math.PI) / 180;
  const dLon = ((lo2 - lo1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((la1 * Math.PI) / 180) * Math.cos((la2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface NearbyFacility {
  name: string;
  type: string;
  lat: number;
  lng: number;
  distanceKm: number;
}

const OVERPASS_TIMEOUT_MS = 8000;

export async function fetchOverpassNearby(
  lat: number,
  lng: number,
  radiusM = 15000,
): Promise<{ data: NearbyFacility[]; fetchedAt: number; stale: boolean }> {
  // Nodes-only query: ways require geometry computation and time out near dense
  // ports (Rotterdam) when called from a Vercel function far from the EU
  // Overpass instances. Cargo terminals + depots are commonly mapped as nodes
  // with the same tags; nodes carry their own lat/lon (no `center` needed).
  // Server-side timeout 8s mirrors the fetch timeout so Overpass stops early.
  const q =
    `[out:json][timeout:8];(` +
    `node["seamark:type"="cargo_terminal"](around:${radiusM},${lat},${lng});` +
    `node["man_made"="container_terminal"](around:${radiusM},${lat},${lng});` +
    `node["industrial"="depot"](around:${radiusM},${lat},${lng});` +
    `);out tags 25;`;
  const INSTANCES = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.openstreetmap.fr/api/interpreter',
  ];
  const body = `data=${encodeURIComponent(q)}`;
  const cacheKey = `overpass:${lat.toFixed(2)},${lng.toFixed(2)},${radiusM}`;
  const swr = await getOrFetch(cacheKey, 86_400, async () => {
    const breaker = getBreaker('overpass');
    if (!breaker.canRequest()) throw new Error('overpass circuit open');
    const quota = await checkAndIncrement('overpass');
    if (!quota.allowed) throw new Error('overpass quota exhausted');
    // Overpass public instances require a descriptive User-Agent (a missing/
    // generic UA gets HTTP 406) and prefer POST for queries. The public
    // instances are flaky from a far region (alternating 406 / timeout), so try
    // three mirrors (kumi, de, fr) before failing the call.
    let lastErr: unknown;
    for (const base of INSTANCES) {
      try {
        const res = await withTimeout(
          fetch(base, {
            method: 'POST',
            headers: {
              accept: 'application/json',
              'content-type': 'application/x-www-form-urlencoded',
              'user-agent': 'BoxLens/2.7 (port-intelligence; https://boxlens.vercel.app)',
            },
            body,
          }),
          OVERPASS_TIMEOUT_MS,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status} @ ${base}`);
        const json = await res.json();
        breaker.recordSuccess();
        return json;
      } catch (err) {
        lastErr = err;
      }
    }
    breaker.recordFailure();
    throw lastErr instanceof Error ? lastErr : new Error('all Overpass instances failed');
  });
  const els = (
    swr.value as {
      elements?: Array<{
        type: string;
        lat?: number;
        lon?: number;
        center?: { lat: number; lon: number };
        tags?: Record<string, string>;
      }>;
    }
  ).elements ?? [];
  const out: NearbyFacility[] = [];
  for (const e of els) {
    const t = e.tags ?? {};
    const name = t.name ?? t['seamark:name'] ?? '';
    if (!name) continue;
    const elat = e.lat ?? e.center?.lat;
    const elng = e.lon ?? e.center?.lon;
    if (typeof elat !== 'number' || typeof elng !== 'number') continue;
    const type =
      t['seamark:type'] === 'cargo_terminal'
        ? 'Cargo terminal'
        : t.man_made === 'container_terminal'
          ? 'Container terminal'
          : t.industrial === 'depot'
            ? 'Depot'
            : t.industrial === 'port'
              ? 'Port industrial'
              : 'Facility';
    out.push({
      name,
      type,
      lat: Math.round(elat * 1e4) / 1e4,
      lng: Math.round(elng * 1e4) / 1e4,
      distanceKm: Math.round(havKm(lat, lng, elat, elng) * 10) / 10,
    });
  }
  out.sort((a, b) => a.distanceKm - b.distanceKm);
  return { data: out.slice(0, 20), fetchedAt: swr.fetchedAt, stale: swr.stale };
}
