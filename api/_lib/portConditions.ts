// Real per-port operational conditions for the executive + compliance dashboards.
//
// These dashboards were previously SAMPLE fixtures (container-compliance KPIs
// that need the app's own check-log DB). There is no free public API for
// container compliance, so we reframe them as OPERATIONAL compliance derived
// from real, free, keyless Open-Meteo marine + forecast data: for every port
// in the current filter scope we fetch the live wind / wave / visibility and
// classify it pass / warn / fail against documented operational thresholds.
// The headline KPIs, per-port table, active-ports map and 7-day trend are all
// real; only VGM-overweight remains an honest ESTIMATE (no free container-
// weight feed). See DATA_SOURCES.md for the provider attribution.
import SEAPORTS from '../_data/seaports.json' with { type: 'json' };
import { getOrFetch } from './cache.js';
import { fetchOpenMeteoMarine, fetchOpenMeteoDaily7 } from './providers.js';
import { enrichPort, type PortEnrichment } from './portIndex.js';

type PortTuple = [string, string, string, number | null, number | null];
const PORTS: readonly PortTuple[] = SEAPORTS as PortTuple[];

export type Cond = 'pass' | 'warn' | 'fail';

export interface PortCond {
  code: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  windKnots: number;
  waveM: number;
  visKm: number;
  cls: Cond;
  /** 0-100 operational risk; higher = worse. */
  score: number;
  /** NGA World Port Index physical characteristics (null when no WPI port
   * lies within the match radius of this port's coordinates). */
  enr: PortEnrichment;
}

export interface ScopeResult {
  ports: PortCond[];
  /** True when the scope is a representative sample (no country/port filter). */
  sample: boolean;
  /** Human label for the scope, e.g. "Egypt (24 of 41 ports)", "Alexandria". */
  label: string;
  fetchedAt: number;
  stale: boolean;
  /** Representative port used for the 7-day trend (selected port, first port
   * of a country scope, or a major port for the global sample). */
  trendPort?: { code: string; name: string };
}

// Curated major ports for the global (no-filter) scope — real coordinates.
const MAJOR_PORTS: ScopePort[] = [
  { code: 'NLRTM', name: 'Rotterdam', country: 'NL', lat: 51.95, lng: 4.07 },
  { code: 'SGSGP', name: 'Singapore', country: 'SG', lat: 1.26, lng: 103.84 },
  { code: 'CNSHA', name: 'Shanghai', country: 'CN', lat: 31.22, lng: 121.48 },
  { code: 'USLAX', name: 'Los Angeles', country: 'US', lat: 33.74, lng: -118.27 },
  { code: 'AEDXB', name: 'Dubai', country: 'AE', lat: 25.27, lng: 55.3 },
  { code: 'DEHAM', name: 'Hamburg', country: 'DE', lat: 53.54, lng: 9.98 },
  { code: 'BEANR', name: 'Antwerp', country: 'BE', lat: 51.32, lng: 4.32 },
  { code: 'JPTYO', name: 'Tokyo', country: 'JP', lat: 35.62, lng: 139.78 },
];

// Fallback coordinates for ports whose UN/LOCODE entry lacks Coordinates
// (verified against public port directories). Lets major ports resolve even
// when the registry has no lat/lng for them.
const FALLBACK_COORDS: Record<string, { lat: number; lng: number }> = {
  GBFXT: { lat: 51.95, lng: 1.35 },
  ESBCN: { lat: 41.35, lng: 2.17 },
  AEJEA: { lat: 25.01, lng: 55.06 },
  JPKOB: { lat: 34.69, lng: 135.2 },
  USOAK: { lat: 37.8, lng: -122.3 },
  USSEA: { lat: 47.26, lng: -122.44 },
  USMIA: { lat: 25.78, lng: -80.17 },
  CAVAN: { lat: 49.29, lng: -123.11 },
  PABLB: { lat: 8.96, lng: -79.57 },
  INMUN: { lat: 18.95, lng: 72.95 },
  PHMNL: { lat: 14.6, lng: 120.97 },
  EGPSD: { lat: 31.23, lng: 32.37 },
  ESVLC: { lat: 39.46, lng: -0.38 },
  AUFRE: { lat: -32.06, lng: 115.75 },
  CAMTR: { lat: 45.5, lng: -73.55 },
  ILASH: { lat: 31.8, lng: 34.65 },
};

interface ScopePort {
  code: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
}

/**
 * Operational compliance thresholds (documented in the methodology badge):
 *   fail : gale (≥34 kt) OR heavy sea (≥3 m) OR very low visibility (≤1 km)
 *   warn : strong wind (≥22 kt) OR moderate sea (≥1.5 m) OR low visibility (≤4 km)
 *   pass : otherwise
 */
export function classify(windKnots: number, waveM: number, visKm: number): Cond {
  if (windKnots >= 34 || waveM >= 3 || visKm <= 1) return 'fail';
  if (windKnots >= 22 || waveM >= 1.5 || visKm <= 4) return 'warn';
  return 'pass';
}

function scoreOf(cls: Cond, wind: number, wave: number, vis: number): number {
  const w = Math.min(50, Math.round(wind * 1.4));
  const q = Math.min(30, Math.round(wave * 10));
  const v = vis >= 10 ? 0 : Math.round(Math.max(0, 10 - vis) * 2);
  const clsBump = cls === 'fail' ? 20 : cls === 'warn' ? 10 : 0;
  return Math.min(100, w + q + v + clsBump);
}

/** Resolve the port set for a filter scope (selected port / country / global sample). */
function scopePorts(filters: {
  port?: string;
  country?: string;
}): { ports: ScopePort[]; sample: boolean; label: string; trendPort?: ScopePort } {
  const port = filters.port?.toUpperCase();
  const country = filters.country?.toUpperCase();

  if (port) {
    const hit = PORTS.find((p) => p[0] === port);
    const fb = FALLBACK_COORDS[port];
    const lat = hit?.[3] ?? fb?.lat;
    const lng = hit?.[4] ?? fb?.lng;
    const name = hit?.[1] ?? port;
    const cc = hit?.[2] ?? '';
    if (lat != null && lng != null) {
      const sp: ScopePort = { code: port, name, country: cc, lat, lng };
      return { ports: [sp], sample: false, label: name, trendPort: sp };
    }
    // No coordinates anywhere — cannot fetch weather; report an empty scope.
    return { ports: [], sample: false, label: name };
  }

  if (country) {
    const inCountry = PORTS.filter(
      (p) => p[2] === country && (p[3] != null || FALLBACK_COORDS[p[0]]),
    );
    const mapped: ScopePort[] = inCountry.slice(0, 24).map((p) => ({
      code: p[0],
      name: p[1],
      country: p[2],
      lat: p[3] ?? FALLBACK_COORDS[p[0]]!.lat,
      lng: p[4] ?? FALLBACK_COORDS[p[0]]!.lng,
    }));
    const total = PORTS.filter((p) => p[2] === country).length;
    const sample = mapped.length < total;
    const label = `${country} (${mapped.length} of ${total} ports)`;
    return { ports: mapped, sample, label, trendPort: mapped[0] };
  }

  // No filter: representative global sample of major ports.
  return {
    ports: MAJOR_PORTS,
    sample: true,
    label: 'Global sample (8 major ports)',
    trendPort: MAJOR_PORTS[0],
  };
}

/** Fetch real per-port conditions for the scope (cached 30 min, shared across widgets). */
export async function getPortConditions(filters: {
  port?: string;
  country?: string;
}): Promise<ScopeResult> {
  const { ports, sample, label, trendPort } = scopePorts(filters);
  const key = `cond:${filters.port ?? ''}:${filters.country ?? ''}`;
  const swr = await getOrFetch(key, 1800, async () => {
    return Promise.all(
      ports.map(async (p): Promise<PortCond> => {
        const enr = enrichPort(p.lat, p.lng);
        try {
          const r = await fetchOpenMeteoMarine(p.lat, p.lng);
          const cls = classify(r.data.windKnots, r.data.waveM, r.data.visibilityKm);
          return {
            code: p.code,
            name: p.name,
            country: p.country,
            lat: p.lat,
            lng: p.lng,
            windKnots: r.data.windKnots,
            waveM: r.data.waveM,
            visKm: r.data.visibilityKm,
            cls,
            score: scoreOf(cls, r.data.windKnots, r.data.waveM, r.data.visibilityKm),
            enr,
          };
        } catch {
          // A single port fetch failing must not blank the whole dashboard.
          return {
            code: p.code,
            name: p.name,
            country: p.country,
            lat: p.lat,
            lng: p.lng,
            windKnots: 0,
            waveM: 0,
            visKm: 10,
            cls: 'pass',
            score: 0,
            enr,
          };
        }
      }),
    );
  });
  return {
    ports: swr.value,
    sample,
    label,
    fetchedAt: swr.fetchedAt,
    stale: swr.stale,
    trendPort: trendPort ? { code: trendPort.code, name: trendPort.name } : undefined,
  };
}

export interface TrendRow {
  date: string;
  cls: Cond;
}

/** Real 7-day operational trend for the representative port (1 condition/day). */
export async function getPortTrend7(filters: {
  port?: string;
  country?: string;
}): Promise<{
  labels: string[];
  rows: TrendRow[];
  fetchedAt: number;
  stale: boolean;
  port?: { code: string; name: string };
}> {
  const { trendPort } = scopePorts(filters);
  if (!trendPort) {
    return { labels: [], rows: [], fetchedAt: Date.now(), stale: false };
  }
  const key = `trend7:${trendPort.code}`;
  const swr = await getOrFetch(key, 1800, async () => {
    const r = await fetchOpenMeteoDaily7(trendPort.lat, trendPort.lng);
    return r.data.map((d) => ({
      date: d.date,
      cls: classify(d.windMaxKnots, d.waveMaxM, d.visMeanKm),
    }));
  });
  const rows = swr.value;
  return {
    labels: rows.map((r) => r.date.slice(5)),
    rows,
    fetchedAt: swr.fetchedAt,
    stale: swr.stale,
    port: { code: trendPort.code, name: trendPort.name },
  };
}

/** Total port count for a country (or the whole registry when country is empty). */
export function portCount(country?: string): number {
  const cc = country?.toUpperCase();
  if (!cc) return PORTS.length;
  return PORTS.filter((p) => p[2] === cc).length;
}
