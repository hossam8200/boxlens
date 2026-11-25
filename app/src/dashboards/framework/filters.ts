// Global filters synced to the URL hash so views are shareable.
// Hash format:  #/dashboards/<id>?port=DEHAM&country=DE&from=2026-11-01&to=2026-11-24&compare=1
// The dashboard id lives in the path part; filters live in the query part.
import type { DashboardId, FilterState } from './types';

/** Parse a hash string into a dashboard id + filters. Pure. */
export function parseHash(
  hash: string,
): { dashboard: DashboardId | null; filters: FilterState } {
  const clean = hash.replace(/^#/, '');
  const qIndex = clean.indexOf('?');
  const path = qIndex >= 0 ? clean.slice(0, qIndex) : clean;
  const query = qIndex >= 0 ? clean.slice(qIndex + 1) : '';

  const dashSeg = path.split('/').filter(Boolean); // e.g. ['dashboards','executive']
  const dashboard: DashboardId | null =
    dashSeg[0] === 'dashboards' ? ((dashSeg[1] as DashboardId) ?? null) : null;

  const filters: FilterState = {};
  if (query) {
    for (const pair of query.split('&')) {
      const [k, v] = pair.split('=');
      if (!k || v === undefined) continue;
      const val = decodeURIComponent(v.replace(/\+/g, ' '));
      if (k === 'port') filters.port = val;
      else if (k === 'country') filters.country = val;
      else if (k === 'from') filters.from = val;
      else if (k === 'to') filters.to = val;
      else if (k === 'compare') filters.compare = val === '1' || val === 'true';
    }
  }
  return { dashboard, filters };
}

/** Serialize filters into the query part (without leading '?'). Pure. */
export function serializeFilters(f: FilterState): string {
  const parts: string[] = [];
  if (f.port) parts.push(`port=${encodeURIComponent(f.port)}`);
  if (f.country) parts.push(`country=${encodeURIComponent(f.country)}`);
  if (f.from) parts.push(`from=${encodeURIComponent(f.from)}`);
  if (f.to) parts.push(`to=${encodeURIComponent(f.to)}`);
  if (f.compare) parts.push('compare=1');
  return parts.join('&');
}

/** Build the full hash for a dashboard + filters. Pure. */
export function buildHash(dashboard: DashboardId, filters: FilterState): string {
  const q = serializeFilters(filters);
  return `#/dashboards/${dashboard}${q ? `?${q}` : ''}`;
}

export function readFilters(): FilterState {
  if (typeof location === 'undefined') return {};
  return parseHash(location.hash).filters;
}

export function readDashboard(): DashboardId | null {
  if (typeof location === 'undefined') return null;
  return parseHash(location.hash).dashboard;
}

/** Replace the hash without adding spurious history entries. */
export function writeHash(dashboard: DashboardId, filters: FilterState): void {
  if (typeof history === 'undefined') return;
  const next = buildHash(dashboard, filters);
  if (location.hash !== next) history.replaceState(null, '', next);
}
