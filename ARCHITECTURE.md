# ARCHITECTURE.md

This document records the intended enterprise architecture from the BoxLens
build prompt, and maps it to what the demo build delivers and what a
production cut would add.

## Intended architecture (target production)

A **modular monolith** with clear boundaries so modules can split into
services later:

```
api/         routers + Pydantic schemas (FastAPI, /api/v1)
core/        config, security, logging, structured errors
domain/      pure business logic: container_number (ISO 6346), vgm,
             compliance, facility, arrivals, scoring
providers/   one client per external source behind a shared interface
             (retry, circuit breaker, timeout, usage metering)
data/        repositories + SQLAlchemy models (Postgres + PostGIS)
jobs/        scheduled tasks (Celery / ARQ)
reports/     PDF / XLSX / CSV generation
```

Central rules:

1. **Every module reads from a canonical internal schema** through
   `ContainerService`, `FacilityService`, `VesselService`. Nothing outside
   `providers/` may call an external API.
2. **Every record carries provenance**: `source`, `fetched_at`,
   `source_version`, `quality` (ok | partial | missing | stale | conflict).
3. **Provider budget guard**: a central quota manager enforces global and
   per-tenant call budgets, coalesces duplicate in-flight requests, caches
   aggressively, and serves stale data with a visible badge when a provider
   is slow, limited, or down.

Target stack: Python 3.12 + FastAPI + Pydantic v2 + SQLAlchemy 2 + Alembic +
httpx (async, retries, timeouts); Postgres + PostGIS; Redis; Celery/ARQ;
React 18 + TypeScript + Vite + TanStack Query + Tailwind + MapLibre GL +
ECharts; OIDC/OAuth2 + JWT refresh rotation + optional SAML SSO + TOTP MFA;
Docker + docker-compose + Helm/K8s + Terraform + GitHub Actions;
OpenTelemetry + Prometheus + structured JSON logs + Sentry.

## What this demo build delivers

A single self-contained `index.html` (no build step, no backend) that
implements the **MVP core and every module's UX**, using real algorithms
where they are deterministic and sample data where a live provider would be:

| Module | Real / sample | Notes |
| --- | --- | --- |
| Check — ISO 6346 validator | **Real algorithm** | Letter map (skip multiples of 11), powers of 2, mod 11, mod 10. Golden tests anchored to the Wikipedia CSQU3054383 example. |
| Check — owner + spec lookup | Sample `OWNERS` / `CONTAINERS` | Modelled on BIC Codes + BIC BoxTech. Provenance badges, stale-state, manual-entry (unverified) path. |
| Check — VGM Method 2 | **Real arithmetic** | VGM = tare + cargo + packing + dunnage; overweight vs max gross / max payload warnings; printable draft declaration sheet (never certified). |
| Facilities | Sample `FACILITIES` | Directory, code translator (CSV out), Leaflet map with geofence, nearest-facility (real haversine). |
| Compliance | **Real rule engine** | Bulk CSV upload (async batch), configurable rules (data, versioned), per-row pass/warn/fail/nodata + reason codes, data-gap + owner-coverage reports. |
| Workflow | localStorage | Shipments, watchlists, alerts (in-app/email/webhook/WhatsApp adapter). |
| Dashboards | ECharts | 7 dashboards + widget framework + export PNG + freshness badge. |
| Arrivals | Sample `VESSELS` / `WEATHER` / `HOLIDAYS` | Vessel states, congestion score (real heuristic), weather risk, holiday risk, combination timeline. Honesty rule enforced. |
| Enterprise layer | UI surfaces | Provider status/budget, audit log (localStorage), feature flags, plans, API docs (RFC 7807), per-tenant branding hooks. |

## Production cut — what to add

- Replace the six sample objects with provider clients behind `ProviderInterface`.
- Add FastAPI `/api/v1` matching `API Docs` page; Postgres + PostGIS for
  facility points/geofences and spatial nearest queries; Redis for cache +
  rate-limit; Celery/ARQ for bulk jobs.
- Implement real auth (OIDC/JWT + MFA + SAML), RBAC, multi-tenant row
  isolation + RLS, API keys with scopes/quotas, HMAC webhooks.
- Move reports to server-side PDF/XLSX (the VGM sheet and executive summary
  currently use the browser print path).
- Add OpenTelemetry + Prometheus + structured logs; k6/Locust load tests
  including provider-budget exhaustion; Playwright E2E; axe accessibility CI.

## Folder layout of this demo

```
download/
  index.html                       the whole app (inline CSS + JS, CDN libs)
  README.md
  ARCHITECTURE.md
  DATA_SOURCES.md
  LICENSE
  .gitignore
  netlify.toml                     Netlify config
  vercel.json                      Vercel config
  deploy.sh                        one-command deploy helpers
  .github/workflows/deploy-pages.yml   GitHub Pages auto-deploy
```

## Dashboards module (slice #0, Vite + TypeScript + Vercel)

The enterprise dashboards module sits alongside the legacy single-file app
(which stays live at `/`). It is built with **Vite + TypeScript + ECharts +
Leaflet**, served at **`/dashboards`** via committed `app/dist` +
`vercel.json` rewrites, with **`/api/v1`** serverless functions on Vercel
Hobby. Total recurring cost: $0.

```
app/                     Vite+TS dashboards app (served at /dashboards)
  src/dashboards/
    framework/           types, dataClass, provenance, theme, styles,
                         registry, api(client), quotaClient, export,
                         filters, layout, components
    routes/              one lazy-loaded module per dashboard
    shell.ts             sidebar + top bar + hash router + footer
api/
  _lib/                  http(Zod+RFC7807), cache(SWR), quota, provenance,
                         circuitBreaker, vercel(types), fixtures
  v1/                    health.ts, dashboards/[id].ts, dashboards/[id]/[widget].ts
packages/core/           pure logic (iso6346, vgm, rules, geo, congestion,
                         provenance) — imported by the app via a Vite alias
```

Contract: every widget payload is `{ value, unit, provenance: { source,
fetchedAt, ttl, stale, class, method?, attribution? } }`. The `class` is one of
LIVE / DAILY / ANNUAL / ESTIMATE / SAMPLE / UNAVAILABLE and renders as a badge
with source + "updated X ago" on every KPI and chart. Every external call goes
through the quota manager and cache; every failure degrades to a stale value
or an explicit UNAVAILABLE state — never an empty chart.

Eight dashboards land one per slice, in the spec's build order. Free sources
are verified in `DATA_SOURCES.md`; IMF PortWatch has no public REST API
(UNAVAILABLE) and aisstream.io needs a key + cron (UNAVAILABLE until supplied).
