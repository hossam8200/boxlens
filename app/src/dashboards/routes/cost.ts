// Cost & Currency — Frankfurter ECB reference FX rates (DAILY) + a SAMPLE
// freight spot estimate. Layout: KPI row (rate date + freight value) → FX
// rates table → freight index trend line.
import type { FilterState, WidgetPayload } from '../framework/types';
import { getDashboardWidgets } from '../framework/registry';
import { el } from '../framework/components';
import { lineChart } from '../framework/charts';
import { pageHeader, fetchAll, chartCell, tableCell } from './_shared';

export async function render(root: HTMLElement, _filters: FilterState): Promise<void> {
  const defs = getDashboardWidgets('cost');
  pageHeader(root, {
    title: 'Cost & Currency',
    blurb:
      'Frankfurter ECB reference FX rates (daily) and a freight spot estimate. The freight index is ' +
      'a SAMPLE estimate — wire a paid feed (Drewry WCI / SCFI) for live values.',
    note: 'ECB rates refresh daily at ~16:00 CET. Cache TTL 12h.',
  });

  const entries = await fetchAll(defs);
  const byId = new Map(entries.map((e) => [e.def.id, e.payload]));

  const fx = byId.get('fx-rates')!;
  const freight = byId.get('freight-index')!;

  // KPI row
  const kpiGrid = el('div', { class: 'dash-grid' });
  kpiGrid.appendChild(kpiCell('ECB rate date', String(fx.value ?? '—'), fx.provenance));
  kpiGrid.appendChild(kpiCell('Freight spot (est.)', `${freight.value ?? '—'} USD/40ft`, freight.provenance));
  root.appendChild(kpiGrid);

  // FX table + freight trend
  const grid = el('div', { class: 'dash-grid' });
  const fxCell = el('div', { class: 'col-6' });
  const frCell = el('div', { class: 'col-6' });
  grid.append(fxCell, frCell);
  root.appendChild(grid);

  fxCell.appendChild(
    tableCell({
      title: 'ECB reference FX rates (base USD)',
      rows: fx.rows ?? [],
      csvName: 'cost-fx-rates.csv',
    }),
  );

  frCell.appendChild(
    await chartCell({
      title: 'Freight spot estimate (6-week trend)',
      provenance: freight.provenance,
      rows: (freight.labels ?? []).map((l, i) => ({ Week: l, USD: freight.series?.[i] ?? 0 })),
      csvName: 'cost-freight-trend.csv',
      render: async (body) => {
        const h = await lineChart(
          body,
          freight.labels ?? [],
          [{ name: 'USD / 40ft', data: freight.series ?? [], color: '#0f766e' }],
          { area: true },
        );
        void h;
      },
    }),
  );
}

function kpiCell(label: string, value: string, prov: WidgetPayload['provenance']): HTMLElement {
  const card = el('div', { class: 'glass kpi-card col-6' });
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
