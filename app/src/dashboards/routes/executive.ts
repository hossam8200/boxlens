// Executive Overview — slice #1.
// Own-app-data KPIs (check logs + rule-engine results + provider health).
// Layout: KPI row → 30-day trend (pass/warn/fail stacked area) → pass/warn/fail
// donut → top-10 failing rules bar → active-ports Leaflet map → drill-down table.
import type { FilterState, WidgetDef, WidgetPayload } from '../framework/types';
import { getDashboardWidgets } from '../framework/registry';
import { kpiCard, drilldownTable, el, unavailableState } from '../framework/components';
import { lineChart, donutChart, barChart } from '../framework/charts';
import { dashMap } from '../framework/map';
import { pageHeader, kpiRow, fetchAll, chartCell, tableCell, pctDelta } from './_shared';

export async function render(root: HTMLElement, filters: FilterState): Promise<void> {
  const defs = getDashboardWidgets('executive');
  pageHeader(root, {
    title: 'Executive Overview',
    blurb:
      'Top KPIs, 30-day trend, pass/warn/fail mix, top failing rules and active ports. ' +
      'Own-app data is SAMPLE in the demo (no check-log DB wired); wire BoxLens logs in production.',
    note: 'Filters: ' + (filters.port ?? 'all ports') + ' / ' + (filters.country ?? 'all countries'),
  });

  const entries = await fetchAll(defs);
  const byId = new Map(entries.map((e) => [e.def.id, e.payload]));

  // ---- KPI row (6 cards) ----
  const kpiDefs = ['checks-today', 'pass-rate', 'warn-rate', 'fail-rate', 'free-tier-budget', 'active-ports'];
  const kpiEntries = kpiDefs
    .map((id) => entries.find((e) => e.def.id === id))
    .filter((e): e is { def: WidgetDef; payload: WidgetPayload } => Boolean(e));
  root.appendChild(kpiRow(kpiEntries));

  // ---- 30-day trend (stacked area: pass / warn / fail) ----
  const grid = el('div', { class: 'dash-grid' });
  const trendCell = el('div', { class: 'col-8' });
  const donutCell = el('div', { class: 'col-4' });
  grid.append(trendCell, donutCell);
  root.appendChild(grid);

  const passPayload = byId.get('pass-rate');
  const warnPayload = byId.get('warn-rate');
  const failPayload = byId.get('fail-rate');
  const labels = passPayload?.labels ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const trendCard = await chartCell({
    title: '30-day pass / warn / fail trend',
    provenance: passPayload?.provenance ?? entries[0]!.payload.provenance,
    rows: labels.map((l, i) => ({
      Day: l,
      Pass: passPayload?.series?.[i] ?? 0,
      Warn: warnPayload?.series?.[i] ?? 0,
      Fail: failPayload?.series?.[i] ?? 0,
    })),
    csvName: 'executive-trend.csv',
    render: async (body) => {
      const h = await lineChart(body, labels, [
        { name: 'Pass %', data: passPayload?.series ?? [], color: '#16a34a' },
        { name: 'Warn %', data: warnPayload?.series ?? [], color: '#d97706' },
        { name: 'Fail %', data: failPayload?.series ?? [], color: '#dc2626' },
      ], { area: true });
      // Dispose on unmount via a WeakRef-ish hook (the route is replaced wholesale).
      void h;
    },
  });
  trendCell.appendChild(trendCard);

  // ---- Pass/warn/fail donut ----
  const pass = typeof passPayload?.value === 'number' ? passPayload.value : 0;
  const warn = typeof warnPayload?.value === 'number' ? warnPayload.value : 0;
  const fail = typeof failPayload?.value === 'number' ? failPayload.value : 0;
  const donutCard = await chartCell({
    title: 'Pass / warn / fail mix',
    provenance: passPayload?.provenance ?? entries[0]!.payload.provenance,
    rows: [{ Bucket: 'Pass', Pct: pass }, { Bucket: 'Warn', Pct: warn }, { Bucket: 'Fail', Pct: fail }],
    csvName: 'executive-mix.csv',
    render: async (body) => {
      const h = await donutChart(body, [
        { name: 'Pass', value: pass, color: '#16a34a' },
        { name: 'Warn', value: warn, color: '#d97706' },
        { name: 'Fail', value: fail, color: '#dc2626' },
      ], `${Math.round(pass)}% pass`);
      void h;
    },
  });
  donutCell.appendChild(donutCard);

  // ---- Top-10 failing rules (horizontal bar) + active-ports map ----
  const grid2 = el('div', { class: 'dash-grid' });
  const barCell = el('div', { class: 'col-6' });
  const mapCell = el('div', { class: 'col-6' });
  grid2.append(barCell, mapCell);
  root.appendChild(grid2);

  const topPayload = byId.get('top-failures');
  const topRows = topPayload?.rows ?? [];
  barCell.appendChild(
    await chartCell({
      title: 'Top 10 failing rules (by hits)',
      provenance: topPayload?.provenance ?? entries[0]!.payload.provenance,
      rows: topRows,
      csvName: 'executive-top-failures.csv',
      render: async (body) => {
        const h = await barChart(
          body,
          topRows.map((r) => String(r['Rule'] ?? '')),
          [{ name: 'Hits', data: topRows.map((r) => Number(r['Hits'] ?? 0)), color: '#0891b2' }],
          { horizontal: true },
        );
        void h;
      },
    }),
  );

  // Active-ports map
  const mapCard = el('div', { class: 'glass chart-card' });
  mapCard.appendChild(el('h3', {}, ['Active ports (sample)']));
  const mapBody = el('div', { class: 'chart-body', style: 'height:320px' });
  mapCard.appendChild(mapBody);
  mapCell.appendChild(mapCard);
  const portRows = (byId.get('active-ports')?.rows ?? []) as Array<{ Lat: number; Lng: number; Port: string; 'Pass %': number }>;
  try {
    const points = portRows.map((r) => {
      const pass = Number(r['Pass %'] ?? 0);
      const color: 'teal' | 'amber' | 'red' = pass >= 95 ? 'teal' : pass >= 90 ? 'amber' : 'red';
      return {
        lat: Number(r.Lat),
        lng: Number(r.Lng),
        title: `${r.Port} · ${pass}% pass`,
        color,
        radius: 9,
      };
    });
    const handle = await dashMap(mapBody, points, { zoom: 2 });
    void handle;
  } catch (err) {
    mapBody.appendChild(unavailableState(err instanceof Error ? err.message : 'Map failed'));
  }

  // ---- Drill-down table ----
  const grid3 = el('div', { class: 'dash-grid' });
  const tableCellEl = el('div', { class: 'col-12' });
  grid3.appendChild(tableCellEl);
  root.appendChild(grid3);
  tableCellEl.appendChild(
    tableCell({
      title: 'Drill-down: per-port results',
      rows: portRows.map((r) => ({
        Port: r.Port,
        Lat: r.Lat,
        Lng: r.Lng,
        Checks: r['Checks' as keyof typeof r] ?? '',
        'Pass %': r['Pass %'],
      })),
      csvName: 'executive-ports.csv',
    }),
  );

  // Suppress unused-import warning for kpiCard/drilldownTable (kept for editor
  // jump-to-definition; the shared helpers compose them).
  void kpiCard; void drilldownTable; void pctDelta;
}
