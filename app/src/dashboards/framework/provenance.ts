// Client-side provenance helpers: "updated X ago" text, stale detection,
// and badge parts. Pure, unit-tested.
import type { Provenance, WidgetPayload } from './types';
import { dataClassMeta } from './dataClass';

/**
 * Human "X ago" text from an ISO timestamp.
 * - < 60s        -> "just now"
 * - < 60m        -> "5m ago"
 * - < 24h        -> "3h ago"
 * - < 30d        -> "2d ago"
 * - else         -> "on 2026-01-04"
 */
export function formatAge(fetchedAtIso: string, nowMs: number = Date.now()): string {
  const t = Date.parse(fetchedAtIso);
  if (Number.isNaN(t)) return 'unknown age';
  const diffSec = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return `${m}m ago`;
  }
  if (diffSec < 86_400) {
    const h = Math.floor(diffSec / 3600);
    return `${h}h ago`;
  }
  if (diffSec < 30 * 86_400) {
    const d = Math.floor(diffSec / 86_400);
    return `${d}d ago`;
  }
  const d = new Date(t);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `on ${yyyy}-${mm}-${dd}`;
}

/** A value is stale when served past its TTL (server sets provenance.stale). */
export function isStale(p: Provenance): boolean {
  return p.stale;
}

export interface BadgeParts {
  /** Data-class label, e.g. "ESTIMATE". */
  classLabel: string;
  cls: string;
  color: string;
  /** "Open-Meteo Marine". */
  source: string;
  /** "5m ago". */
  ageText: string;
  /** "Stale" when the value is past TTL. */
  stale: boolean;
  /** Optional methodology link. */
  method?: string;
  /** Optional attribution that must be shown. */
  attribution?: string;
}

export function badgeParts(p: Provenance, nowMs: number = Date.now()): BadgeParts {
  const meta = dataClassMeta(p.class);
  return {
    classLabel: meta.label,
    cls: meta.cls,
    color: meta.color,
    source: p.source,
    ageText: formatAge(p.fetchedAt, nowMs),
    stale: p.stale,
    method: p.method,
    attribution: p.attribution,
  };
}

/** The honest display value for a widget: real value, or an explicit fallback string. */
export function displayValue<T>(payload: WidgetPayload<T>): string {
  if (payload.value === null || payload.value === undefined) {
    return payload.provenance.class === 'UNAVAILABLE' ? 'Unavailable' : '—';
  }
  return String(payload.value);
}
