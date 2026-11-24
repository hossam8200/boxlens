# DATA_SOURCES.md

BoxLens is designed to sit behind open industry data sources, each isolated
behind its own provider interface so it can be swapped without touching the
product. **This demo build contains SAMPLE data modelled on these sources and
makes NO live calls to any provider.** Every value shown is illustrative and
labelled with a simulated `source` and `fetched_at`.

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
