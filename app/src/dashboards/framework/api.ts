// API client: every external call goes through here. No widget calls a third-
// party API directly. On any failure the client degrades visibly — it returns a
// payload with an UNAVAILABLE (or stale) provenance instead of throwing, so the
// UI never shows an empty chart.
import type { WidgetDef, WidgetPayload } from './types';

/** Resolve the API base. In production on Vercel it is same-origin "/api/v1". */
export function apiBase(): string {
  if (typeof location === 'undefined') return '/api/v1';
  // The dashboards app is served at /dashboards/*; the API lives at /api/v1/*.
  return `${location.origin}/api/v1`;
}

/**
 * Read the active port/country filters from the URL hash
 * (#/dashboards/executive?port=EGALY&country=EG) and return them as a query
 * string so per-widget fetches actually carry the filter the user selected.
 * Without this, selecting a port/country had no effect on the data.
 */
function currentFilterQuery(): string {
  if (typeof location === 'undefined') return '';
  const hash = location.hash || '';
  const q = hash.indexOf('?');
  if (q < 0) return '';
  const params = new URLSearchParams(hash.slice(q + 1));
  const parts: string[] = [];
  const port = params.get('port');
  const country = params.get('country');
  if (port) parts.push(`port=${encodeURIComponent(port)}`);
  if (country) parts.push(`country=${encodeURIComponent(country)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Degraded payload returned when a fetch fails or the source is unreachable. */
function degradedPayload(def: WidgetDef, reason: string): WidgetPayload<null> {
  const klass = def.fallback === 'stale' ? 'LIVE' : 'UNAVAILABLE';
  return {
    value: null,
    provenance: {
      source: def.title,
      fetchedAt: new Date(0).toISOString(),
      ttl: def.cacheTtlSec,
      stale: def.fallback === 'stale',
      class: klass,
      method: reason,
    },
  };
}

/**
 * Fetch a widget payload. Never throws: network error, non-2xx, malformed JSON,
 * or a missing provenance field all collapse to a degraded payload so the UI
 * shows an honest UNAVAILABLE/stale state.
 */
export async function fetchWidget<T>(
  def: WidgetDef,
  signal?: AbortSignal,
): Promise<WidgetPayload<T>> {
  const url = def.endpoint.startsWith('http')
    ? def.endpoint
    : `${apiBase()}${def.endpoint.replace(/^\/api\/v1/, '')}${currentFilterQuery()}`;
  try {
    const res = await fetch(url, {
      signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) {
      return degradedPayload(def, `HTTP ${res.status}`) as WidgetPayload<T>;
    }
    const body = (await res.json()) as WidgetPayload<T>;
    if (!body || !body.provenance || typeof body.provenance.source !== 'string') {
      return degradedPayload(def, 'Malformed payload') as WidgetPayload<T>;
    }
    return body;
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Network error';
    return degradedPayload(def, reason) as WidgetPayload<T>;
  }
}

/** Fetch the platform-health payload (drives the budget KPI + admin dashboard). */
export async function fetchHealth<T>(): Promise<T | null> {
  try {
    const res = await fetch(`${apiBase()}/health`, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
