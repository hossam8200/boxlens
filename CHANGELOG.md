# Changelog

All notable changes to BoxLens are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to a $0 recurring-cost, free-tier-only constraint.

## [2.3.0] — 2026-11-24

### Changed — Dashboards module (slice #1: 8 dashboards + modern gallery UX)
- **Modern dashboard navigation** (replaces the old sidebar). The shell is now a
  sticky topbar with brand + breadcrumb + theme toggle + a horizontal "pill
  rail" (every dashboard one click away, scrolls horizontally on narrow
  screens) and a tile-gallery landing page (`#/dashboards/`): eight large
  gradient cards — icon, title, blurb, data-class badge and a "live/daily/…
  →" status hint. Clicking a tile enters that dashboard; a back-to-gallery
  affordance is always one click away. No dropdown box anywhere.
- **Responsive** down to 390px: tiles reflow, the pill rail scrolls sideways
  inside its container, and the filter bar wraps below the title.

### Added — Eight dashboards, each its own lazy-loaded chunk
- **Executive Overview** (`routes/executive.ts`): six KPI cards (checks, pass /
  warn / fail rates, free-tier budget, active ports), 30-day pass/warn/fail
  stacked-area trend, pass/warn/fail donut, top-10 failing-rules bar, an
  active-ports Leaflet map (colour-coded by pass rate) and a drill-down table.
- **Compliance Quality**: derived totals + per-rule pass/warn/fail stacked bar,
  ISO 6346 violations weekly trend, VGM overweight declarations table, BIC
  owner-code coverage table.
- **Port Weather & Operational Risk**: Open-Meteo Marine wind/wave/swell +
  visibility per port, Nager.Date holiday calendar, and a documented
  operational-risk gauge (ESTIMATE, formula in `packages/core/src/risk.ts`).
- **Chokepoints & Disruptions**: NASA EONET storms + USGS M≥4.5 earthquakes on
  a world hazard map (LIVE); IMF PortWatch transit KPIs UNAVAILABLE (no public
  REST API).
- **Trade & Port Context**: World Bank trade % of GDP, container port
  throughput (TEU) and Logistics Performance Index per country (ANNUAL).
- **Cost & Currency**: Frankfurter ECB reference FX rates table + a SAMPLE
  freight spot estimate trend.
- **Vessel Activity (AIS)**: honest UNAVAILABLE explainer page — status cards,
  a cron → Supabase → API → UI architecture diagram, a next-steps checklist
  and a "would render here" map placeholder.
- **Platform Health (admin)**: live per-provider free-tier budget snapshot, a
  cache-hit vs error-rate overlay trend, the circuit-breaker state table and
  the provider-budget table.

### Added — Framework + core
- `app/src/dashboards/framework/charts.ts` — ECharts wrappers (line/area, bar
  horizontal+stacked, donut, gauge) with coastal-glass theming, reduced-motion
  support and ResizeObserver auto-resize. Lazy-imported so each route chunks
  separately.
- `app/src/dashboards/framework/map.ts` — Leaflet helper with circle/marker
  points, attribution and `invalidateSize` on mount.
- `app/src/dashboards/framework/gallery.ts` — pure tile-data derivation +
  DOM builder for the modern selector (unit-tested).
- `packages/core/src/risk.ts` — pure operational-risk formula
  (`weatherRisk`, `visibilityPenalty`, `holidayBump`, `congestionContribution`,
  `operationalRisk`, `riskBucket`) with 15 unit tests.

### Added — Server
- `api/_lib/providers.ts` — six keyless adapters (Open-Meteo Marine+Forecast,
  Nager.Date, Frankfurter ECB FX, World Bank, NASA EONET, USGS earthquakes)
  each routed through the cache (SWR), quota manager and per-provider circuit
  breaker with an 8s timeout. Every adapter returns a normalised domain shape.
- `api/_lib/widgets.ts` — per-widget resolver mapping `(dashboard, widgetId,
  filters)` → `WidgetPayload`. Own-app widgets read SAMPLE fixtures; external
  widgets call the provider adapters; AIS widgets return UNAVAILABLE without
  `AISSTREAM_KEY`; IMF PortWatch is always UNAVAILABLE. The resolver never
  throws.
- Expanded `api/_lib/fixtures.ts` with SAMPLE own-app-data fixtures for
  Executive, Compliance and Platform Health.

### Verified
- `npm run lint`: 0 errors. `npm run typecheck`: 0 errors.
- `npm run test`: 80/80 pass (root) + 80/80 pass (`packages/core`).
- `npm run build`: succeeds; each dashboard route is its own async chunk
  (`executive`, `compliance`, `weather`, `chokepoints`, `trade`, `cost`,
  `vessel`, `health`) plus separate `echarts` and `leaflet-src` chunks.
- Headless render check (Chrome via agent-browser): gallery shows 8 tiles + 8
  pills with no sidebar; Executive renders 6 KPI cards, 5 chart cards, a
  Leaflet map and a drill table; Vessel renders 3 UNAVAILABLE states + the
  architecture diagram + checklist; Cost degrades cleanly to UNAVAILABLE
  badges when no `/api/v1` is running (preview); 390px viewport: 8 tiles, 8
  pills, no horizontal page overflow, pill rail scrolls horizontally.

## [2.2.0] — 2026-11-24

### Added — Dashboards module (slice #0: foundation)
- **Vite + TypeScript workspace** at the repo root (`package.json`,
  `tsconfig.json`, `tsconfig.api.json`, `vite.config.ts`, `vitest.config.ts`,
  ESLint). Strict mode matching `packages/core`. The legacy single-file
  `index.html` stays live and untouched; the dashboards app is served at
  `/dashboards` via committed `app/dist` + `vercel.json` rewrites.
- **Dashboards framework** (`app/src/dashboards/framework/`): canonical types
  (`DataClass` = LIVE/DAILY/ANNUAL/ESTIMATE/SAMPLE/UNAVAILABLE, `Provenance`,
  `WidgetPayload`, `WidgetDef`, `FilterState`); data-class metadata; client
  provenance ("updated X ago", stale, badge parts); theme controller
  (light/dark, persisted); the coastal-glass design system CSS (frosted
  translucent cards on a blue-grey gradient, KPI cards with delta badges,
  data-class badges, responsive grid, RTL); widget registry (declarative
  endpoint/refresh/class/cacheTTL/fallback/export); an API client that degrades
  visibly on every failure (never throws to the UI); quota client; PNG/CSV
  export; URL-hash-synced filters (shareable views); reorderable/hideable
  layouts in localStorage with JSON import/export; DOM components (KPI card,
  chart card, drill-down table, skeleton, UNAVAILABLE state).
- **Shell + hash router** (`app/src/dashboards/shell.ts`): sidebar listing all
  eight dashboards in build order, top bar with theme toggle + global filter
  bar, content area, "Last update X ago" footer polling `/api/v1/health`.
  Routes lazy-load per dashboard; unimplemented ones show an honest placeholder
  naming the slice that lands them.
- **`/api/v1` serverless functions** (Vercel Hobby): `_lib/http` (Zod
  validation + RFC 7807 problem+json + timeout racer), `_lib/cache`
  (stale-while-revalidate with an in-memory store + optional Upstash Redis
  adapter — serves stale on fetch error), `_lib/quota` (per-provider free-tier
  budget with a sliding window + Upstash option; IMF blocked at limit 0),
  `_lib/circuitBreaker`, `_lib/provenance`, `_lib/fixtures`. Endpoints:
  `GET /api/v1/health`, `GET /api/v1/dashboards/:id`, and
  `GET /api/v1/dashboards/:id/:widget` (single widget payload with provenance).
- **Executive Overview placeholder route** proving the end-to-end pipeline
  (registry → /api/v1 → KPI card → SAMPLE badge → CSV export) with SAMPLE
  fixtures clearly badged SAMPLE. Real own-app-data KPIs land in slice #1.
- **Vitest suite (slice #0)** covering data-class, provenance age/stale/badge,
  CSV serialization, URL-hash filters, layout merge/import/export, quota
  (`isAllowed`/`checkAndIncrement`/snapshot), cache SWR (fresh/stale/error with
  fake timers), circuit breaker (closed/open/half-open), and HTTP (RFC 7807 +
  Zod + timeout).
- **`DATA_SOURCES.md`** rewritten with verified free-source findings
  (Open-Meteo, Nager.Date, Frankfurter `.dev`, World Bank, EONET, USGS,
  UN/LOCODE bundled; IMF PortWatch UNAVAILABLE — no public REST API;
  aisstream.io needs a key + cron) — terms, attribution, rate limits, cadence.
- **CI**: a `dashboards` job runs lint + typecheck + test + build for the root
  workspace alongside the existing `core` job.

### Verified
- `tsc -p tsconfig.json --noEmit` + `tsc -p tsconfig.api.json --noEmit`: 0 errors.
- `vitest run`: slice #0 suite passes.
- `vite build`: `app/dist` built (ECharts + Leaflet chunked; routes lazy-split).
- `/dashboards` served via committed `app/dist` + `vercel.json` rewrites; the
  legacy single-file app at `/` is unchanged. Total recurring cost: $0.

## [2.1.0] — 2026-11-24

### Added
- **`packages/core`** — a pure-TypeScript core library (zero DOM dependency)
  extracted from the inline demo logic. Strict mode (`strict`,
  `noUncheckedIndexedAccess`, `noUnusedLocals`/`noUnusedParameters`). Modules:
  `iso6346` (check digit, validate, normalize, `suggestCorrected`, golden
  cases), `vgm` (Method 2 + limit checks), `rules` (compliance rule engine with
  pass/warn/fail/nodata precedence), `geo` (haversine), `congestion` (port
  score), `provenance` (quality model).
- **Vitest suite** — 65 unit tests covering every spec-listed edge case:
  lowercase input, spaces and hyphens, wrong length, bad owner letters,
  non-digit serial, the ISO 6346 "remainder 10 → digit 0" rule, the
  `CSQU3054383` golden case, VGM overweight/payload (gross-only, payload-only,
  both, zero cargo), rule-engine pass/warn/fail/nodata and precedence, and
  haversine known distances.
- **ESLint + Prettier** configuration for `packages/core`.
- **esbuild** build → `packages/core/dist/boxlens-core.umd.js` (5.1 KB, IIFE,
  exposes `window.BoxLensCore`).
- **GitHub Actions CI** (`.github/workflows/ci.yml`): lint, typecheck, test,
  build on every PR and push to `main`, plus a guard that the committed bundle
  is in sync with source.
- `suggestCorrected()` — given a container number with a wrong check digit,
  returns the corrected 11-character number (powers the planned "did you mean
  …?" UX).
- `CHANGELOG.md`.

### Changed
- `index.html` now loads `packages/core/dist/boxlens-core.umd.js` and delegates
  its pure logic to `window.BoxLensCore` (ISO 6346 validate/check-digit/golden,
  VGM Method 2, the rule engine, haversine, congestion score, provenance
  badges). Function signatures and return shapes are unchanged, so no UI
  contract breaks. The deployed site still has no build step — it loads the
  prebuilt, committed bundle.
- Container-number normalisation now strips hyphens as well as whitespace (a
  strict superset of prior behaviour; previously only spaces were stripped).
  Inputs such as `MSCU-123456-7` are now accepted.

### Verified
- `tsc --noEmit` (strict): 0 errors. `eslint src tests`: 0 errors.
- `vitest run`: 65/65 pass. `esbuild` bundle: built (5.1 KB).
- Headless DOM check across all 12 routes: 0 misses.
- In-browser: `BoxLensCore` loads; golden tests pass via core; VGM overweight
  warning renders; bulk compliance produces correct pass/fail via the delegated
  rule engine; 0 console/page errors.

## [2.0.0] — 2026-11-24

### Added
- **BX services layer** — opt-in third-party integrations that activate only
  with user-supplied keys (no keys bundled): Supabase (auth + shipment sync),
  MarineTraffic (live AIS), Maersk (carrier tracking), Sentry (error tracking),
  Plausible (analytics).
- Expanded **BIC owner-code register** (25 real carrier/lessor prefixes) and
  **UN/LOCODE port directory** (43 real terminals with coordinates) — both
  key-free.
- Unified **Settings → Services & API keys** panel with live status, key
  inputs, Supabase auth UI, and the database migration SQL.

## [1.0.0] — initial release

Single-file demo build: ISO 6346 validation, VGM Method 2, facilities
directory, bulk compliance, dashboards, arrivals, methodology, admin, API
docs. Real algorithms; sample data wherever a live provider call would be.
