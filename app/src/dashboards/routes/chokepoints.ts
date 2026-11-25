// Chokepoints & Disruptions — NASA EONET (LIVE) + USGS earthquakes (LIVE) on a
// world hazard map. IMF PortWatch transit KPIs are UNAVAILABLE (no public REST
// API, verified 2026-11-24). Layout: KPI row → hazard Leaflet map → EONET
// events table → USGS quakes table → IMF unavailable card.
import type { FilterState, WidgetPayload } from '../framework/types';
import { getDashboardWidgets } from '../framework/registry';
import { el, unavailableState } from '../framework/components';
import { dashMap } from '../framework/map';
import { pageHeader, fetchAll, tableCell, unavailableCard } from './_shared';

export async function render(root: HTMLElement, _filters: FilterState): Promise<void> {
  const defs = getDashboardWidgets('chokepoints');
  pageHeader(root, {
    title: 'Chokepoints & Disruptions',
    blurb:
      'NASA EONET storms/fires/volcanoes and USGS M≥4.5 earthquakes plotted on a world hazard map. ' +
      'IMF PortWatch transit KPIs are UNAVAILABLE — the source has no public REST API.',
    note: 'EONET + USGS refresh hourly (cache TTL 1h). Live data, not sample.',
  });

  const entries = await fetchAll(defs);
  const byId = new Map(entries.map((e) => [e.def.id, e.payload]));

  const eonet = byId.get('eonet-events')!;
  const usgs = byId.get('usgs-quakes')!;
  const transit = byId.get('transit-kpis')!;

  // KPI row
  const kpiGrid = el('div', { class: 'dash-grid' });
  kpiGrid.appendChild(kpiCell('EONET open events', String(eonet.value ?? '—'), eonet.provenance));
  kpiGrid.appendChild(kpiCell('USGS M≥4.5 (week)', String(usgs.value ?? '—'), usgs.provenance));
  kpiGrid.appendChild(kpiCell('Transit KPIs', 'Unavailable', transit.provenance));
  root.appendChild(kpiGrid);

  // Hazard map
  const grid = el('div', { class: 'dash-grid' });
  const mapCell = el('div', { class: 'col-12' });
  grid.appendChild(mapCell);
  root.appendChild(grid);
  const mapCard = el('div', { class: 'glass chart-card' });
  mapCard.appendChild(el('h3', {}, ['Global hazard map (EONET + USGS)']));
  const mapBody = el('div', { class: 'chart-body', style: 'height:420px' });
  mapCard.appendChild(mapBody);
  mapCell.appendChild(mapCard);

  const eonetRows = (eonet.rows ?? []) as Array<{ Lat: number; Lng: number; Event: string; Category: string }>;
  const usgsRows = (usgs.rows ?? []) as Array<{ Lat: number; Lng: number; Place: string; Magnitude: number }>;
  const points = [
    ...eonetRows.map((r) => ({
      lat: Number(r.Lat), lng: Number(r.Lng),
      title: `${r.Event} (${r.Category})`, color: 'amber' as const, radius: 7,
    })),
    ...usgsRows.map((r) => ({
      lat: Number(r.Lat), lng: Number(r.Lng),
      title: `M${r.Magnitude} — ${r.Place}`, color: 'red' as const,
      radius: Math.max(6, Math.min(14, Number(r.Magnitude) * 2)),
    })),
  ];
  try {
    const handle = await dashMap(mapBody, points, { zoom: 2 });
    void handle;
  } catch (err) {
    mapBody.appendChild(unavailableState(err instanceof Error ? err.message : 'Map failed'));
  }

  // Tables: EONET + USGS side by side
  const grid2 = el('div', { class: 'dash-grid' });
  const eonetCell = el('div', { class: 'col-6' });
  const usgsCell = el('div', { class: 'col-6' });
  grid2.append(eonetCell, usgsCell);
  root.appendChild(grid2);
  eonetCell.appendChild(
    tableCell({
      title: 'NASA EONET open events',
      rows: eonetRows.map((r) => ({ Event: r.Event, Category: r.Category, Lat: r.Lat, Lng: r.Lng })),
      csvName: 'chokepoints-eonet.csv',
    }),
  );
  usgsCell.appendChild(
    tableCell({
      title: 'USGS earthquakes (M≥4.5, week)',
      rows: usgsRows.map((r) => ({ Place: r.Place, Magnitude: r.Magnitude, Lat: r.Lat, Lng: r.Lng })),
      csvName: 'chokepoints-usgs.csv',
    }),
  );

  // IMF PortWatch unavailable card
  const grid3 = el('div', { class: 'dash-grid' });
  const uCell = el('div', { class: 'col-12' });
  grid3.appendChild(uCell);
  root.appendChild(grid3);
  uCell.appendChild(unavailableCard(defs.find((d) => d.id === 'transit-kpis')!, transit));
  void entries;
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
