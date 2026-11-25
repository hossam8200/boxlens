// Own-app-data SAMPLE fixtures (executive, compliance, health). Clearly
// badged SAMPLE so they are never mistaken for live data — the demo build has
// no real check-log DB behind it. Production replaces these with reads from
// the application database (check_logs, rule_results, provider_health).
import { buildProvenance } from './provenance.js';
import type { WidgetPayload } from '../../app/src/dashboards/framework/types.js';

const SAMPLE_PROV = {
  source: 'BoxLens (fixture)',
  ttl: 60,
  class: 'SAMPLE' as const,
  attribution: 'Illustrative — slice #1 wires own logs',
};

const EXECUTIVE: Record<string, WidgetPayload> = {
  'checks-today': {
    value: 1284,
    provenance: buildProvenance(SAMPLE_PROV),
    series: [1180, 1220, 1245, 1280, 1260, 1305, 1284],
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
  'pass-rate': {
    value: 94.2,
    unit: '%',
    provenance: buildProvenance(SAMPLE_PROV),
    series: [91.2, 92.0, 92.8, 93.5, 93.1, 93.8, 94.2],
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
  'warn-rate': {
    value: 4.1,
    unit: '%',
    provenance: buildProvenance(SAMPLE_PROV),
    series: [5.0, 4.6, 4.4, 4.2, 4.5, 4.3, 4.1],
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
  'fail-rate': {
    value: 1.7,
    unit: '%',
    provenance: buildProvenance(SAMPLE_PROV),
    series: [3.8, 3.4, 2.8, 2.3, 2.4, 1.9, 1.7],
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
  'free-tier-budget': {
    value: 18,
    unit: '%',
    provenance: buildProvenance(SAMPLE_PROV),
    series: [12, 13, 14, 15, 16, 17, 18],
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
  'active-ports': {
    value: 6,
    unit: 'ports monitored',
    provenance: buildProvenance(SAMPLE_PROV),
    rows: [
      { Port: 'Hamburg (DEHAM)', Country: 'DE', Lat: 53.54, Lng: 9.98, Checks: 318, 'Pass %': 95.3 },
      { Port: 'Rotterdam (NLRTM)', Country: 'NL', Lat: 51.95, Lng: 4.07, Checks: 412, 'Pass %': 96.1 },
      { Port: 'Singapore (SGSGP)', Country: 'SG', Lat: 1.26, Lng: 103.84, Checks: 287, 'Pass %': 97.0 },
      { Port: 'Shanghai (CNSHA)', Country: 'CN', Lat: 31.22, Lng: 121.48, Checks: 156, 'Pass %': 89.7 },
      { Port: 'Los Angeles (USLAX)', Country: 'US', Lat: 33.74, Lng: -118.27, Checks: 71, 'Pass %': 92.9 },
      { Port: 'Dubai (AEDXB)', Country: 'AE', Lat: 25.27, Lng: 55.30, Checks: 40, 'Pass %': 90.0 },
    ],
  },
  'top-failures': {
    value: null,
    provenance: buildProvenance(SAMPLE_PROV),
    rows: [
      { Rule: 'ISO 6346 check digit', Hits: 42, 'Pass %': 96 },
      { Rule: 'Owner code (BIC)', Hits: 18, 'Pass %': 91 },
      { Rule: 'Size/type (ISO 6346)', Hits: 14, 'Pass %': 93 },
      { Rule: 'VGM overweight', Hits: 7, 'Pass %': 99 },
      { Rule: 'Max payload', Hits: 6, 'Pass %': 99 },
      { Rule: 'CSC plate validity', Hits: 5, 'Pass %': 98 },
      { Rule: 'Tare weight match', Hits: 4, 'Pass %': 99 },
      { Rule: 'Reefer temp set', Hits: 3, 'Pass %': 99 },
      { Rule: 'Tank IMO class', Hits: 2, 'Pass %': 100 },
      { Rule: 'Smart container id', Hits: 1, 'Pass %': 100 },
    ],
  },
};

const COMPLIANCE: Record<string, WidgetPayload> = {
  'rule-matrix': {
    value: null,
    provenance: buildProvenance(SAMPLE_PROV),
    rows: [
      { Rule: 'ISO 6346 check digit', Pass: 1284, Warn: 12, Fail: 3 },
      { Rule: 'Owner code (BIC)', Pass: 410, Warn: 5, Fail: 1 },
      { Rule: 'Size/type code', Pass: 386, Warn: 4, Fail: 0 },
      { Rule: 'VGM Method 2', Pass: 305, Warn: 1, Fail: 0 },
      { Rule: 'Max payload', Pass: 412, Warn: 0, Fail: 1 },
      { Rule: 'CSC plate validity', Pass: 280, Warn: 8, Fail: 1 },
      { Rule: 'Tare weight match', Pass: 412, Warn: 0, Fail: 0 },
      { Rule: 'Reefer temperature', Pass: 95, Warn: 2, Fail: 0 },
    ],
  },
  'owner-coverage': {
    value: 92.4,
    unit: '% of containers with valid BIC owner',
    provenance: buildProvenance(SAMPLE_PROV),
    rows: [
      { Owner: 'MAEU (Maersk)', Containers: 312, 'Valid %': 99.4 },
      { Owner: 'MSCU (MSC)', Containers: 287, 'Valid %': 98.9 },
      { Owner: 'CMAU (CMA CGM)', Containers: 198, 'Valid %': 97.5 },
      { Owner: 'CIXU (Cosco)', Containers: 154, 'Valid %': 96.8 },
      { Owner: 'HLCU (Hapag-Lloyd)', Containers: 121, 'Valid %': 99.1 },
      { Owner: 'ONEU (ONE)', Containers: 89, 'Valid %': 95.5 },
      { Owner: 'Unknown', Containers: 123, 'Valid %': 0.0 },
    ],
  },
  'iso-violations': {
    value: 17,
    unit: 'check-digit violations (30d)',
    provenance: buildProvenance(SAMPLE_PROV),
    series: [4, 3, 2, 3, 2, 1, 2],
    labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'],
    rows: [
      { Sample: 'CSQU3054382', Issue: 'Check digit should be 3, got 2' },
      { Sample: 'MSCU6639821', Issue: 'Check digit should be 7, got 1' },
      { Sample: 'TCLU8493019', Issue: 'Check digit should be 4, got 9' },
    ],
  },
  'vgm-overweight': {
    value: 7,
    unit: 'overweight declarations (30d)',
    provenance: buildProvenance(SAMPLE_PROV),
    rows: [
      { Container: 'MSCU3712884', 'VGM (kg)': 30450, 'Max gross (kg)': 30480, 'Over by (kg)': 0, Status: 'Warn' },
      { Container: 'CSQU2847190', 'VGM (kg)': 31200, 'Max gross (kg)': 30480, 'Over by (kg)': 720, Status: 'Fail' },
      { Container: 'CMAU5290184', 'VGM (kg)': 30900, 'Max gross (kg)': 30480, 'Over by (kg)': 420, Status: 'Fail' },
    ],
  },
};

const HEALTH_FIXTURES: Record<string, WidgetPayload> = {
  'cache-hit-rate': {
    value: 91.3,
    unit: '% cache hit',
    provenance: buildProvenance(SAMPLE_PROV),
    series: [86, 88, 87, 90, 89, 91, 91.3],
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
  'error-rate': {
    value: 0.6,
    unit: '% 5xx / hour',
    provenance: buildProvenance(SAMPLE_PROV),
    series: [1.2, 0.9, 1.0, 0.7, 0.8, 0.5, 0.6],
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
  'breaker-state': {
    value: 'closed',
    unit: 'all providers',
    provenance: buildProvenance(SAMPLE_PROV),
    rows: [
      { Provider: 'open-meteo', State: 'closed', Failures: 0 },
      { Provider: 'nager-date', State: 'closed', Failures: 0 },
      { Provider: 'frankfurter', State: 'closed', Failures: 0 },
      { Provider: 'world-bank', State: 'closed', Failures: 0 },
      { Provider: 'eonet', State: 'closed', Failures: 0 },
      { Provider: 'usgs', State: 'closed', Failures: 0 },
      { Provider: 'aisstream', State: 'open', Failures: 5 },
      { Provider: 'imf', State: 'blocked', Failures: 0 },
    ],
  },
};

const UNKNOWN_FIXTURE_PROV = {
  source: 'BoxLens',
  ttl: 60,
  class: 'UNAVAILABLE' as const,
  attribution: 'Widget not registered',
};

/** Return the SAMPLE payload for an executive widget, or UNAVAILABLE if unknown. */
export function executiveWidget(widgetId: string): WidgetPayload {
  return (
    EXECUTIVE[widgetId] ?? {
      value: null,
      provenance: buildProvenance({
        ...UNKNOWN_FIXTURE_PROV,
        method: `Executive widget "${widgetId}" is not registered.`,
      }),
    }
  );
}

/** Return the SAMPLE payload for a compliance widget, or UNAVAILABLE if unknown. */
export function complianceWidget(widgetId: string): WidgetPayload {
  return (
    COMPLIANCE[widgetId] ?? {
      value: null,
      provenance: buildProvenance({
        ...UNKNOWN_FIXTURE_PROV,
        method: `Compliance widget "${widgetId}" is not registered.`,
      }),
    }
  );
}

/** Return the SAMPLE payload for a platform-health widget (non-budget), or UNAVAILABLE if unknown. */
export function healthWidget(widgetId: string): WidgetPayload {
  return (
    HEALTH_FIXTURES[widgetId] ?? {
      value: null,
      provenance: buildProvenance({
        ...UNKNOWN_FIXTURE_PROV,
        method: `Health widget "${widgetId}" is not registered.`,
      }),
    }
  );
}

/** All executive widget payloads (for /api/v1/dashboards/executive). */
export function executiveWidgets(): { widget: string; payload: WidgetPayload }[] {
  return Object.entries(EXECUTIVE).map(([widget, payload]) => ({ widget, payload }));
}

/** All compliance widget payloads (for /api/v1/dashboards/compliance). */
export function complianceWidgets(): { widget: string; payload: WidgetPayload }[] {
  return Object.entries(COMPLIANCE).map(([widget, payload]) => ({ widget, payload }));
}
