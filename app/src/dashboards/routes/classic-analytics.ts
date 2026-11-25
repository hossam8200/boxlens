// Classic Analytics — migration of the legacy "Dashboards" section from the
// single-file classic app (classic.html renderDashboards / renderDash) into the
// modern Vite dashboards app, rebuilt on the coastal-glass chart framework.
//
// Seven legacy views are reproduced behind a single view selector, each with
// KPI tiles + chart cards using the exact SAMPLE fixtures from the classic.
// Every card is tagged SAMPLE — these are illustrative fixtures, not live data.
import type { FilterState } from '../framework/types';
import { el } from '../framework/components';
import { lineChart, barChart, donutChart, gaugeChart } from '../framework/charts';
import { pageHeader, tableCell } from './_shared';

type ViewId = 'compliance' | 'coverage' | 'gate' | 'map' | 'arrivals' | 'combo' | 'exec';

interface ChartHandle {
  dispose: () => void;
}

const SAMPLE_BADGE = '<span class="dc-badge dc-sample"><span class="dot"></span>SAMPLE</span>';

const VIEW_LABELS: { id: ViewId; label: string }[] = [
  { id: 'compliance', label: 'Shipment compliance' },
  { id: 'coverage', label: 'Data coverage' },
  { id: 'gate', label: 'Gate & yard' },
  { id: 'map', label: 'Facility map' },
  { id: 'arrivals', label: 'Arrivals & congestion' },
  { id: 'combo', label: 'Combination view' },
  { id: 'exec', label: 'Executive summary' },
];

// Chart handles for the currently mounted view. Disposed before every view
// switch (and on re-entry to render()) so echarts instances never leak.
let activeCharts: ChartHandle[] = [];

export async function render(root: HTMLElement, filters: FilterState): Promise<void> {
  // Clean up any charts from a previous mount of this route.
  disposeActive();
  root.innerHTML = '';

  pageHeader(root, {
    title: 'Classic Analytics',
    blurb:
      'The legacy dashboards from the classic VGM tool, rebuilt on the modern chart framework. ' +
      'Illustrative SAMPLE fixtures — not live data.',
    note:
      'Filters: ' + (filters.port ?? 'all ports') + ' / ' + (filters.country ?? 'all countries'),
  });

  // View selector row.
  const controls = el('div', {
    class: 'glass',
    style:
      'padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap',
  });
  const sel = el('select', {
    class: 'classic-view-select',
    'aria-label': 'Classic dashboard view',
    style:
      'padding:6px 10px;border-radius:8px;border:1px solid rgba(15,40,80,0.15);background:var(--dash-glass,#fff);font-size:0.9rem;color:var(--dash-strong,#0f2240)',
  }) as HTMLSelectElement;
  for (const v of VIEW_LABELS) {
    sel.appendChild(el('option', { value: v.id }, [v.label]));
  }
  controls.appendChild(sel);
  controls.appendChild(el('span', { style: 'flex:1' }));
  controls.appendChild(
    el('span', { class: 'tiny muted', html: SAMPLE_BADGE + ' · Fresh · updated 2m ago' }),
  );
  root.appendChild(controls);

  const body = el('div', { class: 'classic-view-body' });
  root.appendChild(body);

  sel.value = 'compliance';
  sel.addEventListener('change', () => {
    void renderView(body, sel.value as ViewId);
  });

  await renderView(body, 'compliance');
}

async function renderView(body: HTMLElement, view: ViewId): Promise<void> {
  disposeActive();
  body.innerHTML = '';
  switch (view) {
    case 'compliance':
      return renderCompliance(body);
    case 'coverage':
      return renderCoverage(body);
    case 'gate':
      return renderGate(body);
    case 'map':
      return renderMap(body);
    case 'arrivals':
      return renderArrivals(body);
    case 'combo':
      return renderCombo(body);
    case 'exec':
      return renderExec(body);
  }
}

/* ---------------------------------- views ---------------------------------- */

async function renderCompliance(body: HTMLElement): Promise<void> {
  const kpis = el('div', { class: 'dash-grid' });
  kpis.append(
    kpiTile('Containers checked', '1,284', 'col-3'),
    kpiTile('VGM-ready', '78%', 'col-3', '#16a34a'),
    kpiTile('Overweight warnings', '142', 'col-3', '#d97706'),
    kpiTile('No-data list', '38', 'col-3', '#dc2626'),
  );
  body.appendChild(kpis);

  const mix = sampleChartCard('Result mix');
  const risk = sampleChartCard('Rejection risk by booking');
  const grid = el('div', { class: 'dash-grid' });
  grid.append(placeCell(mix.root, 'col-6'), placeCell(risk.root, 'col-6'));
  body.appendChild(grid);

  const trend = sampleChartCard('VGM-ready trend');
  const grid2 = el('div', { class: 'dash-grid' });
  grid2.append(placeCell(trend.root, 'col-12'));
  body.appendChild(grid2);

  await Promise.all([
    track(
      mix.body,
      donutChart(
        mix.body,
        [
          { name: 'Pass', value: 980, color: '#16a34a' },
          { name: 'Warning', value: 142, color: '#d97706' },
          { name: 'Fail', value: 124, color: '#dc2626' },
          { name: 'No data', value: 38, color: '#64748b' },
        ],
        '1,284',
      ),
    ),
    track(
      risk.body,
      barChart(
        risk.body,
        ['BK-001', 'BK-002', 'BK-003', 'BK-004', 'BK-005', 'BK-006', 'BK-007'],
        [{ name: 'Risk', data: [12, 28, 45, 18, 62, 30, 8], color: '#dc2626' }],
      ),
    ),
    track(
      trend.body,
      lineChart(
        trend.body,
        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        [{ name: 'VGM-ready', data: [68, 71, 74, 73, 78, 79, 78], color: '#0f766e' }],
        { area: true },
      ),
    ),
  ]);
}

async function renderCoverage(body: HTMLElement): Promise<void> {
  const kpis = el('div', { class: 'dash-grid' });
  kpis.append(
    kpiTile('Share found', '86%', 'col-4', '#16a34a'),
    kpiTile('Owners tracked', '14', 'col-4'),
    kpiTile('Countries', '42', 'col-4'),
  );
  body.appendChild(kpis);

  const owner = sampleChartCard('Coverage by owner');
  const country = sampleChartCard('Coverage by country (top 10)');
  const grid = el('div', { class: 'dash-grid' });
  grid.append(placeCell(owner.root, 'col-6'), placeCell(country.root, 'col-6'));
  body.appendChild(grid);

  const trend = sampleChartCard('Coverage trend');
  const grid2 = el('div', { class: 'dash-grid' });
  grid2.append(placeCell(trend.root, 'col-12'));
  body.appendChild(grid2);

  await Promise.all([
    track(
      owner.body,
      barChart(
        owner.body,
        ['MSC', 'Maersk', 'CMA CGM', 'COSCO', 'ONE', 'Hapag', 'Evergreen', 'OOCL', 'Yang Ming', 'HMM'],
        [{ name: 'Coverage', data: [92, 88, 79, 84, 76, 90, 71, 68, 82, 64], color: '#0f766e' }],
        { horizontal: true },
      ),
    ),
    track(
      country.body,
      donutChart(
        country.body,
        [
          { name: 'CN', value: 240 },
          { name: 'US', value: 180 },
          { name: 'DE', value: 160 },
          { name: 'NL', value: 140 },
          { name: 'SG', value: 120 },
          { name: 'AE', value: 110 },
          { name: 'KR', value: 90 },
          { name: 'JP', value: 80 },
          { name: 'IN', value: 70 },
          { name: 'GB', value: 60 },
        ],
        '1,250',
      ),
    ),
    track(
      trend.body,
      lineChart(
        trend.body,
        ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
        [
          { name: 'Found', data: [820, 880, 910, 940, 970, 1010, 1040, 1080], color: '#0f766e' },
          { name: 'Missing', data: [180, 160, 140, 120, 100, 90, 80, 70], color: '#dc2626' },
        ],
      ),
    ),
  ]);
}

async function renderGate(body: HTMLElement): Promise<void> {
  const kpis = el('div', { class: 'dash-grid' });
  kpis.append(
    kpiTile('Checks / hour', '342', 'col-4'),
    kpiTile('Validation failures', '47', 'col-4', '#dc2626'),
    kpiTile('Limits exceeded', '19', 'col-4', '#d97706'),
  );
  body.appendChild(kpis);

  const hour = sampleChartCard('Checks per hour (24h)');
  const err = sampleChartCard('Top error reasons');
  const grid = el('div', { class: 'dash-grid' });
  grid.append(placeCell(hour.root, 'col-6'), placeCell(err.root, 'col-6'));
  body.appendChild(grid);

  const term = sampleChartCard('Validation failures by terminal');
  const grid2 = el('div', { class: 'dash-grid' });
  grid2.append(placeCell(term.root, 'col-12'));
  body.appendChild(grid2);

  const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
  await Promise.all([
    track(
      hour.body,
      barChart(
        hour.body,
        hours,
        [{ name: 'Checks', data: [120, 90, 60, 40, 30, 50, 180, 320, 410, 380, 360, 350, 340, 330, 360, 370, 390, 420, 380, 300, 240, 180, 140, 110], color: '#0f766e' }],
      ),
    ),
    track(
      err.body,
      donutChart(
        err.body,
        [
          { name: 'Invalid check digit', value: 18 },
          { name: 'Overweight', value: 12, color: '#d97706' },
          { name: 'Size/type mismatch', value: 9 },
          { name: 'CSC expired', value: 6 },
          { name: 'Owner mismatch', value: 2, color: '#dc2626' },
        ],
        '47',
      ),
    ),
    track(
      term.body,
      barChart(
        term.body,
        ['DEHAM', 'NLRTM', 'AEJEA', 'SGSIN', 'CNSHA', 'USLAX', 'USNYC', 'BEANR'],
        [
          { name: 'Failures', data: [8, 12, 4, 9, 15, 6, 3, 7], color: '#dc2626' },
          { name: 'Limits exceeded', data: [3, 5, 1, 4, 6, 2, 1, 3], color: '#d97706' },
        ],
        { stack: true },
      ),
    ),
  ]);
}

async function renderMap(body: HTMLElement): Promise<void> {
  // Leaflet map is intentionally skipped (per spec); the lookups bar + a
  // facility list table carry the view.
  const facilities = [
    { code: 'DEHAM', name: 'Hamburg', lookups: 420 },
    { code: 'NLRTM', name: 'Rotterdam', lookups: 510 },
    { code: 'AEJEA', name: 'Jebel Ali', lookups: 280 },
    { code: 'SGSIN', name: 'Singapore', lookups: 470 },
    { code: 'CNSHA', name: 'Shanghai', lookups: 610 },
    { code: 'USLAX', name: 'Los Angeles', lookups: 330 },
    { code: 'USNYC', name: 'New York', lookups: 210 },
    { code: 'BEANR', name: 'Antwerp', lookups: 290 },
    { code: 'ESBCN', name: 'Barcelona', lookups: 180 },
    { code: 'INMUN', name: 'Mundra', lookups: 150 },
  ];
  const codes = facilities.map((f) => f.code);
  const lookups = facilities.map((f) => f.lookups);
  const total = lookups.reduce((a, b) => a + b, 0);

  const kpis = el('div', { class: 'dash-grid' });
  kpis.append(
    kpiTile('Total lookups (7d)', String(total), 'col-4'),
    kpiTile('Facilities', String(facilities.length), 'col-4'),
    kpiTile('Busiest', 'CNSHA · 610', 'col-4', '#0f766e'),
  );
  body.appendChild(kpis);

  const lookupsCard = sampleChartCard('Lookups by facility (last 7 days)');
  const grid = el('div', { class: 'dash-grid' });
  grid.append(placeCell(lookupsCard.root, 'col-12'));
  body.appendChild(grid);

  const table = tableCell({
    title: 'Facility list & code lookup history',
    columns: ['Facility', 'Code', 'Lookups'],
    rows: facilities.map((f) => ({ Facility: f.name, Code: f.code, Lookups: f.lookups })),
    csvName: 'classic-map-lookups.csv',
  });
  const grid2 = el('div', { class: 'dash-grid' });
  grid2.append(placeCell(table, 'col-12'));
  body.appendChild(grid2);

  await track(
    lookupsCard.body,
    barChart(
      lookupsCard.body,
      codes,
      [{ name: 'Lookups', data: lookups, color: '#0f766e' }],
    ),
  );
}

async function renderArrivals(body: HTMLElement): Promise<void> {
  const kpis = el('div', { class: 'dash-grid' });
  kpis.append(
    kpiTile('Approaching', '5', 'col-3'),
    kpiTile('At anchor', '2', 'col-3', '#d97706'),
    kpiTile('Alongside', '2', 'col-3', '#16a34a'),
    kpiTile('Avg queue', '19', 'col-3', '#d97706'),
  );
  body.appendChild(kpis);

  const states = sampleChartCard('Vessel states');
  const cong = sampleChartCard('Congestion score by port');
  const grid = el('div', { class: 'dash-grid' });
  grid.append(placeCell(states.root, 'col-6'), placeCell(cong.root, 'col-6'));
  body.appendChild(grid);

  const eta = sampleChartCard('ETA distribution (next 48h)');
  const grid2 = el('div', { class: 'dash-grid' });
  grid2.append(placeCell(eta.root, 'col-12'));
  body.appendChild(grid2);

  const etaLabels = Array.from({ length: 16 }, (_, i) => `+${i * 3}h`);
  await Promise.all([
    track(
      states.body,
      donutChart(
        states.body,
        [
          { name: 'Approaching', value: 5, color: '#0891b2' },
          { name: 'Waiting', value: 2, color: '#d97706' },
          { name: 'Alongside', value: 2, color: '#16a34a' },
        ],
        '9',
      ),
    ),
    track(
      cong.body,
      barChart(
        cong.body,
        ['NLRTM', 'USNYC', 'CNSHA', 'SGSIN', 'AEJEA', 'DEHAM', 'BEANR'],
        [{ name: 'Congestion', data: [78, 65, 52, 48, 22, 18, 15], color: '#d97706' }],
      ),
    ),
    track(
      eta.body,
      barChart(
        eta.body,
        etaLabels,
        [{ name: 'Vessels', data: [1, 2, 1, 0, 2, 1, 1, 0, 1, 2, 1, 0, 1, 1, 0, 1], color: '#0f766e' }],
      ),
    ),
  ]);
}

async function renderCombo(body: HTMLElement): Promise<void> {
  // Combination view for one shipment: MSC Isabella -> DEHAM. The classic uses
  // a dual-axis mixed line+bar chart; the modern framework exposes a single
  // value axis per chart, so the three signals are rendered as overlaid lines
  // (shape comparison only). Linked-container table is ported verbatim.
  const kpis = el('div', { class: 'dash-grid' });
  kpis.append(
    kpiTile('Distance now', '180 km', 'col-3'),
    kpiTile('Weather risk', '35', 'col-3', '#d97706'),
    kpiTile('Warnings peak', '2', 'col-3', '#d97706'),
    kpiTile('ETA est.', '~+24h', 'col-3'),
  );
  body.appendChild(kpis);

  const combo = sampleChartCard('Combination timeline — MSC Isabella → DEHAM');
  const grid = el('div', { class: 'dash-grid' });
  grid.append(placeCell(combo.root, 'col-12'));
  body.appendChild(grid);

  const table = tableCell({
    title: 'Linked containers',
    columns: ['Container', 'VGM', 'Max gross', 'Status'],
    rows: [
      { Container: 'CSQU3054383', VGM: '29,700 kg', 'Max gross': '30,480 kg', Status: 'OK' },
      { Container: 'MSKU1234565', VGM: '30,200 kg', 'Max gross': '30,480 kg', Status: 'Near limit' },
      { Container: 'CMAU3456787', VGM: '31,000 kg', 'Max gross': '34,800 kg', Status: 'Stale data' },
    ],
    csvName: 'classic-combo-linked-containers.csv',
  });
  const grid2 = el('div', { class: 'dash-grid' });
  grid2.append(placeCell(table, 'col-12'));
  body.appendChild(grid2);

  await track(
    combo.body,
    lineChart(
      combo.body,
      ['-24h', '-18h', '-12h', '-6h', 'now', '+6h', '+12h', '+18h', '+24h', 'ETA'],
      [
        { name: 'Vessel distance (km)', data: [420, 360, 300, 240, 180, 120, 80, 40, 15, 0], color: '#0f766e' },
        { name: 'Weather risk', data: [20, 22, 25, 30, 35, 40, 38, 30, 25, 20], color: '#d97706' },
        { name: 'Container warnings', data: [0, 0, 1, 1, 2, 2, 1, 1, 0, 0], color: '#dc2626' },
      ],
    ),
  );
}

async function renderExec(body: HTMLElement): Promise<void> {
  const kpis = el('div', { class: 'dash-grid' });
  kpis.append(
    kpiTile('Weekly volume', '1,284', 'col-3'),
    kpiTile('Issues avoided', '347', 'col-3', '#16a34a'),
    kpiTile('Time saved', '62h', 'col-3'),
    kpiTile('Teams active', '4', 'col-3'),
  );
  body.appendChild(kpis);

  const team = sampleChartCard('Usage by team');
  const covGauge = sampleChartCard('Data coverage');
  const vgmGauge = sampleChartCard('VGM-ready');
  const grid = el('div', { class: 'dash-grid' });
  grid.append(placeCell(team.root, 'col-6'), placeCell(covGauge.root, 'col-3'), placeCell(vgmGauge.root, 'col-3'));
  body.appendChild(grid);

  const avoid = sampleChartCard('Issues avoided (8 weeks)');
  const time = sampleChartCard('Time saved (hours/week)');
  const grid2 = el('div', { class: 'dash-grid' });
  grid2.append(placeCell(avoid.root, 'col-6'), placeCell(time.root, 'col-6'));
  body.appendChild(grid2);

  await Promise.all([
    track(
      team.body,
      donutChart(
        team.body,
        [
          { name: 'Forwarding', value: 480, color: '#0f766e' },
          { name: 'Ocean', value: 320, color: '#0891b2' },
          { name: 'Depot', value: 240, color: '#2563eb' },
          { name: 'Compliance', value: 160, color: '#d97706' },
          { name: 'Sales', value: 84, color: '#7c3aed' },
        ],
        '1,284',
      ),
    ),
    track(covGauge.body, gaugeChart(covGauge.body, 86, { label: 'Coverage', unit: '%' })),
    track(vgmGauge.body, gaugeChart(vgmGauge.body, 78, { label: 'VGM-ready', unit: '%' })),
    track(
      avoid.body,
      barChart(
        avoid.body,
        ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
        [{ name: 'Issues avoided', data: [210, 240, 265, 290, 310, 330, 340, 347], color: '#16a34a' }],
      ),
    ),
    track(
      time.body,
      lineChart(
        time.body,
        ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
        [{ name: 'Time saved', data: [38, 42, 46, 50, 54, 56, 60, 62], color: '#0f766e' }],
        { area: true },
      ),
    ),
  ]);
}

/* --------------------------------- helpers --------------------------------- */

function disposeActive(): void {
  for (const c of activeCharts) {
    try {
      c.dispose();
    } catch {
      /* ignore — chart may already be gone */
    }
  }
  activeCharts = [];
}

/** Await a chart helper, register its dispose handle, and never reject. */
async function track(body: HTMLElement, p: Promise<ChartHandle>): Promise<void> {
  try {
    const h = await p;
    activeCharts.push(h);
  } catch (err) {
    body.innerHTML =
      '<div class="tiny muted" style="padding:12px">Chart unavailable: ' +
      escape(err instanceof Error ? err.message : String(err)) +
      '</div>';
  }
}

/** KPI tile styled like the framework's kpi-card, tagged SAMPLE. */
function kpiTile(label: string, value: string, col: string, tone?: string): HTMLElement {
  const card = el('div', { class: `glass kpi-card ${col}` });
  const toneStyle = tone ? ` style="color:${tone}"` : '';
  card.innerHTML =
    `<div class="kpi-label">${escape(label)}</div>` +
    `<div><span class="kpi-value"${toneStyle}>${escape(value)}</span></div>` +
    `<div class="prov-meta">${SAMPLE_BADGE}</div>`;
  return card;
}

/** Chart card with SAMPLE badge and a chart-body div passed to a chart helper. */
function sampleChartCard(title: string): { root: HTMLElement; body: HTMLElement } {
  const root = el('div', { class: 'glass chart-card' });
  const head = el('div', { class: 'chart-head' });
  head.innerHTML = `<h3>${escape(title)}</h3><span class="spacer"></span>${SAMPLE_BADGE}`;
  const cardBody = el('div', { class: 'chart-body' });
  root.append(head, cardBody);
  return { root, body: cardBody };
}

/** Wrap a card in a responsive grid cell. */
function placeCell(card: HTMLElement, col: string): HTMLElement {
  const cell = el('div', { class: col });
  cell.appendChild(card);
  return cell;
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
