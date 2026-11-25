// Trade & Port Context — World Bank Open Data (ANNUAL). Three indicators:
// trade % of GDP, container port throughput (TEU), logistics performance index.
// Layout: KPI row → top-10 by indicator bar → per-indicator tables.
import type { FilterState, WidgetPayload } from '../framework/types';
import { getDashboardWidgets } from '../framework/registry';
import { el } from '../framework/components';
import { barChart } from '../framework/charts';
import { pageHeader, fetchAll, chartCell, tableCell } from './_shared';

export async function render(root: HTMLElement, _filters: FilterState): Promise<void> {
  const defs = getDashboardWidgets('trade');
  pageHeader(root, {
    title: 'Trade & Port Context',
    blurb:
      'World Bank Open Data: trade as % of GDP, container port throughput (TEU) and the Logistics ' +
      'Performance Index per country. Refreshed annually — never presented as live.',
    note: 'World Bank API · mrnev=1 (most recent non-empty value per country).',
  });

  const entries = await fetchAll(defs);
  const byId = new Map(entries.map((e) => [e.def.id, e.payload]));

  const trade = byId.get('trade-gdp-pct')!;
  const throughput = byId.get('container-throughput')!;
  const lpi = byId.get('lpi-overall')!;

  // KPI row: # countries covered per indicator
  const kpiGrid = el('div', { class: 'dash-grid' });
  kpiGrid.appendChild(kpiCell('Trade % of GDP — countries', String(trade.value ?? '—'), trade.provenance));
  kpiGrid.appendChild(kpiCell('Container throughput — countries', String(throughput.value ?? '—'), throughput.provenance));
  kpiGrid.appendChild(kpiCell('LPI — countries', String(lpi.value ?? '—'), lpi.provenance));
  root.appendChild(kpiGrid);

  // Top-10 by trade % of GDP (bar) + top-10 by throughput (bar)
  const grid = el('div', { class: 'dash-grid' });
  const tCell = el('div', { class: 'col-6' });
  const thCell = el('div', { class: 'col-6' });
  grid.append(tCell, thCell);
  root.appendChild(grid);

  const tradeRows = (trade.rows ?? []) as Array<{ Country: string; Value: number }>;
  const topTrade = [...tradeRows]
    .filter((r) => typeof r.Value === 'number' && r.Value > 0)
    .sort((a, b) => b.Value - a.Value)
    .slice(0, 10);
  tCell.appendChild(
    await chartCell({
      title: 'Top 10 countries — trade (% of GDP)',
      provenance: trade.provenance,
      rows: topTrade,
      csvName: 'trade-top-gdp.csv',
      render: async (body) => {
        const h = await barChart(
          body,
          topTrade.map((r) => String(r.Country)),
          [{ name: 'Trade % of GDP', data: topTrade.map((r) => Number(r.Value)), color: '#0f766e' }],
          { horizontal: true },
        );
        void h;
      },
    }),
  );

  const thRows = (throughput.rows ?? []) as Array<{ Country: string; Value: number }>;
  const topThroughput = [...thRows]
    .filter((r) => typeof r.Value === 'number' && r.Value > 0)
    .sort((a, b) => Number(b.Value) - Number(a.Value))
    .slice(0, 10);
  thCell.appendChild(
    await chartCell({
      title: 'Top 10 countries — container port throughput (TEU)',
      provenance: throughput.provenance,
      rows: topThroughput,
      csvName: 'trade-top-throughput.csv',
      render: async (body) => {
        const h = await barChart(
          body,
          topThroughput.map((r) => String(r.Country)),
          [{ name: 'TEU', data: topThroughput.map((r) => Number(r.Value)), color: '#0891b2' }],
          { horizontal: true },
        );
        void h;
      },
    }),
  );

  // LPI table
  const grid2 = el('div', { class: 'dash-grid' });
  const lpiCell = el('div', { class: 'col-12' });
  grid2.appendChild(lpiCell);
  root.appendChild(grid2);
  const lpiRows = (lpi.rows ?? []) as Array<{ Country: string; Value: number }>;
  const topLpi = [...lpiRows]
    .filter((r) => typeof r.Value === 'number' && r.Value > 0)
    .sort((a, b) => Number(b.Value) - Number(a.Value))
    .slice(0, 20);
  lpiCell.appendChild(
    tableCell({
      title: 'Logistics Performance Index — top 20',
      rows: topLpi.map((r) => ({ Country: r.Country, Score: r.Value })),
      csvName: 'trade-lpi.csv',
    }),
  );
}

function kpiCell(label: string, value: string, prov: WidgetPayload['provenance']): HTMLElement {
  const card = el('div', { class: 'glass kpi-card col-4' });
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
