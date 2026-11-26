# BoxLens — Container Compliance &amp; Port Intelligence

BoxLens is an enterprise-grade SaaS concept for the container shipping supply
chain: it helps forwarders, shippers, agents, terminals, depots and hauliers
avoid rejected gate-ins, weight errors, EDI exceptions and surprise delays by
unifying open industry data behind one clean product.

This repository is a **single-file demo build** (one `index.html` plus a
prebuilt core bundle) that implements the MVP core and the UX of all six
modules. The **real algorithms** — ISO 6346 check digit, VGM Method 2, the
compliance rule engine, haversine nearest-facility, the congestion heuristic
and the provenance model — live in [`packages/core`](packages/core), a
pure-TypeScript library with strict types and full Vitest coverage (65 tests).
The app loads the prebuilt, committed bundle, so the **deployed site still has
no build step**; **sample data** is used wherever a live provider call would
be.

> ⚠ **Legal positioning.** BoxLens assists with data and calculations only. It
> does **not** certify a VGM, does not replace the shipper's legal
> responsibility under SOLAS VI/2, and must never present estimates or missing
> data as official facts. Disclaimers appear in the UI, PDFs and API docs.

---

## Core package (`packages/core`)

The product's pure logic is extracted into a typed, tested, DOM-free library:

| Module | Exports | Notes |
| --- | --- | --- |
| `iso6346` | `checkDigit`, `validate`, `normalize`, `suggestCorrected`, `LETTER_VALUES`, `GOLDEN`, `runGoldenTests` | Authoritative ISO 6346 algorithm; `CSQU3054383` anchors the Wikipedia worked example. |
| `vgm` | `computeMethod2`, `checkLimits`, `evaluate` | SOLAS VI/2 Method 2: tare + cargo, with max-gross / max-payload checks. |
| `rules` | `RULES`, `evaluate` | Compliance engine: pass / warn / fail / nodata with documented precedence. |
| `geo` | `haversine` | Great-circle distance (R = 6371 km). |
| `congestion` | `score` | Port congestion 0–100 (queue × 8 + waiting × 15, capped). |
| `provenance` | `qualityBadgeParts`, `provenanceClass`, `QUALITY_STATES` | ok / partial / missing / stale / conflict. |

```bash
cd packages/core
npm install
npm test            # vitest — 65 tests
npm run typecheck   # tsc --noEmit (strict)
npm run build       # esbuild -> dist/boxlens-core.umd.js (window.BoxLensCore)
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, test and build on every
PR and push to `main`, and guards that the committed bundle stays in sync with
source. See [`CHANGELOG.md`](CHANGELOG.md) for version history.

---

## What's inside

| Module | What you can do |
| --- | --- |
| **Check** | Validate any container number with the real ISO 6346 check-digit algorithm; look up owner (BIC Codes) + technical/safety data (BIC BoxTech) with provenance badges; VGM Method 2 assistant that warns on overweight/payload limits and prints a **draft** declaration sheet; manual-entry path for unknown containers (stored as unverified, never mixed with source data). |
| **Facilities** | Search the terminal/depot directory by name, code, country or UN/LOCODE; paste EDI codes into the **facility code translator** (CSV export); Leaflet map with a sample geofence; nearest-facility drop-off helper (real haversine). |
| **Compliance** | Bulk-validate bookings via CSV paste (or generate 5,000 sample rows); a configurable **rule engine** (rules are data, versioned per tenant) produces per-row pass/warning/fail/no-data with reason codes; data-gap report (by owner/country) and owner-coverage trend. |
| **Workflow** | Saved shipments (localStorage), watchlists and alerts with channel selection (in-app/email/webhook/WhatsApp via adapter). |
| **Dashboards** | Seven ECharts dashboards — shipment compliance, data coverage, gate &amp; yard, facility map, arrivals &amp; congestion, combination view, executive summary — with a widget framework, PNG export, and a data-freshness badge on every widget. |
| **Arrivals** | Vessel states (approaching/waiting/alongside), queue length, a simple congestion score, port weather (Open-Meteo Marine), port holidays (Nager.Date), and a combination timeline. The **honesty rule** (AIS shows vessels, not containers) is enforced in copy. |
| **Methodology** | Documented sources, terms, attribution, limits, cadence and failure modes; VGM logic; rule library; congestion formula; the eight honesty rules; the provenance model. |
| **Admin** | Provider health + budget, feature flags, plans, and an immutable-style audit log. |
| **API docs** | The intended `/api/v1` contract (versioned, RFC 7807 errors, idempotency keys, HMAC webhooks). |

## Features & Capabilities

The platform's **landing page is the visual tour** — [`boxlens-features.html`](./boxlens-features.html),
an enterprise scroll-snap slide deck (glassmorphism, real container-terminal imagery)
showcasing every capability below. On Vercel it is served at the root
(`https://boxlens.vercel.app/` → `boxlens-features.html` via `vercel.json`); the last
slide's **Open BoxLens** button enters the application at `/dashboards` (the path
`/app` is avoided because Vercel's filesystem routing would serve the Vite source
`app/index.html` for it instead of the built `app/dist/index.html`).

| Pillar | What it does | Data source | Class |
| --- | --- | --- | --- |
| **Container compliance** | ISO 6346 check-digit validation (re-computed, not looked up), BIC owner + BoxTech technical/safety data, manual-entry unverified path. | BIC Codes, BIC BoxTech, ISO 6346 | LIVE / ANNUAL |
| **VGM Method 2** | Tare + cargo arithmetic, overweight/payload warnings, DRAFT declaration sheet (never certified), smart search + ISO 6346 anatomy. | arithmetic | ESTIMATE |
| **Port intelligence** | Nearest-port matching by great-circle distance; channel/pier/anchorage depth, tidal range, harbor size, max vessel, entrance restrictions; **nearby-terminals** widget — diversion berths within 60 km (no Overpass dependency). | NGA World Port Index (Pub 150) | ANNUAL |
| **Trade & macro context** | Top-N countries by trade % of GDP, container throughput (TEU) and Logistics Performance Index — ranked horizontal bar charts, aggregate regions excluded, real countries only. | World Bank Open Data (mrnev=1) | ANNUAL |
| **Live operational** | Marine conditions (wave/swell/wind/visibility), earthquakes, geological events, FX reference rates, port holidays — under a visible provider-budget guard with SWR cache + circuit breakers. | Open-Meteo, USGS, NASA EONET, Frankfurter/ECB, Nager.Date | LIVE / DAILY |
| **Compliance rule engine** | Configurable, versioned-per-tenant rules → per-row pass/warn/fail/no-data with reason codes; bulk CSV (5,000 rows); data-gap + owner-coverage reports. | rule library | ESTIMATE |
| **Provenance & honesty** | Data-class badge on every number (LIVE/DAILY/ANNUAL/ESTIMATE/SAMPLE/UNAVAILABLE), source + age, eight honesty rules baked into the UI. | — | — |

Eight dashboards surface the above — **executive, compliance, weather, chokepoints,
trade, cost, vessel, health** — each widget carries its own provenance badge, and
every free-tier gap is shown as an honest `UNAVAILABLE` with a reason, never a
fabricated figure.

## Improvements added beyond the original prompt

- **Self-verifying build**: ISO 6346 golden tests run on every page load and on
  the home page (anchored to the Wikipedia CSQU3054383 worked example), so a
  regression in the check-digit algorithm is visible immediately.
- **Dark / light theme** with full token set, persisted.
- **Internationalisation from day one**: English and Arabic with full RTL
  layout flip, locale-aware number formatting.
- **Provider budget guard** as a first-class UI element (top-bar pill +
  admin page) — the fair-use requirement made visible.
- **Provenance badges on every number** (ok / partial / missing / stale /
  conflict) with source + data-age.
- **Keyboard shortcuts** (`g`+`c` check, `g`+`f` facilities, `g`+`d`
  dashboards, `g`+`a` arrivals, `t` theme, `/` focus search, `Esc` close).
- **CSV import/export** everywhere (translator, bulk results, data-gap,
  audit log).
- **Mobile-first responsive** layout with a working mobile nav, tested at
  390px width.
- **Accessibility**: semantic landmarks, ARIA labels, high-contrast tokens,
  keyboard focus, data-table alternatives for charts.
- **Honesty-first copy**: the disclaimer strip, the VGM "DRAFT — NOT
  CERTIFIED" stamp, and the arrivals "AIS shows vessels, not containers" rule
  are baked into the UI, not just the docs.

## Run locally

No build step. Just open the file, or serve it (recommended, so the map and
fetch-based features behave like production):

```bash
# option 1 — open directly
open index.html          # macOS
xdg-open index.html      # Linux

# option 2 — local server (recommended)
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy (free hosting) — pick one

The whole repo is a static site, so any static host works.

### GitHub Pages (recommended, auto-deploy)

1. Create an empty repo on GitHub, then:
   ```bash
   git init
   git add -A
   git commit -m "BoxLens demo build"
   git branch -M main
   git remote add origin https://github.com/<you>/boxlens.git
   git push -u origin main
   ```
2. In the repo: **Settings → Pages → Source = "GitHub Actions"**.
3. The included workflow (`.github/workflows/deploy-pages.yml`) deploys on
   every push. Your site lives at
   `https://<you>.github.io/boxlens/`.

### Netlify

```bash
npm install -g netlify-cli
netlify login
netlify sites:create --name boxlens
netlify deploy --prod --dir=.      # or: bash deploy.sh netlify
```
`netlify.toml` is included (publish dir `.` + security headers).

### Vercel

```bash
npm install -g vercel
vercel --prod                     # or: bash deploy.sh vercel
```
`vercel.json` is included (clean URLs + security headers).

### Surge.sh (no card needed)

```bash
npm install -g surge
surge . boxlens-demo.surge.sh     # or: bash deploy.sh surge boxlens-demo.surge.sh
```

### One-command helper

```bash
bash deploy.sh local     # python http.server
bash deploy.sh pages     # prints the git push steps
bash deploy.sh netlify
bash deploy.sh vercel
bash deploy.sh surge boxlens-demo.surge.sh
```

## Tech notes

- Single `index.html`, ~117 KB, inline CSS + JS.
- CDN libraries: **Leaflet 1.9.4** (facility map, OpenStreetMap tiles),
  **ECharts 5.5** (dashboards). No framework, no bundler.
- All data is SAMPLE data modelled on the providers listed in
  `DATA_SOURCES.md`. No live external calls are made from this demo.

## Honesty rules (non-negotiable)

1. Never fabricate or silently fill data. Missing means missing.
2. Never present assistance as certification.
3. Respect provider terms and rate limits; the quota manager is mandatory.
4. No hard-coded secrets, no unbounded external calls, no unvalidated input.
5. Every external failure degrades gracefully with a visible state.
6. Keep code typed, tested, linted and documented.
7. AIS shows vessels, not containers — never claim container-level location.
8. ETAs are estimates with method and age, not facts.

## Project layout

```
index.html                              the app (inline CSS + JS)
README.md
ARCHITECTURE.md                         target architecture + demo mapping
DATA_SOURCES.md                         sources, terms, attribution, limits
LICENSE                                 MIT + data attribution
.gitignore
netlify.toml  vercel.json  deploy.sh    hosting configs + helper
.github/workflows/deploy-pages.yml      GitHub Pages auto-deploy
```

---

## Dashboards module (`app/` + `/api/v1`) — slice #1

An enterprise dashboards module built with **Vite + TypeScript + ECharts +
Leaflet**, served at **`/dashboards`** alongside the legacy single-file app
(which stays live at `/`). Every widget carries a **data-class badge**
(LIVE / DAILY / ANNUAL / ESTIMATE / SAMPLE / UNAVAILABLE), source name and
"updated X ago". Every external call goes through the quota manager and cache;
every failure degrades to a stale value or an explicit UNAVAILABLE state —
never an empty chart. **Total recurring cost: $0** (Vercel Hobby + Upstash /
Supabase free tiers).

**Navigation UX** (slice #1): the old sidebar is gone. The app opens on a
**tile gallery** (`#/dashboards/`) — eight large gradient cards with icon,
title, blurb, data-class badge and a "live/daily/… →" status hint. Clicking a
tile enters that dashboard. A sticky topbar carries brand + breadcrumb + theme
toggle and a horizontal **pill rail** so every dashboard is always one click
away (no dropdown box anywhere). Responsive down to 390px: tiles reflow, the
pill rail scrolls sideways inside its container.

```bash
npm install
npm run dev          # Vite dev server (dashboards app at /dashboards/)
npm run typecheck    # tsc strict — app + api
npm test             # Vitest — root suite (80 tests) + core (80 tests)
npm run build        # Vite -> app/dist (committed; served at /dashboards)
```

**All eight dashboards are built** (each its own lazy-loaded chunk):

| # | Dashboard | Source / data-class |
| --- | --- | --- |
| 1 | Executive Overview | Own-app data (SAMPLE in the demo) — KPIs, 30-day trend, pass/warn/fail donut, top-10 failures, active-ports map |
| 2 | Compliance Quality | Own-app data (SAMPLE) — per-rule matrix, owner coverage, ISO 6346 + VGM tables |
| 3 | Port Weather & Operational Risk | Open-Meteo Marine (DAILY) + Nager.Date + risk score (ESTIMATE, `core/risk.ts`) |
| 4 | Chokepoints & Disruptions | NASA EONET + USGS earthquakes (LIVE) on a world hazard map; IMF PortWatch transit KPIs UNAVAILABLE |
| 5 | Trade & Port Context | World Bank Open Data (ANNUAL) — trade % GDP, container throughput, LPI |
| 6 | Cost & Currency | Frankfurter ECB FX (DAILY) + a SAMPLE freight spot estimate |
| 7 | Vessel Activity (AIS) | UNAVAILABLE without `AISSTREAM_KEY` + cron — honest explainer + architecture diagram |
| 8 | Platform Health (admin) | LIVE budget snapshot (quota manager) + SAMPLE cache/error/breaker metrics |

See [`CHANGELOG.md`](CHANGELOG.md) and [`DATA_SOURCES.md`](DATA_SOURCES.md)
for the verified free-source findings (IMF PortWatch = UNAVAILABLE;
aisstream.io needs a key + cron).

## License

MIT — see [LICENSE](LICENSE). Data sources are credited per
[DATA_SOURCES.md](DATA_SOURCES.md); this demo is not affiliated with or
endorsed by BIC, aisstream.io, Open-Meteo, Nager.Date, UNECE or the ECB.
