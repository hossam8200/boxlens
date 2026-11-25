// Port Weather & Operational Risk — Open-Meteo Marine (DAILY) + risk score
// (ESTIMATE, computed via core/risk.ts on the server). Layout: KPI row (wind,
// wave, swell, visibility, holidays, risk score) → risk gauge + factor table →
// marine snapshot cards → holidays table.
import type { FilterState, WidgetPayload } from '../framework/types';
import { getDashboardWidgets } from '../framework/registry';
import { el } from '../framework/components';
import { gaugeChart } from '../framework/charts';
import { pageHeader, fetchAll, chartCell, tableCell } from './_shared';

export async function render(root: HTMLElement, filters: FilterState): Promise<void> {
  const defs = getDashboardWidgets('weather');
  pageHeader(root, {
    title: 'Port Weather & Operational Risk',
    blurb:
      'Open-Meteo Marine wind/wave/swell per port, Nager.Date holiday calendar and a documented ' +
      'operational-risk score. Risk is an ESTIMATE — hover the badge for the formula.',
    note: 'Selected port: ' + (filters.port ?? 'NLRTM (default — set Port filter for another port)'),
  });

  const entries = await fetchAll(defs);
  const byId = new Map(entries.map((e) => [e.def.id, e.payload]));

  const marine = byId.get('marine-snapshot');
  const marineVal = (marine?.value ?? {}) as {
    windKnots?: number; waveM?: number; swellM?: number; visibilityKm?: number;
  };
  const risk = byId.get('risk-score');
  const riskVal = typeof risk?.value === 'number' ? risk.value : 0;
  const holidays = byId.get('holidays');

  // KPI row
  const kpiGrid = el('div', { class: 'dash-grid' });
  kpiGrid.appendChild(kpiCell('Wind', `${marineVal.windKnots ?? '—'}`, 'kt', marine?.provenance));
  kpiGrid.appendChild(kpiCell('Wave height', `${marineVal.waveM ?? '—'}`, 'm', marine?.provenance));
  kpiGrid.appendChild(kpiCell('Swell', `${marineVal.swellM ?? '—'}`, 'm', marine?.provenance));
  kpiGrid.appendChild(kpiCell('Visibility', `${marineVal.visibilityKm ?? '—'}`, 'km', marine?.provenance));
  kpiGrid.appendChild(kpiCell('Risk score', `${riskVal}`, '/100', risk?.provenance));
  kpiGrid.appendChild(kpiCell('Holidays (yr)', `${holidays?.value ?? '—'}`, '', holidays?.provenance));
  root.appendChild(kpiGrid);

  // Gauge + factor table
  const grid = el('div', { class: 'dash-grid' });
  const gaugeCell = el('div', { class: 'col-6' });
  const factorCell = el('div', { class: 'col-6' });
  grid.append(gaugeCell, factorCell);
  root.appendChild(grid);

  gaugeCell.appendChild(
    await chartCell({
      title: 'Operational risk score',
      provenance: risk!.provenance,
      rows: risk?.rows ?? [],
      csvName: 'weather-risk-factors.csv',
      render: async (body) => {
        const h = await gaugeChart(body, riskVal, { label: 'Risk (0–100)', unit: '' });
        void h;
      },
    }),
  );

  factorCell.appendChild(
    tableCell({
      title: 'Risk factor breakdown',
      rows: risk?.rows ?? [],
      csvName: 'weather-risk-factors.csv',
    }),
  );

  // Holidays table
  const grid2 = el('div', { class: 'dash-grid' });
  const holCell = el('div', { class: 'col-12' });
  grid2.appendChild(holCell);
  root.appendChild(grid2);
  holCell.appendChild(
    tableCell({
      title: `Public holidays (${filters.country ?? 'NL'})`,
      rows: holidays?.rows ?? [],
      csvName: 'weather-holidays.csv',
    }),
  );

  // Marine snapshot raw JSON for transparency
  const grid3 = el('div', { class: 'dash-grid' });
  const rawCell = el('div', { class: 'col-12' });
  grid3.appendChild(rawCell);
  root.appendChild(grid3);
  const rawCard = el('div', { class: 'glass chart-card' });
  rawCard.appendChild(el('h3', {}, ['Marine snapshot (raw)']));
  const rawBody = el('div', { class: 'chart-body' });
  rawBody.innerHTML = `<pre class="mono small" style="white-space:pre-wrap;background:var(--dash-glass-2);padding:10px;border-radius:8px">${escape(JSON.stringify(marineVal, null, 2))}</pre>`;
  rawCard.appendChild(rawBody);
  rawCell.appendChild(rawCard);
}

function kpiCell(label: string, value: string, unit: string, prov: WidgetPayload['provenance'] | undefined): HTMLElement {
  const card = el('div', { class: 'glass kpi-card col-2' });
  card.innerHTML =
    `<div class="kpi-label">${escape(label)}</div>` +
    `<div><span class="kpi-value">${escape(value)}</span>${unit ? `<span class="kpi-unit">${escape(unit)}</span>` : ''}</div>` +
    (prov ? `<div class="prov-meta"><span class="dc-badge ${clsFor(prov.class)}"><span class="dot"></span>${prov.class}</span> · <span class="src">${escape(prov.source)}</span></div>` : '');
  return card;
}

function clsFor(c: string): string {
  return `dc-${c.toLowerCase()}`;
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
