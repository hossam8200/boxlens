// Platform Health (admin) — provider-budget guard live snapshot + own-app
// cache/error/breaker SAMPLE fixtures. Layout: KPI row → provider budget
// table → breaker state table → cache/error trend line.
import type { FilterState, WidgetPayload } from '../framework/types';
import { getDashboardWidgets } from '../framework/registry';
import { el } from '../framework/components';
import { lineChart } from '../framework/charts';
import { pageHeader, fetchAll, chartCell, tableCell } from './_shared';

export async function render(root: HTMLElement, _filters: FilterState): Promise<void> {
  const defs = getDashboardWidgets('health');
  pageHeader(root, {
    title: 'Platform Health',
    blurb:
      'Admin view: per-provider free-tier budget used (LIVE from the quota manager), cache hit-rate, ' +
      'API error rate and circuit-breaker state. Own-app metrics are SAMPLE until the metrics DB is wired.',
    note: 'Budget KPI is LIVE; cache/error/breaker are SAMPLE in the demo.',
  });

  const entries = await fetchAll(defs);
  const byId = new Map(entries.map((e) => [e.def.id, e.payload]));

  const budget = byId.get('budget-used')!;
  const cache = byId.get('cache-hit-rate')!;
  const error = byId.get('error-rate')!;
  const breaker = byId.get('breaker-state')!;

  // KPI row
  const kpiGrid = el('div', { class: 'dash-grid' });
  kpiGrid.appendChild(kpiCell('Budget used', `${budget.value ?? '—'}%`, budget.provenance));
  kpiGrid.appendChild(kpiCell('Cache hit', `${cache.value ?? '—'}%`, cache.provenance));
  kpiGrid.appendChild(kpiCell('Error rate', `${error.value ?? '—'}%/h`, error.provenance));
  kpiGrid.appendChild(kpiCell('Breakers', String(breaker.value ?? '—'), breaker.provenance));
  root.appendChild(kpiGrid);

  // Cache + error trend (overlay line)
  const grid = el('div', { class: 'dash-grid' });
  const trendCell = el('div', { class: 'col-12' });
  grid.appendChild(trendCell);
  root.appendChild(grid);
  trendCell.appendChild(
    await chartCell({
      title: 'Cache hit-rate vs API error rate (7-day)',
      provenance: cache.provenance,
      rows: (cache.labels ?? []).map((l, i) => ({
        Day: l,
        'Cache %': cache.series?.[i] ?? 0,
        'Error %/h': error.series?.[i] ?? 0,
      })),
      csvName: 'health-trend.csv',
      render: async (body) => {
        const h = await lineChart(
          body,
          cache.labels ?? [],
          [
            { name: 'Cache hit %', data: cache.series ?? [], color: '#0f766e' },
            { name: 'Error %/h', data: error.series ?? [], color: '#dc2626' },
          ],
          { area: false },
        );
        void h;
      },
    }),
  );

  // Budget + breaker tables
  const grid2 = el('div', { class: 'dash-grid' });
  const bCell = el('div', { class: 'col-6' });
  const brCell = el('div', { class: 'col-6' });
  grid2.append(bCell, brCell);
  root.appendChild(grid2);
  bCell.appendChild(
    tableCell({
      title: 'Free-tier budget used per provider',
      rows: budget.rows ?? [],
      csvName: 'health-budget.csv',
    }),
  );
  brCell.appendChild(
    tableCell({
      title: 'Circuit breaker state per provider',
      rows: breaker.rows ?? [],
      csvName: 'health-breakers.csv',
    }),
  );
}

function kpiCell(label: string, value: string, prov: WidgetPayload['provenance']): HTMLElement {
  const card = el('div', { class: 'glass kpi-card col-3' });
  card.innerHTML =
    `<div class="kpi-label">${escape(label)}</div>` +
    `<div><span class="kpi-value">${escape(value)}</span></div>` +
    `<div class="prov-meta"><span class="dc-badge ${clsFor(prov.class)}"><span class="dot"></span>${prov.class}</span> · <span class="src">${escape(prov.source)}</span></div>`;
  return card;
}

function clsFor(c: string): string {
  return `dc-${c.toLowerCase()}`;
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
