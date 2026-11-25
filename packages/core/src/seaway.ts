// Sea-distance + rough ETA estimator. Pure TypeScript, offline, no network —
// the free tier always has it.
//
// `searoute` (the open-source shortest-path sea router) is Python-only with no
// free maintained JS port. Instead we compute a chokepoint-aware great-circle
// route: the direct arc is sampled against a coarse landmass mask; when it
// crosses a continent the route is forced through the canal / cape that yields
// the shortest valid path (Suez, Panama, Cape of Good Hope, Cape Horn, and the
// six two-chokepoint combinations). A documented detour factor accounts for
// coastal routing, and ETA = distance ÷ an explicit assumed service speed.
//
// The result is an ESTIMATE, labelled with its method and computed-at age. It
// is never a carrier schedule or an AIS-derived ETA — verify against the line.

import { haversine } from './geo';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteWaypoint extends LatLng {
  label?: string;
}

export interface SeaRouteOptions {
  /** Assumed service speed in knots (default 18 — typical containership). */
  speedKn?: number;
  /** Detour factor applied to great-circle legs for coastal routing (default 1.2). */
  detourFactor?: number;
  /** Interior samples along the direct arc for the land-crossing test (default 11). */
  landSamples?: number;
}

export interface SeaRouteResult {
  /** Total sea distance in kilometres (post detour factor). */
  distanceKm: number;
  /** Total sea distance in nautical miles. */
  distanceNm: number;
  /** Estimated transit time in hours at the assumed speed. */
  etaHours: number;
  /** Estimated transit time in days. */
  etaDays: number;
  /** The assumed speed actually used. */
  speedKn: number;
  /** The detour factor actually used. */
  detourFactor: number;
  /** Ordered waypoints: origin, any chokepoints, destination. */
  path: RouteWaypoint[];
  /** Names of canals/capes routed through (empty for a direct open-ocean leg). */
  chokepoints: string[];
  /** True when the direct arc crossed land and a chokepoint was required. */
  routedViaChokepoint: boolean;
  /** Methodology string (also surfaced on the ESTIMATE badge). */
  method: string;
}

/** Major ocean canals/capes used as routing waypoints. */
export const CHOKEPOINTS: ReadonlyArray<RouteWaypoint & { id: string }> = Object.freeze([
  { id: 'suez', label: 'Suez Canal', lat: 30.0, lng: 32.55 },
  { id: 'panama', label: 'Panama Canal', lat: 9.08, lng: -79.68 },
  { id: 'cape-hope', label: 'Cape of Good Hope', lat: -34.62, lng: 18.42 },
  { id: 'cape-horn', label: 'Cape Horn', lat: -55.98, lng: -67.27 },
]);

/**
 * Coarse continent bounding boxes (latMin, latMax, lngMin, lngMax). Used only
 * to detect when a great-circle arc's interior crosses a major landmass — not
 * for coastline precision. Conservative on purpose: better to route a
 * same-ocean trip via a canal (still a valid, if longer, sea path) than to
 * claim a straight line that cuts across a continent.
 */
export const LAND_BOXES: ReadonlyArray<{ name: string; latMin: number; latMax: number; lngMin: number; lngMax: number }> = Object.freeze([
  { name: 'North America', latMin: 15, latMax: 72, lngMin: -168, lngMax: -52 },
  { name: 'South America', latMin: -56, latMax: 13, lngMin: -82, lngMax: -34 },
  { name: 'Africa', latMin: -35, latMax: 38, lngMin: -18, lngMax: 52 },
  { name: 'Europe', latMin: 36, latMax: 72, lngMin: -10, lngMax: 45 },
  { name: 'Asia', latMin: 5, latMax: 78, lngMin: 40, lngMax: 145 },
  { name: 'Australia', latMin: -44, latMax: -10, lngMin: 113, lngMax: 154 },
  { name: 'Greenland', latMin: 60, latMax: 84, lngMin: -55, lngMax: -20 },
  { name: 'Antarctica', latMin: -90, latMax: -60, lngMin: -180, lngMax: 180 },
]);

const KMS_PER_NM = 1.852;

function toVec(lat: number, lng: number): [number, number, number] {
  const r = (Math.PI / 180);
  const la = lat * r;
  const lo = lng * r;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}

function fromVec(v: [number, number, number]): LatLng {
  const [x, y, z] = v;
  const lat = (Math.asin(z) * 180) / Math.PI;
  const lng = (Math.atan2(y, x) * 180) / Math.PI;
  return { lat, lng };
}

/** Spherical linear interpolation between two unit vectors. */
function slerp(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  dot = Math.max(-1, Math.min(1, dot));
  const omega = Math.acos(dot);
  if (Math.abs(omega) < 1e-6) return a;
  const s = Math.sin(omega);
  const w1 = Math.sin((1 - t) * omega) / s;
  const w2 = Math.sin(t * omega) / s;
  return [a[0] * w1 + b[0] * w2, a[1] * w1 + b[1] * w2, a[2] * w1 + b[2] * w2];
}

function inLandBox(lat: number, lng: number): boolean {
  for (const b of LAND_BOXES) {
    if (lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax) return true;
  }
  return false;
}

/**
 * True when the deep interior of the great-circle arc from `a` to `b` passes
 * through a coarse landmass box. Only the middle third of the arc is tested:
 * ports sit on a coast (inside a continent box by construction of the coarse
 * mask), so sampling right next to an endpoint would flag every coastal
 * departure as a "crossing". The middle third is where a genuine trans-
 * continental shortcut (e.g. Shanghai -> Rotterdam across Siberia) shows up,
 * while an open-ocean transit (Rotterdam -> New York across the Atlantic) does
 * not.
 *
 * A single isolated sample inside a box is not enough — the coarse rectangles
 * cover some adjacent ocean (e.g. the North America box reaches -168° to grab
 * the Aleutians, so a transpacific arc can clip one mid-Pacific sample). A real
 * continent crossing produces a sustained run of consecutive land-box samples,
 * so we require at least `minRun` in a row.
 */
export function crossesLand(a: LatLng, b: LatLng, samples = 11): boolean {
  const va = toVec(a.lat, a.lng);
  const vb = toVec(b.lat, b.lng);
  const lo = Math.max(1, Math.ceil(samples / 3));
  const hi = Math.min(samples - 1, Math.floor((2 * samples) / 3));
  const minRun = Math.max(2, Math.floor(samples / 6));
  let run = 0;
  for (let i = lo; i <= hi; i++) {
    const t = i / samples;
    const p = fromVec(slerp(va, vb, t));
    if (inLandBox(p.lat, p.lng)) {
      run++;
      if (run >= minRun) return true;
    } else {
      run = 0;
    }
  }
  return false;
}

interface Candidate {
  distKm: number; // raw (pre-detour) great-circle sum
  path: RouteWaypoint[];
  chokepoints: string[];
  routedViaChokepoint: boolean;
}

/**
 * Estimate a sea route between two coordinates. Always returns a result; never
 * throws. Picks the shortest valid path among: the direct arc (only when it
 * does not cross land), each single canal/cape, and each two-chokepoint pair.
 */
export function seaRoute(from: LatLng, to: LatLng, opts: SeaRouteOptions = {}): SeaRouteResult {
  const speedKn = opts.speedKn && opts.speedKn > 0 ? opts.speedKn : 18;
  const detourFactor = opts.detourFactor && opts.detourFactor > 0 ? opts.detourFactor : 1.2;
  const landSamples = opts.landSamples ?? 11;

  const candidates: Candidate[] = [];

  // Direct arc — only valid when it stays over water.
  if (!crossesLand(from, to, landSamples)) {
    candidates.push({
      distKm: haversine(from.lat, from.lng, to.lat, to.lng),
      path: [{ ...from }, { ...to }],
      chokepoints: [],
      routedViaChokepoint: false,
    });
  }

  // Single chokepoint routes.
  for (const cp of CHOKEPOINTS) {
    const wp: RouteWaypoint = { lat: cp.lat, lng: cp.lng, label: cp.label };
    candidates.push({
      distKm:
        haversine(from.lat, from.lng, cp.lat, cp.lng) +
        haversine(cp.lat, cp.lng, to.lat, to.lng),
      path: [{ ...from }, wp, { ...to }],
      chokepoints: [cp.label!],
      routedViaChokepoint: true,
    });
  }

  // Two-chokepoint routes (e.g. Asia -> US East via Suez + Panama is rarely
  // shortest, but including all pairs keeps the choice honest).
  for (let i = 0; i < CHOKEPOINTS.length; i++) {
    for (let j = i + 1; j < CHOKEPOINTS.length; j++) {
      const a = CHOKEPOINTS[i]!;
      const b = CHOKEPOINTS[j]!;
      const wa: RouteWaypoint = { lat: a.lat, lng: a.lng, label: a.label };
      const wb: RouteWaypoint = { lat: b.lat, lng: b.lng, label: b.label };
      candidates.push({
        distKm:
          haversine(from.lat, from.lng, a.lat, a.lng) +
          haversine(a.lat, a.lng, b.lat, b.lng) +
          haversine(b.lat, b.lng, to.lat, to.lng),
        path: [{ ...from }, wa, wb, { ...to }],
        chokepoints: [a.label!, b.label!],
        routedViaChokepoint: true,
      });
    }
  }

  // Shortest valid candidate.
  let best = candidates[0]!;
  for (const c of candidates) {
    if (c.distKm < best.distKm) best = c;
  }

  const distanceKm = best.distKm * detourFactor;
  const distanceNm = distanceKm / KMS_PER_NM;
  const etaHours = distanceNm / speedKn;
  const etaDays = etaHours / 24;

  const viaTxt =
    best.chokepoints.length > 0
      ? ` routed via ${best.chokepoints.join(' + ')}`
      : ' direct open-ocean arc';
  const method =
    `Great-circle (haversine)${viaTxt}; direct arc tested against a coarse ` +
    `landmass mask (${landSamples} interior samples); distance × ${detourFactor} ` +
    `detour factor; ETA = distance ÷ assumed ${speedKn} kn. Estimate — verify ` +
    `against the carrier schedule. Computed ${new Date().toISOString().slice(0, 10)}.`;

  return {
    distanceKm: Math.round(distanceKm),
    distanceNm: Math.round(distanceNm),
    etaHours: Math.round(etaHours),
    etaDays: Math.round(etaDays * 10) / 10,
    speedKn,
    detourFactor,
    path: best.path,
    chokepoints: best.chokepoints,
    routedViaChokepoint: best.routedViaChokepoint,
    method,
  };
}
