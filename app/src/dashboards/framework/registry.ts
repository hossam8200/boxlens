// Widget registry: declarative definitions for every widget across all 8
// dashboards. Each entry carries endpoint, refresh cadence, data-class, cache
// TTL, fallback and export options — everything the framework needs to render
// a badge, poll on a timer, and degrade honestly on failure.
import type { DashboardId, WidgetDef } from './types';

export interface DashboardMeta {
  id: DashboardId;
  title: string;
  icon: string;
  /** Headline data-class for the dashboard (shown on the gallery tile + pills). */
  dataClass: WidgetDef['dataClass'];
  order: number;
}

/** The eight dashboards, in the spec's build order. */
export const DASHBOARD_CATALOG: ReadonlyArray<DashboardMeta> = Object.freeze([
  { id: 'executive', title: 'Executive Overview', icon: '📊', dataClass: 'DAILY', order: 1 },
  { id: 'compliance', title: 'Compliance Quality', icon: '✅', dataClass: 'DAILY', order: 2 },
  { id: 'weather', title: 'Port Weather & Risk', icon: '🌊', dataClass: 'DAILY', order: 3 },
  { id: 'chokepoints', title: 'Chokepoints & Disruptions', icon: '🗺️', dataClass: 'LIVE', order: 4 },
  { id: 'trade', title: 'Trade & Port Context', icon: '📈', dataClass: 'ANNUAL', order: 5 },
  { id: 'cost', title: 'Cost & Currency', icon: '💱', dataClass: 'DAILY', order: 6 },
  { id: 'vessel', title: 'Vessel Activity (AIS)', icon: '🚢', dataClass: 'UNAVAILABLE', order: 7 },
  { id: 'health', title: 'Platform Health', icon: '🩺', dataClass: 'LIVE', order: 8 },
  { id: 'classic-analytics', title: 'Classic Analytics', icon: '📐', dataClass: 'DAILY', order: 9 },
]);

const WIDGETS = new Map<string, WidgetDef>();

export function widgetKey(dashboard: DashboardId, widgetId: string): string {
  return `${dashboard}/${widgetId}`;
}

export function registerWidget(def: WidgetDef, dashboard: DashboardId): void {
  WIDGETS.set(widgetKey(dashboard, def.id), def);
}

export function getWidget(dashboard: DashboardId, widgetId: string): WidgetDef | undefined {
  return WIDGETS.get(widgetKey(dashboard, widgetId));
}

export function getDashboardWidgets(dashboard: DashboardId): WidgetDef[] {
  const out: WidgetDef[] = [];
  for (const [k, def] of WIDGETS) {
    if (k.startsWith(`${dashboard}/`)) out.push(def);
  }
  return out;
}

export function getDashboardMeta(id: DashboardId): DashboardMeta | undefined {
  return DASHBOARD_CATALOG.find((d) => d.id === id);
}

// ---- Registration for all 8 dashboards ----
// Each widget's dataClass/refreshSec/cacheTtlSec matches DATA_SOURCES.md and
// the server-side resolver in api/_lib/widgets.ts.

// 1. Executive Overview — real operational compliance from Open-Meteo marine
// conditions per port in the filter scope (DAILY); free-tier budget is LIVE
// quota. No SAMPLE fixtures.
registerWidget(
  { id: 'checks-today', title: 'Checks today', endpoint: '/api/v1/dashboards/executive/checks-today', refreshSec: 1800, dataClass: 'DAILY', cacheTtlSec: 1800, fallback: 'unavailable', export: { csv: true } },
  'executive',
);
registerWidget(
  { id: 'pass-rate', title: 'Pass rate', endpoint: '/api/v1/dashboards/executive/pass-rate', refreshSec: 1800, dataClass: 'DAILY', cacheTtlSec: 1800, fallback: 'unavailable', export: { csv: true } },
  'executive',
);
registerWidget(
  { id: 'warn-rate', title: 'Warn rate', endpoint: '/api/v1/dashboards/executive/warn-rate', refreshSec: 1800, dataClass: 'DAILY', cacheTtlSec: 1800, fallback: 'unavailable', export: { csv: true } },
  'executive',
);
registerWidget(
  { id: 'fail-rate', title: 'Fail rate', endpoint: '/api/v1/dashboards/executive/fail-rate', refreshSec: 1800, dataClass: 'DAILY', cacheTtlSec: 1800, fallback: 'unavailable', export: { csv: true } },
  'executive',
);
registerWidget(
  { id: 'free-tier-budget', title: 'Free-tier budget used', endpoint: '/api/v1/dashboards/executive/free-tier-budget', refreshSec: 60, dataClass: 'LIVE', cacheTtlSec: 60, fallback: 'unavailable', export: { csv: true } },
  'executive',
);
registerWidget(
  { id: 'active-ports', title: 'Active ports', endpoint: '/api/v1/dashboards/executive/active-ports', refreshSec: 1800, dataClass: 'DAILY', cacheTtlSec: 1800, fallback: 'unavailable', export: { csv: true } },
  'executive',
);
registerWidget(
  { id: 'top-failures', title: 'Top 10 operational risks', endpoint: '/api/v1/dashboards/executive/top-failures', refreshSec: 1800, dataClass: 'DAILY', cacheTtlSec: 1800, fallback: 'unavailable', export: { csv: true } },
  'executive',
);
registerWidget(
  { id: 'port-characteristics', title: 'Port characteristics (NGA Pub 150)', endpoint: '/api/v1/dashboards/executive/port-characteristics', refreshSec: 604800, dataClass: 'ANNUAL', cacheTtlSec: 604800, fallback: 'unavailable', export: { csv: true } },
  'executive',
);
registerWidget(
  { id: 'nearby-terminals', title: 'Nearby terminals & depots (OSM)', endpoint: '/api/v1/dashboards/executive/nearby-terminals', refreshSec: 86400, dataClass: 'DAILY', cacheTtlSec: 86400, fallback: 'unavailable', export: { csv: true } },
  'executive',
);

// 2. Compliance Quality — real operational compliance from Open-Meteo marine
// conditions per port (DAILY); vgm-overweight is an ESTIMATE proxy (no free
// container-weight feed).
registerWidget(
  { id: 'rule-matrix', title: 'Per-rule pass/warn/fail', endpoint: '/api/v1/dashboards/compliance/rule-matrix', refreshSec: 1800, dataClass: 'DAILY', cacheTtlSec: 1800, fallback: 'unavailable', export: { csv: true } },
  'compliance',
);
registerWidget(
  { id: 'owner-coverage', title: 'Country coverage', endpoint: '/api/v1/dashboards/compliance/owner-coverage', refreshSec: 1800, dataClass: 'DAILY', cacheTtlSec: 1800, fallback: 'unavailable', export: { csv: true } },
  'compliance',
);
registerWidget(
  { id: 'iso-violations', title: 'Operational violations', endpoint: '/api/v1/dashboards/compliance/iso-violations', refreshSec: 1800, dataClass: 'DAILY', cacheTtlSec: 1800, fallback: 'unavailable', export: { csv: true } },
  'compliance',
);
registerWidget(
  { id: 'vgm-overweight', title: 'VGM overweight (est.)', endpoint: '/api/v1/dashboards/compliance/vgm-overweight', refreshSec: 1800, dataClass: 'ESTIMATE', cacheTtlSec: 1800, fallback: 'unavailable', export: { csv: true } },
  'compliance',
);

// 3. Port Weather & Risk — Open-Meteo Marine (DAILY) + risk score (ESTIMATE).
registerWidget(
  { id: 'marine-snapshot', title: 'Marine snapshot', endpoint: '/api/v1/dashboards/weather/marine-snapshot', refreshSec: 1800, dataClass: 'DAILY', cacheTtlSec: 1800, fallback: 'stale', export: { csv: true } },
  'weather',
);
registerWidget(
  { id: 'risk-score', title: 'Operational risk score', endpoint: '/api/v1/dashboards/weather/risk-score', refreshSec: 1800, dataClass: 'ESTIMATE', cacheTtlSec: 1800, fallback: 'stale', export: { csv: true } },
  'weather',
);
registerWidget(
  { id: 'holidays', title: 'Public holidays', endpoint: '/api/v1/dashboards/weather/holidays', refreshSec: 86400, dataClass: 'DAILY', cacheTtlSec: 86400, fallback: 'unavailable', export: { csv: true } },
  'weather',
);

// 4. Chokepoints — NASA EONET + USGS (LIVE); IMF PortWatch transit (UNAVAILABLE).
registerWidget(
  { id: 'eonet-events', title: 'NASA EONET open events', endpoint: '/api/v1/dashboards/chokepoints/eonet-events', refreshSec: 3600, dataClass: 'LIVE', cacheTtlSec: 3600, fallback: 'stale', export: { csv: true } },
  'chokepoints',
);
registerWidget(
  { id: 'usgs-quakes', title: 'USGS M≥4.5 quakes', endpoint: '/api/v1/dashboards/chokepoints/usgs-quakes', refreshSec: 3600, dataClass: 'LIVE', cacheTtlSec: 3600, fallback: 'stale', export: { csv: true } },
  'chokepoints',
);
registerWidget(
  { id: 'transit-kpis', title: 'IMF PortWatch transit KPIs', endpoint: '/api/v1/dashboards/chokepoints/transit-kpis', refreshSec: 3600, dataClass: 'UNAVAILABLE', cacheTtlSec: 60, fallback: 'unavailable', export: {} },
  'chokepoints',
);
registerWidget(
  { id: 'sea-route', title: 'Sea route & ETA (major lanes)', endpoint: '/api/v1/dashboards/chokepoints/sea-route', refreshSec: 604800, dataClass: 'ESTIMATE', cacheTtlSec: 604800, fallback: 'unavailable', export: { csv: true } },
  'chokepoints',
);

// 5. Trade & Port Context — World Bank (ANNUAL).
registerWidget(
  { id: 'trade-gdp-pct', title: 'Trade (% of GDP)', endpoint: '/api/v1/dashboards/trade/trade-gdp-pct', refreshSec: 604800, dataClass: 'ANNUAL', cacheTtlSec: 604800, fallback: 'stale', export: { csv: true } },
  'trade',
);
registerWidget(
  { id: 'container-throughput', title: 'Container port throughput', endpoint: '/api/v1/dashboards/trade/container-throughput', refreshSec: 604800, dataClass: 'ANNUAL', cacheTtlSec: 604800, fallback: 'stale', export: { csv: true } },
  'trade',
);
registerWidget(
  { id: 'lpi-overall', title: 'Logistics Performance Index', endpoint: '/api/v1/dashboards/trade/lpi-overall', refreshSec: 604800, dataClass: 'ANNUAL', cacheTtlSec: 604800, fallback: 'stale', export: { csv: true } },
  'trade',
);

// 6. Cost & Currency — Frankfurter ECB FX (DAILY) + freight index (SAMPLE).
registerWidget(
  { id: 'fx-rates', title: 'ECB reference FX rates', endpoint: '/api/v1/dashboards/cost/fx-rates', refreshSec: 43200, dataClass: 'DAILY', cacheTtlSec: 43200, fallback: 'stale', export: { csv: true } },
  'cost',
);
registerWidget(
  { id: 'freight-index', title: 'Freight spot estimate', endpoint: '/api/v1/dashboards/cost/freight-index', refreshSec: 86400, dataClass: 'SAMPLE', cacheTtlSec: 86400, fallback: 'unavailable', export: { csv: true } },
  'cost',
);

// 7. Vessel Activity (AIS) — UNAVAILABLE without AISSTREAM_KEY + cron.
registerWidget(
  { id: 'ais-snapshot', title: 'Live vessel snapshot', endpoint: '/api/v1/dashboards/vessel/ais-snapshot', refreshSec: 300, dataClass: 'UNAVAILABLE', cacheTtlSec: 60, fallback: 'unavailable', export: {} },
  'vessel',
);
registerWidget(
  { id: 'ais-port-density', title: 'Port vessel density', endpoint: '/api/v1/dashboards/vessel/ais-port-density', refreshSec: 300, dataClass: 'UNAVAILABLE', cacheTtlSec: 60, fallback: 'unavailable', export: {} },
  'vessel',
);
registerWidget(
  { id: 'voyage-eta', title: 'Voyage ETA (major lanes)', endpoint: '/api/v1/dashboards/vessel/voyage-eta', refreshSec: 604800, dataClass: 'ESTIMATE', cacheTtlSec: 604800, fallback: 'unavailable', export: { csv: true } },
  'vessel',
);

// 8. Platform Health — admin (LIVE budget + SAMPLE own-app fixtures).
registerWidget(
  { id: 'budget-used', title: 'Free-tier budget used', endpoint: '/api/v1/dashboards/health/budget-used', refreshSec: 60, dataClass: 'LIVE', cacheTtlSec: 60, fallback: 'stale', export: { csv: true } },
  'health',
);
registerWidget(
  { id: 'cache-hit-rate', title: 'Cache hit rate', endpoint: '/api/v1/dashboards/health/cache-hit-rate', refreshSec: 60, dataClass: 'SAMPLE', cacheTtlSec: 60, fallback: 'unavailable', export: { csv: true } },
  'health',
);
registerWidget(
  { id: 'error-rate', title: 'API error rate', endpoint: '/api/v1/dashboards/health/error-rate', refreshSec: 60, dataClass: 'SAMPLE', cacheTtlSec: 60, fallback: 'unavailable', export: { csv: true } },
  'health',
);
registerWidget(
  { id: 'breaker-state', title: 'Circuit breaker state', endpoint: '/api/v1/dashboards/health/breaker-state', refreshSec: 60, dataClass: 'SAMPLE', cacheTtlSec: 60, fallback: 'unavailable', export: { csv: true } },
  'health',
);
