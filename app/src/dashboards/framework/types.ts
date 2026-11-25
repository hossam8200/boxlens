// BoxLens dashboards framework — canonical types.
// Pure data shapes shared by the widget registry, the API contract and the UI.
// No DOM, no side effects — fully unit-testable.

/**
 * Data-class badge. Every widget MUST declare one and render it.
 * - LIVE      : real-time / near-real-time source (e.g. AIS snapshot, own logs)
 * - DAILY     : refreshed once per day (e.g. FX reference rates, holidays)
 * - ANNUAL    : refreshed yearly or slower (e.g. World Bank, LPI, trade % GDP)
 * - ESTIMATE  : derived by a documented method, not a direct measurement
 *               (e.g. ETA, congestion score, risk score, anomaly flag)
 * - SAMPLE    : illustrative fixture, never presented as live
 * - UNAVAILABLE: the free tier cannot supply this; honest empty state
 */
export type DataClass =
  | 'LIVE'
  | 'DAILY'
  | 'ANNUAL'
  | 'ESTIMATE'
  | 'SAMPLE'
  | 'UNAVAILABLE';

/**
 * Provenance attached to every value. Matches the /api/v1 widget-payload
 * contract: { value, unit, class, source, fetchedAt, ttl, stale }.
 */
export interface Provenance {
  /** Which free source produced the value (e.g. "Open-Meteo Marine"). */
  source: string;
  /** ISO 8601 timestamp the value was fetched by the server. */
  fetchedAt: string;
  /** Cache TTL in seconds the server honours for this value. */
  ttl: number;
  /** True when the server served a cached value past its TTL (stale-while-revalidate). */
  stale: boolean;
  /** Data-class badge for this widget. */
  class: DataClass;
  /** Optional link to the Methodology section explaining how an ESTIMATE was derived. */
  method?: string;
  /** Optional attribution string the UI must show (e.g. "© Open-Meteo (CC-BY 4.0)"). */
  attribution?: string;
}

/** A single widget payload returned by /api/v1/dashboards/:id. */
export interface WidgetPayload<T = unknown> {
  /** The headline value (number, string, or structured object). */
  value: T | null;
  /** Unit hint for display (e.g. "%", "TEU", "m", "vessels"). */
  unit?: string;
  provenance: Provenance;
  /** Optional sparkline / trend series for KPI cards and line charts. */
  series?: number[];
  /** Optional labels aligned with `series` (e.g. dates or category names). */
  labels?: string[];
  /** Optional drill-down rows for the underlying table. */
  rows?: Record<string, string | number | null>[];
}

/** Export options a widget supports. */
export interface WidgetExport {
  png?: boolean;
  csv?: boolean;
}

/** Fallback state when the source is UNAVAILABLE or the fetch fails. */
export type FallbackState = 'stale' | 'unavailable';

/**
 * Widget registry entry. Each widget declares everything the framework needs:
 * endpoint, refresh cadence, data-class, cache TTL, fallback and exports.
 */
export interface WidgetDef {
  id: string;
  title: string;
  /** /api/v1/dashboards/:dashboardId/:widgetId — read by the quota/cache layer. */
  endpoint: string;
  /** Client refresh interval in seconds (0 = manual only). */
  refreshSec: number;
  /** Declared data-class. ESTIMATE/UNAVAILABLE widgets must explain on hover. */
  dataClass: DataClass;
  /** Server cache TTL in seconds (documented per provider in DATA_SOURCES.md). */
  cacheTtlSec: number;
  /** What to show when the value cannot be fetched. */
  fallback: FallbackState;
  export: WidgetExport;
}

/** Dashboard identifiers, in the spec's build order. */
export type DashboardId =
  | 'executive'
  | 'compliance'
  | 'weather'
  | 'chokepoints'
  | 'trade'
  | 'cost'
  | 'vessel'
  | 'health'
  | 'classic-analytics';

/** Global filter state. Synced to the URL hash so views are shareable. */
export interface FilterState {
  /** UN/LOCODE of the selected port (e.g. "DEHAM"). */
  port?: string;
  /** ISO 3166-1 alpha-2 country code (e.g. "DE"). */
  country?: string;
  /** ISO date range. */
  from?: string;
  to?: string;
  /** Compare current range to the previous equivalent period. */
  compare?: boolean;
}

/** Quota budget exposed to the UI by /api/v1/health. */
export interface ProviderBudget {
  provider: string;
  /** Calls used in the current window. */
  used: number;
  /** Calls allowed in the current window on the free tier. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
  healthy: boolean;
}

export interface HealthPayload {
  status: 'ok' | 'degraded' | 'down';
  time: string;
  /** Free-tier budget used across all providers, 0–100. */
  budgetUsedPct: number;
  providers: ProviderBudget[];
}
