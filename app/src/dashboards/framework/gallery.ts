// Dashboard tile gallery — the modern dashboard selector. Replaces the old
// sidebar/dropdown: every dashboard is a large gradient card with icon, title,
// blurb, data-class badge and a "live" status hint. Clicking a tile navigates
// to that dashboard. Built from real DOM nodes (jsdom-testable); the
// tile-data derivation is pure so the gallery sort/filter logic can be unit
// tested without a DOM.
import type { DashboardMeta } from './registry';
import { dataClassMeta } from './dataClass';
import { el } from './components';

/** Short, concrete blurbs per dashboard — no generic placeholder copy. */
const DASHBOARD_BLURB: Record<string, string> = {
  executive:
    'Top KPIs, 30-day check trend, pass/warn/fail mix, top failing rules and active ports.',
  compliance:
    'Per-rule pass/warn/fail, ISO 6346 / VGM / BIC coverage, owner-code stats, batch drill-down.',
  weather:
    'Open-Meteo Marine wind/wave/swell per port, holiday calendar, and a documented operational-risk score.',
  chokepoints:
    'NASA EONET storms + USGS quakes on a world map; IMF PortWatch transit KPIs UNAVAILABLE.',
  trade:
    'World Bank trade % of GDP, container-port throughput and LPI per country (annual refresh).',
  cost:
    'Frankfurter ECB reference FX rates, USD freight index estimate and per-TEU cost conversions.',
  vessel:
    'Live AIS positions require an aisstream.io key + cron. Renders UNAVAILABLE without a key.',
  health:
    'Admin view: per-provider budget used, cache hit-rate, breaker state and API error rate.',
  'classic-analytics':
    'Legacy dashboards from the classic VGM tool — compliance, coverage, gate & yard, map, arrivals, combo, exec (SAMPLE).',
};

export interface TileData {
  id: string;
  icon: string;
  title: string;
  blurb: string;
  dataClass: string;
  /** CSS class for the badge dot (dc-live, dc-daily, ...). */
  badgeCls: string;
  /** Short status hint shown as a small pill on the tile. */
  statusHint: string;
}

/** Pure: derive gallery tile data from the catalog (no DOM, unit-testable). */
export function tileData(catalog: ReadonlyArray<DashboardMeta>): TileData[] {
  return catalog.map((d) => {
    const meta = dataClassMeta(d.dataClass);
    const statusHint =
      d.dataClass === 'UNAVAILABLE'
        ? 'Unavailable'
        : d.dataClass === 'LIVE'
          ? 'Live'
          : d.dataClass === 'DAILY'
            ? 'Daily'
            : d.dataClass === 'ANNUAL'
              ? 'Annual'
              : d.dataClass === 'ESTIMATE'
                ? 'Estimate'
                : 'Sample';
    return {
      id: d.id,
      icon: d.icon,
      title: d.title,
      blurb: DASHBOARD_BLURB[d.id] ?? 'Dashboard',
      dataClass: d.dataClass,
      badgeCls: meta.cls,
      statusHint,
    };
  });
}

/** Pure: sort gallery tiles by blurb length desc (a small demo hook for tests). */
export function sortByBlurbLength(tiles: TileData[]): TileData[] {
  return [...tiles].sort((a, b) => b.blurb.length - a.blurb.length);
}

/**
 * Build the gallery DOM: header + responsive tile grid. Each tile is a button
 * that calls onSelect(d.id) on click. Pure data + DOM — no fetch, no router.
 */
export function tileGallery(
  catalog: ReadonlyArray<DashboardMeta>,
  onSelect: (d: DashboardMeta) => void,
): HTMLElement {
  const wrap = el('div', { class: 'dash-gallery' });

  const head = el('div', { class: 'gallery-head glass' });
  head.innerHTML =
    '<h2>BoxLens dashboards</h2>' +
    '<p class="muted small">Eight enterprise views on container compliance, port ' +
    'intelligence and platform health. Every value carries a data-class badge, ' +
    'source and age — and degrades honestly when a free source cannot supply it.</p>';
  wrap.appendChild(head);

  const grid = el('div', { class: 'tile-grid' });
  for (const t of tileData(catalog)) {
    const tile = el('button', {
      class: 'tile',
      'data-dash': t.id,
      'aria-label': `Open ${t.title}`,
    });
    tile.innerHTML =
      `<div class="tile-icon">${t.icon}</div>` +
      `<div class="tile-body">` +
      `<div class="tile-title">${escapeHtml(t.title)}</div>` +
      `<div class="tile-blurb muted small">${escapeHtml(t.blurb)}</div>` +
      `</div>` +
      `<div class="tile-foot">` +
      `<span class="dc-badge ${t.badgeCls}"><span class="dot"></span>${t.dataClass}</span>` +
      `<span class="status-hint">${escapeHtml(t.statusHint)} →</span>` +
      `</div>`;
    tile.addEventListener('click', () => {
      const meta = catalog.find((d) => d.id === t.id);
      if (meta) onSelect(meta);
    });
    grid.appendChild(tile);
  }
  wrap.appendChild(grid);
  return wrap;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
