// Shared helpers for dashboard route modules. Each route renders a header
// (title + blurb + data-class note), then fetches its widgets through the API
// client (which degrades to a UNAVAILABLE/stale payload on any failure) and
// lays out KPI cards / charts / tables in the responsive grid.
import type { FilterState, WidgetDef, WidgetPayload } from '../framework/types';
import { fetchWidget } from '../framework/api';
import { kpiCard, chartCard, drilldownTable, el, unavailableState } from '../framework/components';
import { exportTableCsv } from '../framework/export';

export interface PageOpts {
  title: string;
  blurb: string;
  /** Optional note rendered as a small muted line under the blurb. */
  note?: string;
}

/** Render the dashboard header card into root. */
export function pageHeader(root: HTMLElement, opts: PageOpts): HTMLElement {
  const header = el('div', { class: 'glass', style: 'padding:14px 16px;margin-bottom:14px' });
  header.innerHTML =
    `<h2>${escape(opts.title)}</h2>` +
    `<p class="small muted">${escape(opts.blurb)}</p>` +
    (opts.note ? `<p class="tiny muted">${escape(opts.note)}</p>` : '');
  root.appendChild(header);
  return header;
}

/** Fetch every widget payload in parallel; never throws. */
export async function fetchAll(defs: WidgetDef[]): Promise<{ def: WidgetDef; payload: WidgetPayload }[]> {
  return Promise.all(
    defs.map(async (def) => ({ def, payload: await fetchWidget(def) })),
  );
}

/** Build a KPI row from a list of (def, payload) entries. Returns the grid element. */
export function kpiRow(entries: { def: WidgetDef; payload: WidgetPayload }[]): HTMLElement {
  const grid = el('div', { class: 'dash-grid' });
  for (const { def, payload } of entries) {
    const cell = el('div', { class: 'col-3' });
    const series = payload.series ?? [];
    const pct = series.length >= 2 ? pctDelta(series) : null;
    cell.appendChild(
      kpiCard({
        def,
        payload,
        delta: pct !== null ? `${pct}%` : undefined,
        deltaDir: pct !== null && pct >= 0 ? 'up' : 'down',
        sub: 'vs previous period',
      }),
    );
    grid.appendChild(cell);
  }
  return grid;
}

/**
 * Build a chart card with an ECharts canvas inside + CSV export. The `render`
 * callback receives the chart body element and is expected to mount the chart
 * (lazy-importing echarts). Returns the card root so the caller can place it
 * in a grid cell.
 */
export async function chartCell(opts: {
  title: string;
  provenance: WidgetPayload['provenance'];
  rows: Record<string, string | number | null>[];
  csvName: string;
  render: (body: HTMLElement) => Promise<void>;
}): Promise<HTMLElement> {
  const { root, body } = chartCard({
    title: opts.title,
    provenance: opts.provenance,
    exportCsv: () => exportTableCsv(opts.csvName, opts.rows),
  });
  try {
    await opts.render(body);
  } catch (err) {
    body.appendChild(unavailableState(err instanceof Error ? err.message : 'Chart failed'));
  }
  return root;
}

/** Build a table card (drill-down) with CSV export. */
export function tableCell(opts: {
  title: string;
  rows: Record<string, string | number | null>[];
  csvName: string;
  columns?: string[];
}): HTMLElement {
  const card = el('div', { class: 'glass chart-card' });
  const head = el('div', { class: 'chart-head' });
  head.innerHTML = `<h3>${escape(opts.title)}</h3><span class="spacer"></span>`;
  const btn = el('button', { class: 'btn btn-ghost btn-icon', title: 'Export CSV' }, ['CSV']);
  btn.addEventListener('click', () => exportTableCsv(opts.csvName, opts.rows, opts.columns));
  head.appendChild(btn);
  card.appendChild(head);
  card.appendChild(drilldownTable(opts.rows, opts.columns));
  return card;
}

/** Render an UNAVAILABLE card for a widget whose source is genuinely missing. */
export function unavailableCard(def: WidgetDef, payload: WidgetPayload): HTMLElement {
  const card = el('div', { class: 'glass chart-card' });
  const head = el('div', { class: 'chart-head' });
  head.innerHTML = `<h3>${escape(def.title)}</h3>`;
  card.appendChild(head);
  const body = el('div', { class: 'chart-body' });
  body.appendChild(unavailableState(payload.provenance.method ?? 'Source unavailable on the free tier.'));
  card.appendChild(body);
  return card;
}

export function pctDelta(series: number[]): number {
  if (series.length < 2) return 0;
  const prev = series[series.length - 2] ?? 0;
  const cur = series[series.length - 1] ?? 0;
  if (prev === 0) return 0;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Shared type for route render fn signature. */
export type RouteRender = (root: HTMLElement, filters: FilterState) => Promise<void>;
