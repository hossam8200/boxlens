// NGA World Port Index (Pub 150) lookup — real port physical characteristics.
//
// Loads the slimmed WPI fixture once at module scope and exposes nearest-port
// matching by coordinates + a country index. Used to enrich the per-port
// operational conditions with real channel/pier depth, harbor size, max vessel
// size, tidal range and entrance restrictions — data the UN/LOCODE registry
// (seaports.json) does not carry.
//
// Source: NGA Publication 150, World Port Index (2019 edition), via the
// tayljordan/ports public mirror. See DATA_SOURCES.md. Port particulars are
// not comprehensive and may change without notice — verify against current
// NGA Pub 150 / port authority notices before any navigation decision.
import WPI from '../_data/ports-wpi.json' with { type: 'json' };

export interface WpiPort {
  id: number;
  name: string;
  country: string;
  lat: number;
  lng: number;
  depth_m: number | null;
  channel_depth_m: number | null;
  cargo_pier_depth_m: number | null;
  anchorage_depth_m: number | null;
  tidal_range_m: number | null;
  port_size: string;
  max_vessel: string;
  restriction_swell: boolean;
  restriction_ice: boolean;
  restriction_tide: boolean;
}

const PORTS: readonly WpiPort[] = (WPI as { ports: WpiPort[] }).ports;

/** Total ports in the loaded WPI fixture. */
export const WPI_PORT_COUNT = PORTS.length;

/** Ports in the fixture with a recorded depth sounding. */
export const WPI_WITH_DEPTH = PORTS.reduce((n, p) => n + (p.depth_m != null ? 1 : 0), 0);

function havKm(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371;
  const dLat = ((la2 - la1) * Math.PI) / 180;
  const dLon = ((lo2 - lo1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((la1 * Math.PI) / 180) * Math.cos((la2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface WpiMatch extends WpiPort {
  /** Distance from the query point to the matched port, in kilometres. */
  distanceKm: number;
}

/**
 * Nearest WPI port to a coordinate, within `maxKm` (default 10). Returns null
 * when no WPI port lies within the radius — e.g. inland depots or ports the
 * index does not cover.
 *
 * Two-tier match: the index contains many unnamed sub-facility points (a
 * sounding with no port name, often closer than the named port). Those carry no
 * useful display data, so we prefer — in order — (1) the nearest port that has
 * BOTH a name and a recorded depth, then (2) the nearest named port. Unnamed
 * records are skipped entirely. This yields a real port name + depth (e.g.
 * EUROPOORT 34.7 m near Rotterdam, KEPPEL 31.1 m near Singapore) instead of a
 * null record 2 km away. Linear scan over 5,410 records is sub-millisecond per
 * call and the result is memoised upstream by the SWR cache.
 */
export function nearestWpi(lat: number, lng: number, maxKm = 10): WpiMatch | null {
  let tier1: WpiMatch | null = null; // name + depth
  let tier2: WpiMatch | null = null; // name only
  for (const p of PORTS) {
    const d = havKm(lat, lng, p.lat, p.lng);
    if (d > maxKm) continue;
    const hasName = Boolean(p.name);
    if (!hasName) continue;
    const match: WpiMatch = { ...p, distanceKm: Math.round(d * 10) / 10 };
    if (p.depth_m != null) {
      if (!tier1 || d < tier1.distanceKm) tier1 = match;
    } else if (!tier2 || d < tier2.distanceKm) {
      tier2 = match;
    }
  }
  return tier1 ?? tier2;
}

/** Compact enrichment shape attached to a PortCond row. */
export interface PortEnrichment {
  depthM: number | null;
  harborSize: string | null;
  maxVessel: string | null;
  tidalRangeM: number | null;
  restrictionSwell: boolean;
  restrictionIce: boolean;
  restrictionTide: boolean;
  /** WPI port name matched (may differ from the UN/LOCODE name). */
  wpiName: string | null;
  /** Match distance in km (null when unmatched). */
  wpiDistanceKm: number | null;
}

const EMPTY: PortEnrichment = {
  depthM: null,
  harborSize: null,
  maxVessel: null,
  tidalRangeM: null,
  restrictionSwell: false,
  restrictionIce: false,
  restrictionTide: false,
  wpiName: null,
  wpiDistanceKm: null,
};

/** Enrich a coordinate with the nearest WPI port's physical characteristics. */
export function enrichPort(lat: number, lng: number, maxKm = 10): PortEnrichment {
  const m = nearestWpi(lat, lng, maxKm);
  if (!m) return { ...EMPTY };
  return {
    depthM: m.depth_m,
    harborSize: m.port_size || null,
    maxVessel: m.max_vessel || null,
    tidalRangeM: m.tidal_range_m,
    restrictionSwell: m.restriction_swell,
    restrictionIce: m.restriction_ice,
    restrictionTide: m.restriction_tide,
    wpiName: m.name,
    wpiDistanceKm: m.distanceKm,
  };
}

/** All WPI ports in a country (case-insensitive name match), capped at limit. */
export function wpiForCountry(countryName: string, limit = 50): WpiPort[] {
  const q = countryName.trim().toLowerCase();
  if (!q) return [];
  return PORTS.filter((p) => p.country.toLowerCase() === q).slice(0, limit);
}
