// BoxLens "Features & Capabilities" page — a modern single-page overview of
// everything the app does: the eight dashboards, the six data-class badges,
// the keyless data sources, the $0 platform architecture, and a data-provenance
// & compliance section. Rendered as the #/features route inside the dashboards
// shell. Pure DOM (jsdom-testable), no fetch.
import { el } from './framework/components';
import { DASHBOARD_CATALOG } from './framework/registry';
import { DATA_CLASSES, DATA_CLASS_META } from './framework/dataClass';
import type { DashboardId } from './framework/types';

interface SourceInfo {
  name: string;
  cls: string;
  badgeCls: string;
  limit: string;
  note: string;
}

const SOURCES: ReadonlyArray<SourceInfo> = [
  { name: 'Open-Meteo Marine', cls: 'DAILY', badgeCls: 'dc-daily', limit: '9,000/day', note: 'Wind, wave & swell per port. Keyless.' },
  { name: 'NASA EONET', cls: 'LIVE', badgeCls: 'dc-live', limit: '2,000/day', note: 'Storm, fire & volcano events. Keyless.' },
  { name: 'USGS Earthquakes', cls: 'LIVE', badgeCls: 'dc-live', limit: '2,000/day', note: 'M≥4.5 quakes worldwide. Keyless.' },
  { name: 'Frankfurter (ECB FX)', cls: 'DAILY', badgeCls: 'dc-daily', limit: '1,000/day', note: 'ECB reference exchange rates. Keyless.' },
  { name: 'Nager.Date', cls: 'DAILY', badgeCls: 'dc-daily', limit: '1,000/day', note: 'Public holidays per country. Keyless.' },
  { name: 'World Bank', cls: 'ANNUAL', badgeCls: 'dc-annual', limit: '4,000/day', note: 'Trade % GDP, port throughput, LPI. Keyless.' },
  { name: 'aisstream.io', cls: 'UNAVAILABLE', badgeCls: 'dc-unavailable', limit: '200/day', note: 'Live AIS positions. Needs API key + cron.' },
];

interface ToolInfo {
  icon: string;
  name: string;
  badge: string;
  badgeCls: string;
  body: string;
}

const TOOLS: ReadonlyArray<ToolInfo> = [
  { icon: '🔢', name: 'ISO 6346 check digit', badge: 'OFFLINE', badgeCls: 'dc-live', body: 'Validate any 11-character container number (4 owner letters + 6 serial + 1 check digit) under the authoritative ISO 6346 algorithm, with a one-click suggested correction. CSQU3054383 anchors the Wikipedia worked example.' },
  { icon: '🔡', name: 'Size/type decoder', badge: 'OFFLINE', badgeCls: 'dc-live', body: 'Decode any 4-character ISO 6346 size/type code (e.g. 22G1 → 20 ft, 8\u20326\u2033, general-purpose) into length, height, type group and category, with ISO 668 nominal tare / max-gross / payload. Pure offline lookup, no network.' },
  { icon: '⚖️', name: 'VGM Method 2 (SOLAS)', badge: 'DRAFT', badgeCls: 'dc-estimate', body: 'Compute VGM = tare + cargo + packing + dunnage and check it against the container\u2019s max gross and max payload. Labelled a draft — never a certification; the shipper keeps the legal SOLAS VI/2 responsibility.' },
  { icon: '🏷️', name: 'BIC owner lookup', badge: 'PARTIAL', badgeCls: 'dc-sample', body: 'Resolve a 4-letter owner code to its shipping line (curated subset of the public BIC BoxTech register). Production wires the live BIC Codes API with per-prefix IndexedDB caching.' },
  { icon: '🗺️', name: 'Port & country filter', badge: 'LIVE', badgeCls: 'dc-daily', body: 'Full UN/LOCODE sea-port search with a cascading country \u2192 port filter — selecting a country narrows the port list to that country only.' },
  { icon: '🧭', name: 'Sea route & rough ETA', badge: 'ESTIMATE', badgeCls: 'dc-estimate', body: 'Chokepoint-aware great-circle estimate between two ports: the direct arc is tested against a coarse landmass mask and rerouted via Suez / Panama / Cape of Good Hope / Cape Horn when it would cross a continent. Distance × detour factor, ETA from an explicit assumed speed. Pure offline — verify against the carrier schedule.' },
  { icon: '🔁', name: 'Honest degradation', badge: 'RULE', badgeCls: 'dc-daily', body: 'Every value keeps a provenance badge (source, fetched-at, status). AIS shows vessels not containers; ETAs are estimates with method and age; missing means missing — never fabricated.' },
];

const FEAT_BLURB: Record<DashboardId, string> = {
  executive: 'Top KPIs, 30-day check trend, pass/warn/fail mix, top failing rules and active ports.',
  compliance: 'Per-rule pass/warn/fail, ISO 6346 / VGM / BIC coverage, owner-code stats and batch drill-down.',
  weather: 'Open-Meteo Marine wind/wave/swell per port, holiday calendar and a documented operational-risk score.',
  chokepoints: 'NASA EONET storms and USGS quakes on a world map; IMF PortWatch transit KPIs shown as UNAVAILABLE.',
  trade: 'World Bank trade % of GDP, container-port throughput and LPI per country (annual refresh).',
  cost: 'Frankfurter ECB reference FX rates, USD freight index estimate and per-TEU cost conversions.',
  vessel: 'Live AIS positions require an aisstream.io key + cron. Renders UNAVAILABLE without a key.',
  health: 'Admin view: per-provider budget used, cache hit-rate, breaker state and API error rate.',
  'classic-analytics': 'The seven legacy views from the classic VGM tool — shipment compliance, data coverage, gate & operations, facility map, arrivals, combo and exec — rebuilt on real Open-Meteo Marine, World Bank, NASA EONET, USGS, Nager.Date and BoxLens risk-engine data. No SAMPLE fixtures.',
};

const ARCH: ReadonlyArray<{ icon: string; title: string; body: string }> = [
  { icon: '💸', title: '$0 recurring cost', body: 'Vercel Hobby hosting, six keyless public-data providers, and an in-memory stale-while-revalidate cache. No paid API keys required to run.' },
  { icon: '⚡', title: 'Serverless /api/v1', body: 'Keyless provider adapters behind a per-provider quota, a circuit breaker, and a SWR cache with stale fallback — a failing source never breaks the page.' },
  { icon: '🏷️', title: 'Honest data-class badges', body: 'Every value is labelled LIVE, DAILY, ANNUAL, ESTIMATE, SAMPLE or UNAVAILABLE, with its source and age. Estimates and missing data are never shown as live.' },
  { icon: '🧭', title: 'Modern, fast UX', body: 'Hash-routed, lazy-loaded dashboard chunks (each dashboard is its own JS file), responsive tile gallery, dark/light theme and RTL support.' },
  { icon: '🔁', title: 'Degradation, not failure', body: 'On a fetch error the last good value is served with a "stale" flag; if there is none, an explicit UNAVAILABLE state explains why — never an empty chart.' },
  { icon: '📤', title: 'Export ready', body: 'Charts export to PNG; tables and KPI series export to CSV for downstream spreadsheets and reports.' },
];

export function renderFeatures(root: HTMLElement, onSelect: (id: DashboardId) => void): void {
  root.innerHTML = '';

  // ---- Hero ----
  const hero = el('div', { class: 'glass feat-hero' });
  hero.innerHTML =
    '<div class="feat-hero-eyebrow">BoxLens · v2.5</div>' +
    '<h1>Features &amp; Capabilities</h1>' +
    '<p class="muted">A single application for container-compliance and port intelligence — nine dashboards, ' +
    'six keyless data sources, an ISO 6346 + size/type + VGM Method 2 toolset, honest data-class labelling, ' +
    'and a $0 recurring-cost platform. Everything below is reachable from this one URL.</p>';
  root.appendChild(hero);

  // ---- Nine dashboards ----
  root.appendChild(sectionHead('Nine dashboards', 'Each is a lazy-loaded view — click a card to open it.'));
  const dgrid = el('div', { class: 'tile-grid feat-tile-grid' });
  for (const d of DASHBOARD_CATALOG) {
    const meta = DATA_CLASS_META[d.dataClass];
    const tile = el('button', { class: 'tile', 'aria-label': `Open ${d.title}` });
    tile.innerHTML =
      `<div class="tile-icon">${d.icon}</div>` +
      `<div class="tile-body">` +
      `<div class="tile-title">${esc(d.title)}</div>` +
      `<div class="tile-blurb muted small">${esc(FEAT_BLURB[d.id])}</div>` +
      `</div>` +
      `<div class="tile-foot">` +
      `<span class="dc-badge ${meta.cls}" title="${esc(meta.hint)}"><span class="dot"></span>${meta.label}</span>` +
      `<span class="status-hint">Open →</span>` +
      `</div>`;
    tile.addEventListener('click', () => onSelect(d.id));
    dgrid.appendChild(tile);
  }
  root.appendChild(dgrid);

  // ---- Data-class legend ----
  root.appendChild(sectionHead('Data-class badges', 'Every widget carries one. It tells you exactly how authoritative the number is.'));
  const dleg = el('div', { class: 'glass feat-legend' });
  for (const c of DATA_CLASSES) {
    const m = DATA_CLASS_META[c];
    const row = el('div', { class: 'feat-legend-row' });
    row.innerHTML =
      `<span class="dc-badge ${m.cls}"><span class="dot"></span>${m.label}</span>` +
      `<span class="muted small">${esc(m.hint)}</span>`;
    dleg.appendChild(row);
  }
  root.appendChild(dleg);

  // ---- Data sources ----
  root.appendChild(sectionHead('Data sources', 'Six keyless public providers power the live and daily widgets — no paid API keys needed.'));
  const sgrid = el('div', { class: 'feat-source-grid' });
  for (const s of SOURCES) {
    const card = el('div', { class: 'glass feat-source' });
    card.innerHTML =
      `<div class="feat-source-head"><span class="dc-badge ${s.badgeCls}"><span class="dot"></span>${s.cls}</span>` +
      `<span class="tiny muted mono">${esc(s.limit)}</span></div>` +
      `<div class="feat-source-name">${esc(s.name)}</div>` +
      `<div class="muted small">${esc(s.note)}</div>`;
    sgrid.appendChild(card);
  }
  root.appendChild(sgrid);

  // ---- Container & VGM tools ----
  root.appendChild(sectionHead('Container & VGM tools', 'The native VGM & Container view (no iframe) — pure @boxlens/core logic, free and offline.'));
  const tgrid = el('div', { class: 'feat-arch-grid' });
  for (const t of TOOLS) {
    const card = el('div', { class: 'glass feat-arch' });
    card.innerHTML =
      `<div class="feat-arch-icon">${t.icon}</div>` +
      `<div><div class="feat-arch-title">${esc(t.name)} <span class="dc-badge ${t.badgeCls}"><span class="dot"></span>${t.badge}</span></div>` +
      `<div class="muted small">${esc(t.body)}</div></div>`;
    tgrid.appendChild(card);
  }
  root.appendChild(tgrid);

  // ---- Platform architecture ----
  root.appendChild(sectionHead('Platform architecture', 'Built to run for free, degrade honestly, and stay fast.'));
  const agrid = el('div', { class: 'feat-arch-grid' });
  for (const a of ARCH) {
    const card = el('div', { class: 'glass feat-arch' });
    card.innerHTML =
      `<div class="feat-arch-icon">${a.icon}</div>` +
      `<div><div class="feat-arch-title">${esc(a.title)}</div>` +
      `<div class="muted small">${esc(a.body)}</div></div>`;
    agrid.appendChild(card);
  }
  root.appendChild(agrid);

  // ---- Data provenance & compliance ----
  root.appendChild(sectionHead('Data provenance & compliance', 'How BoxLens stays trustworthy enough to use on real work.'));
  const prov = el('div', { class: 'glass feat-prov' });
  prov.innerHTML =
    `<p>Every number in BoxLens carries a <b>data-class badge</b>, its <b>source</b>, and its <b>age</b>. ` +
    `Estimates and missing data are always labelled — never presented as official facts.</p>` +
    `<p>BoxLens is a <b>decision-support tool</b>: it assists with data and calculations, but it does <b>not certify ` +
    `a Verified Gross Mass (VGM)</b> and does not replace the shipper's legal responsibility under ` +
    `<b>SOLAS regulation VI/2</b>. Tare weight and third-party data may be stale or partial — verify against the ` +
    `authoritative source before relying on it for a declaration.</p>` +
    `<p class="muted small">Set <code class="mono">UPSTASH_REDIS_REST_URL</code> + <code class="mono">UPSTASH_REDIS_REST_TOKEN</code> ` +
    `to share cache and quota across serverless instances; set <code class="mono">AISSTREAM_KEY</code> (plus a cron) to ` +
    `activate the Vessel Activity dashboard.</p>`;
  root.appendChild(prov);
}

function sectionHead(title: string, sub: string): HTMLElement {
  const h = el('div', { class: 'feat-section-head' });
  h.innerHTML = `<h2>${esc(title)}</h2><p class="muted small">${esc(sub)}</p>`;
  return h;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
