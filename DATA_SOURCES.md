# DATA_SOURCES.md

BoxLens is designed to sit behind open industry data sources, each isolated
behind its own provider interface so it can be swapped without touching the
product. **This demo build contains SAMPLE data modelled on these sources and
makes NO live calls to any provider.** Every value shown is illustrative and
labelled with a simulated `source` and `fetched_at`.

---

## Verified free sources (dashboards module, slice #0)

The dashboards module (`app/` + `/api/v1`) targets only permanent free-tier,
key-less or key-in-secret sources. Each endpoint was verified by a direct call
on 2026-11-24 before implementation, per the spec's "verify before
implementing" rule.

| Source | Verified | Data class | Free-tier terms & attribution | Quota limit (self-imposed) | Cache TTL | Cadence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Open-Meteo Marine + Forecast | 200, key-less | LIVE / DAILY | CC-BY 4.0; attribution required | 9 000/day | 30 min | hourly | ✅ wires in slice #3 |
| Nager.Date | 200, key-less | DAILY | MIT; commercial OK | 1 000/day | 24 h | daily | ✅ wires in slice #3 |
| Frankfurter (ECB FX) | 200 via `.dev` (`.app` 301→`.dev`) | DAILY | ECB reference rates; free, key-less | 1 000/day | 12 h | daily | ✅ wires in slice #6 |
| World Bank Open Data | 200, key-less | ANNUAL | Open data; attribution requested | 4 000/day | 7 days | annual | ✅ wires in slice #5 |
| NGA World Port Index (Pub 150) | embedded fixture (no REST API) | ANNUAL | NGA Pub 150, 2019 ed. (public); verify against current edition | n/a (embedded) | 7 days | static | ✅ port physical characteristics — channel/pier/anchorage depth, tidal range, harbor size, max vessel, entrance restrictions — matched per port by nearest coordinate (≤ 10 km). 5,410 ports indexed (3,587 with depth). Source: `tayljordan/ports` mirror of NGA Pub 150. |
| NASA EONET | 200, key-less | LIVE | Open; credit NASA EONET | 2 000/day | 1 h | near-real-time | ✅ wires in slice #4 |
| USGS earthquakes | 200, key-less (GeoJSON) | LIVE | Public domain (USGS) | 2 000/day | 1 h | hourly | ✅ wires in slice #4 |
| UN/LOCODE | bundled CSV (no REST API) | (reference) | UNECE; open | n/a | static | periodic import | ✅ embedded |
| **IMF PortWatch** | **404 — no public REST API** | UNAVAILABLE | n/a | blocked (limit 0) | n/a | n/a | ❌ chokepoint transit KPIs render UNAVAILABLE; hazard map (EONET/USGS) is real |
| **aisstream.io** | requires API key + cron | LIVE | key server-side only; free-tier terms to confirm | 200/day | per cron interval | real-time (snapshot) | ⚠️ Vessel Activity renders UNAVAILABLE until a key is supplied as a Vercel/Actions secret |

### Hard rules (dashboards module)

- Every external call goes through the quota manager (`api/_lib/quota.ts`) and
  cache (`api/_lib/cache.ts`). No client code calls a third-party API directly.
- Every widget shows a data-class badge (LIVE / DAILY / ANNUAL / ESTIMATE /
  SAMPLE / UNAVAILABLE), source name and "updated X ago".
- Every failure degrades visibly: a stale value with age, or an explicit
  UNAVAILABLE state — never an empty chart.
- AIS shows vessels, not containers. ETAs / congestion / risk scores are
  ESTIMATE with the method shown on hover and linked from Methodology.
- No secrets in client code. Provider keys live only in Vercel/Actions env vars.
- Store only anonymised aggregate counts from user activity; never store pasted
  booking contents on the server.

### Infrastructure (all free tier)

| Service | Use | Free tier |
| --- | --- | --- |
| Vercel Hobby | serverless functions (`/api/v1`) + static host | 100 GB-h + 100k invocations/mo |
| Upstash Redis | quota manager + cache (optional; in-memory fallback otherwise) | 10 000 commands/day |
| Supabase | AIS snapshots + anonymised aggregates (Postgres) | 500 MB + API |
| GitHub Actions cron | AIS snapshot ingestion job | 2 000 min/mo |

---

## Legacy demo sample data (single-file `index.html`)

| Source | Purpose | Attribution | Commercial use | Rate / fair use | Refresh cadence | Failure mode | Live in this demo? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BIC BoxTech API | Container technical &amp; safety data (tare, max gross, max payload, max stacking, size-type, manufacturer, CSC plate, tank/reefer/smart data) | BIC — Bureau International des Containers | Governed by fair-use terms; license may be withdrawn. Verify before commercial use. Register as a consumer. | Fair-use; keep swappable; cache aggressively | Days–weeks (configurable TTL) | Stale data → visible badge | No — sample data |
| BIC Codes API | Owner name, location, contact from the 4-letter BIC code | BIC | Same family as BoxTech | Fair-use | Days | 404 → not-found state | No — sample OWNERS map |
| BIC Facility Code API | 9-char facility codes, names, owners, addresses, GPS, geofences | BIC | Separate terms; confirm before commercial use | Fair-use | Weekly refresh within limits | Stale → badge | No — sample FACILITIES |
| aisstream.io | Live AIS vessel positions (free key) | aisstream.io | Free feed can lag minutes; confirm commercial plan | Free tier rate-limited | Real-time (lag visible) | Lag → age label | No — sample VESSELS |
| Open-Meteo Marine API | Wave, swell, wind forecasts for port areas | Open-Meteo | Confirm whether commercial use needs a paid plan | Generous free tier | Hourly | Missing → null | No — sample WEATHER |
| Nager.Date | Public holidays by country | Nager.Date (MIT) | OK | None | Daily | 404 → none | No — sample HOLIDAYS |
| UN/LOCODE (open dataset) | Port codes and names | UNECE | Open | None | Periodic import | Static | No — embedded in FACILITIES |
| Frankfurter (optional) | Exchange rates | European Central Bank / Frankfurter | OK | None | Daily | Missing → last known | No |

## Hard rules (from the product spec)

- Never scrape websites that do not offer an API for this use.
- Never bulk-download a provider's database.
- Honour every rate limit and fair-use clause.
- Show required attribution (e.g. credit BIC) in the UI and exports.
- Contact the provider before any heavy commercial use.

## Provenance model

Every record carries `source`, `fetched_at`, `source_version`, and a
`quality` flag: `ok | partial | missing | stale | conflict`. The UI surfaces
these as coloured badges on every number, and the provider-budget guard
shows remaining call budget per provider per window.

## Wiring real providers

To go from demo to live, replace the sample objects (`CONTAINERS`, `OWNERS`,
`FACILITIES`, `VESSELS`, `HOLIDAYS`, `WEATHER`) with async provider clients
behind a shared interface (see ARCHITECTURE.md), and route every call through
the quota manager. Keep the provider terms above up to date here.
