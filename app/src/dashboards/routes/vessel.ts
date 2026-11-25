// Vessel Activity (AIS) — UNAVAILABLE without an aisstream.io key + cron.
// Renders an honest explainer page: status cards, the architecture diagram
// (cron → Supabase → API → dashboard) and the next-steps checklist.
import type { FilterState } from '../framework/types';
import { getDashboardWidgets } from '../framework/registry';
import { el, unavailableState } from '../framework/components';
import { pageHeader, fetchAll, unavailableCard, tableCell } from './_shared';

export async function render(root: HTMLElement, _filters: FilterState): Promise<void> {
  const defs = getDashboardWidgets('vessel');
  pageHeader(root, {
    title: 'Vessel Activity (AIS)',
    blurb:
      'Live vessel positions require an aisstream.io API key + a GitHub Actions cron that ingests ' +
      'snapshots into Supabase. Until AISSTREAM_KEY is set, AIS widgets render UNAVAILABLE — never ' +
      'sample positions presented as live. A voyage-ETA showcase gives real (estimated) transit content ' +
      'for the major container lanes in the meantime.',
    note: 'AIS shows vessels, not containers. Voyage ETA is an offline ESTIMATE — verify against the carrier schedule.',
  });

  const entries = await fetchAll(defs);

  // Voyage ETA showcase — real (estimated) transit content for major lanes.
  const voyageEntry = entries.find((e) => e.def.id === 'voyage-eta');
  if (voyageEntry) {
    const voyageRows = (voyageEntry.payload.rows ?? []) as Array<Record<string, string | number | null>>;
    const vGrid = el('div', { class: 'dash-grid' });
    const vCell = el('div', { class: 'col-12' });
    vGrid.appendChild(vCell);
    root.appendChild(vGrid);
    if (voyageRows.length) {
      vCell.appendChild(
        tableCell({
          title: 'Voyage ETA — major container lanes (chokepoint-aware estimate)',
          rows: voyageRows,
          csvName: 'vessel-voyage-eta.csv',
        }),
      );
    } else {
      vCell.appendChild(unavailableCard(voyageEntry.def, voyageEntry.payload));
    }
  }

  // AIS widgets — honest UNAVAILABLE cards side by side.
  const aisEntries = entries.filter((e) => e.def.id !== 'voyage-eta');
  const grid = el('div', { class: 'dash-grid' });
  for (const e of aisEntries) {
    const cell = el('div', { class: 'col-6' });
    cell.appendChild(unavailableCard(e.def, e.payload));
    grid.appendChild(cell);
  }
  root.appendChild(grid);

  // Architecture explainer card.
  const arch = el('div', { class: 'glass chart-card' });
  arch.appendChild(el('h3', {}, ['How AIS gets wired (production cut)']));
  const archBody = el('div', { class: 'chart-body' });
  archBody.innerHTML = `
    <div class="arch-flow">
      <div class="arch-step"><div class="arch-ico">🔑</div><div><strong>1. Secret</strong><br><span class="small muted">AISSTREAM_KEY in Vercel + Actions env</span></div></div>
      <div class="arch-arrow">→</div>
      <div class="arch-step"><div class="arch-ico">⏱️</div><div><strong>2. Cron</strong><br><span class="small muted">GitHub Actions every 5 min, WebSocket to aisstream.io</span></div></div>
      <div class="arch-arrow">→</div>
      <div class="arch-step"><div class="arch-ico">🗄️</div><div><strong>3. Store</strong><br><span class="small muted">Supabase Postgres + PostGIS, anonymised aggregates</span></div></div>
      <div class="arch-arrow">→</div>
      <div class="arch-step"><div class="arch-ico">🌐</div><div><strong>4. API</strong><br><span class="small muted">/api/v1/dashboards/vessel/* reads latest snapshot</span></div></div>
      <div class="arch-arrow">→</div>
      <div class="arch-step"><div class="arch-ico">🚢</div><div><strong>5. UI</strong><br><span class="small muted">Live map + port density (this dashboard)</span></div></div>
    </div>
    <p class="small muted" style="margin-top:14px">Quota: 200 calls/day on the aisstream.io free tier. The cron batches snapshots to stay well under the limit.</p>`;
  arch.appendChild(archBody);
  root.appendChild(arch);

  // Next-steps checklist.
  const steps = el('div', { class: 'glass chart-card' });
  steps.appendChild(el('h3', {}, ['Next steps to enable']));
  const list = el('ul', { class: 'ais-checklist' });
  list.innerHTML = `
    <li>Register at <a href="https://aisstream.io/" target="_blank" rel="noopener">aisstream.io</a> and request a free API key.</li>
    <li>Add <code>AISSTREAM_KEY</code> as a Vercel + GitHub Actions secret.</li>
    <li>Provision a Supabase Postgres + PostGIS table for AIS snapshots.</li>
    <li>Add the GitHub Actions cron workflow (every 5 min) that opens a WebSocket to aisstream.io for the configured bounding boxes and writes anonymised aggregates.</li>
    <li>Wire <code>/api/v1/dashboards/vessel/*</code> to read the latest snapshot from Supabase; replace the UNAVAILABLE resolver in <code>api/_lib/widgets.ts</code>.</li>`;
  steps.appendChild(list);
  root.appendChild(steps);

  // Honest empty state for the would-be map area.
  const map = el('div', { class: 'glass chart-card' });
  map.appendChild(el('h3', {}, ['Vessel positions (would render here)']));
  const mapBody = el('div', { class: 'chart-body', style: 'height:280px' });
  mapBody.appendChild(unavailableState('AIS vessel positions are UNAVAILABLE until the ingestion pipeline above is wired.'));
  map.appendChild(mapBody);
  root.appendChild(map);
}
