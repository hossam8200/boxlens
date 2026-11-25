// Leaflet map helper for dashboard routes. Lazy-imports leaflet so routes that
// don't need a map don't pay for it. Renders tiles from OpenStreetMap (free,
// attribution required) into a glass-style container, with optional markers
// and a fit-to-bounds helper. The caller owns the returned cleanup fn.
export interface MapPoint {
  lat: number;
  lng: number;
  title: string;
  /** Tailwind-ish colour name from a small palette; default teal. */
  color?: 'teal' | 'blue' | 'amber' | 'red' | 'violet';
  /** Optional radius for a circle marker (px). */
  radius?: number;
}

const COLOR_HEX: Record<NonNullable<MapPoint['color']>, string> = {
  teal: '#0f766e',
  blue: '#2563eb',
  amber: '#d97706',
  red: '#dc2626',
  violet: '#7c3aed',
};

export interface MapHandle {
  map: unknown;
  dispose(): void;
}

/** Build a Leaflet map with markers + circle markers for the given points. */
export async function dashMap(
  target: HTMLElement,
  points: MapPoint[],
  opts: { center?: [number, number]; zoom?: number; path?: { coords: [number, number][]; color?: MapPoint['color'] } } = {},
): Promise<MapHandle> {
  const L = (await import('leaflet')).default;
  // Leaflet's CSS is imported once for the whole app from styles.css via CDN
  // link in index.html (the dashboards app loads Leaflet CSS from unpkg in
  // production). For local dev we inject it lazily if missing.
  await ensureLeafletCss();

  const map = L.map(target, {
    center: opts.center ?? (points[0] ? [points[0].lat, points[0].lng] : [20, 0]),
    zoom: opts.zoom ?? 2,
    scrollWheelZoom: false,
    worldCopyJump: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  const validPoints: [number, number][] = [];
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    const color = COLOR_HEX[p.color ?? 'teal'];
    if (typeof p.radius === 'number' && p.radius > 0) {
      L.circleMarker([p.lat, p.lng], {
        radius: p.radius,
        fillColor: color,
        color,
        weight: 1,
        opacity: 0.9,
        fillOpacity: 0.55,
      })
        .addTo(map)
        .bindTooltip(p.title, { direction: 'top' });
    } else {
      L.marker([p.lat, p.lng])
        .addTo(map)
        .bindTooltip(p.title, { direction: 'top' });
    }
    validPoints.push([p.lat, p.lng]);
  }

  // Optional routed path (dashed polyline) — used by the VGM Route tab.
  if (opts.path && opts.path.coords.length > 1) {
    const pcolor = COLOR_HEX[opts.path.color ?? 'teal'];
    L.polyline(opts.path.coords, {
      color: pcolor,
      weight: 2,
      opacity: 0.85,
      dashArray: '6 8',
    }).addTo(map);
    for (const c of opts.path.coords) validPoints.push(c);
  }

  if (validPoints.length > 1) {
    map.fitBounds(L.latLngBounds(validPoints).pad(0.18));
  } else if (validPoints.length === 1) {
    map.setView(validPoints[0]!, opts.zoom ?? 6);
  }

  // Ensure the map repaints once its container has a layout (cards mount in a
  // flex/grid parent and Leaflet often renders blank until invalidateSize).
  setTimeout(() => (map as unknown as { invalidateSize: () => void }).invalidateSize(), 80);

  return {
    map,
    dispose: () => {
      (map as unknown as { remove: () => void }).remove();
    },
  };
}

let cssPromise: Promise<void> | null = null;
async function ensureLeafletCss(): Promise<void> {
  if (cssPromise) return cssPromise;
  cssPromise = (async () => {
    if (typeof document === 'undefined') return;
    if (document.querySelector('link[data-leaflet-css]')) return;
    const link = document.createElement('link');
    link.setAttribute('data-leaflet-css', '1');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  })();
  return cssPromise;
}
