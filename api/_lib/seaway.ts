// Self-contained sea-distance + rough ETA estimator for the API layer.
//
// This mirrors packages/core/src/seaway.ts (the client VGM tool uses that
// copy) but is duplicated here so the serverless API bundle stays
// self-contained — Vercel's @vercel/node bundler does not reliably follow a
// runtime VALUE import across packages (../../packages/core/src/seaway.js),
// which broke every widget endpoint. Type-only cross-package imports are fine
// (erased at build); value imports are not, so the estimator lives here too.
//
// Pure TypeScript, offline, no network. The result is an ESTIMATE — verify
// against the carrier schedule.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteWaypoint extends LatLng {
  label?: string;
}

export interface SeaRouteOptions {
  speedKn?: number;
  detourFactor?: number;
  landSamples?: number;
}

export interface SeaRouteResult {
  distanceKm: number;
  distanceNm: number;
  etaHours: number;
  etaDays: number;
  speedKn: number;
  detourFactor: number;
  path: RouteWaypoint[];
  chokepoints: string[];
  routedViaChokepoint: boolean;
  method: string;
}

function haversine(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371;
  const dLat = ((la2 - la1) * Math.PI) / 180;
  const dLon = ((lo2 - lo1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((la1 * Math.PI) / 180) * Math.cos((la2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Major ocean canals/capes used as routing waypoints. */
const CHOKEPOINTS: ReadonlyArray<RouteWaypoint & { id: string }> = Object.freeze([
  { id: 'suez', label: 'Suez Canal', lat: 30.0, lng: 32.55 },
  { id: 'panama', label: 'Panama Canal', lat: 9.08, lng: -79.68 },
  { id: 'cape-hope', label: 'Cape of Good Hope', lat: -34.62, lng: 18.42 },
  { id: 'cape-horn', label: 'Cape Horn', lat: -55.98, lng: -67.27 },
]);

/** Coarse continent bounding boxes — detect when an arc crosses a landmass. */
const LAND_BOXES: ReadonlyArray<{ latMin: number; latMax: number; lngMin: number; lngMax: number }> = Object.freeze([
  { latMin: 15, latMax: 72, lngMin: -168, lngMax: -52 },
  { latMin: -56, latMax: 13, lngMin: -82, lngMax: -34 },
  { latMin: -35, latMax: 38, lngMin: -18, lngMax: 52 },
  { latMin: 36, latMax: 72, lngMin: -10, lngMax: 45 },
  { latMin: 5, latMax: 78, lngMin: 40, lngMax: 145 },
  { latMin: -44, latMax: -10, lngMin: 113, lngMax: 154 },
  { latMin: 60, latMax: 84, lngMin: -55, lngMax: -20 },
  { latMin: -90, latMax: -60, lngMin: -180, lngMax: 180 },
]);

const KMS_PER_NM = 1.852;

function toVec(lat: number, lng: number): [number, number, number] {
  const r = Math.PI / 180;
  const la = lat * r;
  const lo = lng * r;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}

function fromVec(v: [number, number, number]): LatLng {
  const [x, y, z] = v;
  return { lat: (Math.asin(z) * 180) / Math.PI, lng: (Math.atan2(y, x) * 180) / Math.PI };
}

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

function crossesLand(a: LatLng, b: LatLng, samples = 11): boolean {
  const va = toVec(a.lat, a.lng);
  const vb = toVec(b.lat, b.lng);
  const lo = Math.max(1, Math.ceil(samples / 3));
  const hi = Math.min(samples - 1, Math.floor((2 * samples) / 3));
  const minRun = Math.max(2, Math.floor(samples / 6));
  let run = 0;
  for (let i = lo; i <= hi; i++) {
    const p = fromVec(slerp(va, vb, i / samples));
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
  distKm: number;
  path: RouteWaypoint[];
  chokepoints: string[];
  routedViaChokepoint: boolean;
}

/**
 * Estimate a sea route between two coordinates. Always returns a result; never
 * throws. Picks the shortest valid path among the direct arc (only when it
 * stays over water), each single canal/cape, and each two-chokepoint pair.
 */
export function seaRoute(from: LatLng, to: LatLng, opts: SeaRouteOptions = {}): SeaRouteResult {
  const speedKn = opts.speedKn && opts.speedKn > 0 ? opts.speedKn : 18;
  const detourFactor = opts.detourFactor && opts.detourFactor > 0 ? opts.detourFactor : 1.2;
  const landSamples = opts.landSamples ?? 11;

  const candidates: Candidate[] = [];

  if (!crossesLand(from, to, landSamples)) {
    candidates.push({
      distKm: haversine(from.lat, from.lng, to.lat, to.lng),
      path: [{ ...from }, { ...to }],
      chokepoints: [],
      routedViaChokepoint: false,
    });
  }

  for (const cp of CHOKEPOINTS) {
    const wp: RouteWaypoint = { lat: cp.lat, lng: cp.lng, label: cp.label };
    candidates.push({
      distKm: haversine(from.lat, from.lng, cp.lat, cp.lng) + haversine(cp.lat, cp.lng, to.lat, to.lng),
      path: [{ ...from }, wp, { ...to }],
      chokepoints: [cp.label!],
      routedViaChokepoint: true,
    });
  }

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

  let best = candidates[0]!;
  for (const c of candidates) {
    if (c.distKm < best.distKm) best = c;
  }

  const distanceKm = best.distKm * detourFactor;
  const distanceNm = distanceKm / KMS_PER_NM;
  const etaHours = distanceNm / speedKn;
  const etaDays = etaHours / 24;

  const viaTxt =
    best.chokepoints.length > 0 ? ` routed via ${best.chokepoints.join(' + ')}` : ' direct open-ocean arc';
  const method =
    `Great-circle (haversine)${viaTxt}; direct arc tested against a coarse ` +
    `landmass mask (${landSamples} interior samples); distance \u00d7 ${detourFactor} ` +
    `detour factor; ETA = distance \u00f7 assumed ${speedKn} kn. Estimate \u2014 verify ` +
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
