# Changelog

All notable changes to BoxLens are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to a $0 recurring-cost, free-tier-only constraint.

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
