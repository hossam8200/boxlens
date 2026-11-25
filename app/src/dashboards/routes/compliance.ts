// Compliance Quality — own-app rule-engine results (SAMPLE in the demo).
// Layout: KPI row (totals) → per-rule pass/warn/fail stacked bar → ISO 6346
// violations trend → owner-code coverage table → VGM overweight declarations.
import type { FilterState, WidgetPayload } from '../framework/types';
import { getDashboardWidgets } from '../framework/registry';
import { el, unavailableState } from '../framework/components';
import { dataClassMeta } from '../framework/dataClass';
import { barChart, lineChart } from '../framework/charts';
import { pageHeader, fetchAll, kpiRow, chartCell, tableCell } from './_shared';

export async function render(root: HTMLElement, filters: FilterState): Promise<void> {
  const defs = getDashboardWidgets('compliance');
  pageHeader(root, {
    title: 'Compliance Quality',
    blurb:
      'Real operational compliance from live Open-Meteo marine conditions across the ports in scope: ' +
      'per-rule pass/warn/fail, country coverage, threshold failures and a VGM-overweight ESTIMATE. ' +
      'Container-compliance KPIs that need the app\u2019s own check-log DB are not on the free tier.',
    note: 'Filters: ' + (filters.port ?? 'all ports') + ' / ' + (filters.country ?? 'all countries'),
  });

  const entries = await fetchAll(defs);
  const byId = new Map(entries.map((e) => [e.def.id, e.payload]));

  // KPI row: derived totals from rule-matrix + headline values.
  const ruleRows = (byId.get('rule-matrix')?.rows ?? []) as Array<{ Rule: string; Pass: number; Warn: number; Fail: number }>;
  const totalPass = ruleRows.reduce((a, r) => a + Number(r.Pass ?? 0), 0);
  const totalWarn = ruleRows.reduce((a, r) => a + Number(r.Warn ?? 0), 0);
  const totalFail = ruleRows.reduce((a, r) => a + Number(r.Fail ?? 0), 0);
  const totalChecks = totalPass + totalWarn + totalFail;
  const passRate = totalChecks ? Math.round((totalPass / totalChecks) * 1000) / 10 : 0;
  const failRate = totalChecks ? Math.round((totalFail / totalChecks) * 1000) / 10 : 0;

  const kpiGrid = el('div', { class: 'dash-grid' });
  kpiGrid.appendChild(kpiCell('Checks (30d)', totalChecks, byId.get('rule-matrix')!.provenance));
  kpiGrid.appendChild(kpiCell('Pass rate', `${passRate}%`, byId.get('rule-matrix')!.provenance));
  kpiGrid.appendChild(kpiCell('Fail rate', `${failRate}%`, byId.get('rule-matrix')!.provenance));
  const ownerPayload = byId.get('owner-coverage');
  kpiGrid.appendChild(kpiCell('Country coverage', ownerPayload?.value ?? '—', ownerPayload?.provenance));
  const isoPayload = byId.get('iso-violations');
  kpiGrid.appendChild(kpiCell('Operational violations', isoPayload?.value ?? '—', isoPayload?.provenance));
  const vgmPayload = byId.get('vgm-overweight');
  kpiGrid.appendChild(kpiCell('VGM overweight', vgmPayload?.value ?? '—', vgmPayload?.provenance));
  root.appendChild(kpiGrid);

  // Per-rule pass/warn/fail stacked bar
  const grid = el('div', { class: 'dash-grid' });
  const barCell = el('div', { class: 'col-12' });
  grid.appendChild(barCell);
  root.appendChild(grid);
  barCell.appendChild(
    await chartCell({
      title: 'Per-rule pass / warn / fail',
      provenance: byId.get('rule-matrix')!.provenance,
      rows: ruleRows,
      csvName: 'compliance-rule-matrix.csv',
      render: async (body) => {
        const h = await barChart(
          body,
          ruleRows.map((r) => String(r.Rule ?? '')),
          [
            { name: 'Pass', data: ruleRows.map((r) => Number(r.Pass ?? 0)), color: '#16a34a' },
            { name: 'Warn', data: ruleRows.map((r) => Number(r.Warn ?? 0)), color: '#d97706' },
            { name: 'Fail', data: ruleRows.map((r) => Number(r.Fail ?? 0)), color: '#dc2626' },
          ],
          { stack: true },
        );
        void h;
      },
    }),
  );

  // ISO violations trend + VGM overweight table
  const grid2 = el('div', { class: 'dash-grid' });
  const trendCell = el('div', { class: 'col-6' });
  const vgmCell = el('div', { class: 'col-6' });
  grid2.append(trendCell, vgmCell);
  root.appendChild(grid2);

  trendCell.appendChild(
    await chartCell({
      title: 'Operational threshold failures (7-day)',
      provenance: isoPayload!.provenance,
      rows: (isoPayload?.labels ?? []).map((l, i) => ({ Week: l, Violations: isoPayload?.series?.[i] ?? 0 })),
      csvName: 'compliance-iso-trend.csv',
      render: async (body) => {
        const h = await lineChart(
          body,
          isoPayload?.labels ?? [],
          [{ name: 'Violations', data: isoPayload?.series ?? [], color: '#dc2626' }],
          { area: true },
        );
        void h;
      },
    }),
  );

  vgmCell.appendChild(
    tableCell({
      title: 'VGM overweight risk (est., by port)',
      rows: vgmPayload?.rows ?? [],
      csvName: 'compliance-vgm-overweight.csv',
    }),
  );

  // Owner-code coverage table
  const grid3 = el('div', { class: 'dash-grid' });
  const ownerCell = el('div', { class: 'col-12' });
  grid3.appendChild(ownerCell);
  root.appendChild(grid3);
  ownerCell.appendChild(
    tableCell({
      title: 'Country coverage (ports with live data)',
      rows: ownerPayload?.rows ?? [],
      csvName: 'compliance-owner-coverage.csv',
    }),
  );

  void unavailableState;
}

function kpiCell(label: string, value: unknown, prov: WidgetPayload['provenance'] | undefined): HTMLElement {
  const card = el('div', { class: 'glass kpi-card col-2' });
  const badge = prov ? dataClassMeta(prov.class) : null;
  card.innerHTML =
    `<div class="kpi-label">${escape(String(label))}</div>` +
    `<div><span class="kpi-value">${escape(String(value))}</span></div>` +
    (prov && badge
      ? `<div class="prov-meta"><span class="dc-badge ${badge.cls}" title="${escape(badge.hint)}"><span class="dot"></span>${prov.class}</span> · <span class="src">${escape(prov.source)}</span></div>`
      : '');
  return card;
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// kpiRow is imported for parity with the other route modules but the compliance
// page uses derived totals; reference it so the import is not dropped.
void kpiRow;
