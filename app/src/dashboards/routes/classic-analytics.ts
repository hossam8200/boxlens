// Classic Analytics — the seven legacy views from the classic VGM tool, rebuilt
// on the modern chart framework and driven by REAL free data. No SAMPLE
// fixtures: every KPI, chart and table is wired to the same live/daily/annual
// widget endpoints the other eight dashboards use, and carries a real
// provenance badge (DAILY / ESTIMATE / ANNUAL / UNAVAILABLE).
//
// Real sources behind the views:
//  - Open-Meteo Marine (per-port wind / wave / swell / visibility)  → DAILY
//  - World Bank (trade % GDP, container throughput, LPI)             → ANNUAL
//  - NASA EONET + USGS earthquakes                                  → LIVE
//  - Nager.Date public holidays                                     → DAILY
//  - Frankfurter (ECB reference FX)                                 → DAILY
//  - BoxLens quota manager + risk/congestion engine                 → LIVE / ESTIMATE
//
// Where a legacy metric has no free public source (live vessel states from
// AIS, per-shipment linked-container weights), the view shows an honest
// UNAVAILABLE card with the method that would unlock it — never a silent
// blank, never a fabricated number. AIS vessels show vessels, not containers;
// VGM stays a draft, never a certification.
import type { FilterState, Provenance, WidgetDef, WidgetPayload } from '../framework/types';
import { getDashboardWidgets } from '../framework/registry';
import { el, kpiCard, chartCard, unavailableState } from '../framework/components';
import { exportTableCsv } from '../framework/export';
import { lineChart, barChart, donutChart, gaugeChart } from '../framework/charts';
import { dashMap } from '../framework/map';
import { pageHeader, tableCell, fetchAll, pctDelta } from './_shared';

type ViewId = 'compliance' | 'coverage' | 'gate' | 'map' | 'arrivals' | 'combo' | 'exec';

interface ChartHandle {
  dispose: () => void;
}

type Row = Record<string, string | number | null>;

const VIEW_LABELS: { id: ViewId; label: string }[] = [
  { id: 'compliance', label: 'Shipment compliance' },
  { id: 'coverage', label: 'Data coverage' },
  { id: 'gate', label: 'Gate & operations' },
  { id: 'map', label: 'Facility map' },
  { id: 'arrivals', label: 'Arrivals & congestion' },
  { id: 'combo', label: 'Combination view' },
  { id: 'exec', label: 'Executive summary' },
];

// Chart handles for the currently mounted view. Disposed before every view
// switch (and on re-entry to render()) so echarts instances never leak.
let activeCharts: ChartHandle[] = [];
// Widget payloads fetched once per mount; every view reads from this cache.
let cachedEntries: { def: WidgetDef; payload: WidgetPayload }[] = [];

export async function render(root: HTMLElement, filters: FilterState): Promise<void> {
  disposeActive();
  root.innerHTML = '';

  pageHeader(root, {
    title: 'Classic Analytics',
    blurb:
      'The seven legacy views from the classic VGM tool, rebuilt on the modern chart framework and ' +
      'driven by the same real free data as the other dashboards — Open-Meteo Marine per-port ' +
      'conditions, World Bank trade & throughput, NASA EONET + USGS, Nager.Date and the BoxLens ' +
      'risk engine. No SAMPLE fixtures; every value carries a real provenance badge.',
    note: 'Filters: ' + (filters.port ?? 'all ports') + ' / ' + (filters.country ?? 'all countries'),
  });

  // Fetch every widget the seven views need, in parallel, once per mount.
  // These are the real endpoints behind the Executive, Compliance, Weather,
  // Trade, Chokepoints and Vessel dashboards — never SAMPLE fixtures.
  const defs = [
    ...getDashboardWidgets('executive'),
    ...getDashboardWidgets('compliance'),
    ...getDashboardWidgets('weather'),
    ...getDashboardWidgets('trade'),
    ...getDashboardWidgets('chokepoints'),
    ...getDashboardWidgets('vessel'),
  ];
  cachedEntries = await fetchAll(defs);

  // View selector — a responsive grid of buttons (one per legacy view), not a
  // dropdown. auto-fit wraps to one column on narrow screens.
  let currentView: ViewId = 'compliance';
  const controls = el('div', {
    class: 'glass classic-view-grid',
    style:
      'padding:12px 14px;margin-bottom:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px',
  });
  const buttons: Record<string, HTMLButtonElement> = {};
  for (const v of VIEW_LABELS) {
    const btn = el(
      'button',
      {
        class: 'classic-view-btn',
        'data-view': v.id,
        type: 'button',
        style:
          'padding:10px 12px;border-radius:8px;border:1px solid rgba(15,40,80,0.15);background:var(--dash-glass,#fff);color:var(--dash-strong,#0f2240);font-size:0.88rem;cursor:pointer;text-align:left',
      },
      [v.label],
    ) as HTMLButtonElement;
    buttons[v.id] = btn;
    btn.addEventListener('click', () => {
      if (currentView === v.id) return;
      currentView = v.id;
      setActiveBtn(v.id);
      void renderView(body, v.id);
    });
    controls.appendChild(btn);
  }
  root.appendChild(controls);
  root.appendChild(
    el('div', {
      class: 'tiny muted',
      style: 'margin-bottom:12px',
      html: 'Real free data · Open-Meteo Marine · World Bank · NASA EONET · USGS · Nager.Date · Frankfurter · BoxLens risk engine',
    }),
  );

  const body = el('div', { class: 'classic-view-body' });
  root.appendChild(body);

  function setActiveBtn(id: ViewId): void {
    for (const [vid, btn] of Object.entries(buttons)) {
      const active = vid === id;
      btn.style.fontWeight = active ? '700' : '400';
      btn.style.borderColor = active ? 'var(--dash-accent,#0f766e)' : 'rgba(15,40,80,0.15)';
      btn.style.background = active
        ? 'color-mix(in srgb, var(--dash-accent,#0f766e) 14%, var(--dash-glass,#fff))'
        : 'var(--dash-glass,#fff)';
    }
  }

  setActiveBtn(currentView);
  await renderView(body, currentView);
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
  // Shipment compliance — real per-port operational classification from
  // Open-Meteo Marine. Pass/warn/fail, overweight-risk proxy (ESTIMATE) and the
  // 7-day representative-port forecast trend.
  body.appendChild(
    kpiGrid(['checks-today', 'pass-rate', 'vgm-overweight', 'iso-violations'], 'col-3'),
  );

  const pass = num('pass-rate');
  const warn = num('warn-rate');
  const fail = num('fail-rate');
  const mix = chartCardCell('Result mix (ports by class)', 'pass-rate', 'classic-compliance-mix.csv', [
    { Bucket: 'Pass', Ports: pass },
    { Bucket: 'Warn', Ports: warn },
    { Bucket: 'Fail', Ports: fail },
  ]);
  const top = rows('top-failures');
  const risk = chartCardCell('Operational risk by port', 'top-failures', 'classic-compliance-risk.csv', top);
  const grid = el('div', { class: 'dash-grid' });
  grid.append(placeCell(mix.root, 'col-6'), placeCell(risk.root, 'col-6'));
  body.appendChild(grid);

  const pr = entry('pass-rate');
  const trend = chartCardCell(
    'Pass-rate trend (7-day representative-port forecast)',
    'pass-rate',
    'classic-compliance-trend.csv',
    (pr?.payload.labels ?? []).map((l, i) => ({ Day: l, 'Pass %': pr?.payload.series?.[i] ?? 0 })),
  );
  const grid2 = el('div', { class: 'dash-grid' });
  grid2.append(placeCell(trend.root, 'col-12'));
  body.appendChild(grid2);

  await Promise.all([
    mountChart(mix.body, donutChart(mix.body, [
      { name: 'Pass', value: pass, color: '#16a34a' },
      { name: 'Warn', value: warn, color: '#d97706' },
      { name: 'Fail', value: fail, color: '#dc2626' },
    ], `${pass + warn + fail} ports`)),
    mountChart(risk.body, barChart(
      risk.body,
      top.map((r) => String(r['Port'] ?? '')),
      [{ name: 'Risk score', data: top.map((r) => Number(r['Score'] ?? 0)), color: '#dc2626' }],
      { horizontal: true },
    )),
    mountChart(trend.body, lineChart(
      trend.body,
      pr?.payload.labels ?? [],
      [{ name: 'Pass %', data: pr?.payload.series ?? [], color: '#0f766e' }],
      { area: true },
    )),
  ]);
}

async function renderCoverage(body: HTMLElement): Promise<void> {
  // Data coverage — real country coverage (ports with live Open-Meteo data vs
  // the UN/LOCODE country total) and World Bank container throughput by country.
  body.appendChild(
    kpiGrid(['owner-coverage', 'container-throughput', 'trade-gdp-pct'], 'col-4'),
  );

  const cov = rows('owner-coverage');
  const owner = chartCardCell('Coverage by country (live data %)', 'owner-coverage', 'classic-coverage-country.csv', cov);
  const thru = rows('container-throughput');
  const thruTop = thru.slice(0, 8);
  const country = chartCardCell('Container throughput by country (TEU)', 'container-throughput', 'classic-coverage-throughput.csv', thruTop);
  const grid = el('div', { class: 'dash-grid' });
  grid.append(placeCell(owner.root, 'col-6'), placeCell(country.root, 'col-6'));
  body.appendChild(grid);

  const iso = entry('iso-violations');
  const trend = chartCardCell(
    'Ports failing thresholds (7-day trend)',
    'iso-violations',
    'classic-coverage-trend.csv',
    (iso?.payload.labels ?? []).map((l, i) => ({ Day: l, 'Failing ports': iso?.payload.series?.[i] ?? 0 })),
  );
  const grid2 = el('div', { class: 'dash-grid' });
  grid2.append(placeCell(trend.root, 'col-12'));
  body.appendChild(grid2);

  await Promise.all([
    mountChart(owner.body, barChart(
      owner.body,
      cov.map((r) => String(r['Country'] ?? '')),
      [{ name: 'With data %', data: cov.map((r) => Number(r['With data %'] ?? 0)), color: '#0f766e' }],
      { horizontal: true },
    )),
    mountChart(country.body, donutChart(
      country.body,
      thruTop.map((r) => ({ name: String(r['Country'] ?? ''), value: Number(r['Value'] ?? 0) })),
      `${thruTop.length} countries`,
    )),
    mountChart(trend.body, lineChart(
      trend.body,
      iso?.payload.labels ?? [],
      [{ name: 'Failing ports', data: iso?.payload.series ?? [], color: '#dc2626' }],
      { area: true },
    )),
  ]);
}

async function renderGate(body: HTMLElement): Promise<void> {
  // Gate & operations — no free public gate-throughput feed exists, so the view
  // is reframed honestly around real per-port operational conditions: ports by
  // operational class, the rule-engine breakdown, and per-port wind+wave risk.
  body.appendChild(kpiGrid(['active-ports', 'iso-violations', 'vgm-overweight'], 'col-4'));

  const ports = rows('active-ports');
  const byClass = bucketClass(ports);
  const classCard = chartCardCell('Ports by operational class', 'active-ports', 'classic-gate-class.csv', byClass);
  const ruleRows = rows('rule-matrix');
  const ruleSums = sumRules(ruleRows);
  const ruleCard = chartCardCell('Rule-engine breakdown', 'rule-matrix', 'classic-gate-rules.csv', ruleSums);
  const grid = el('div', { class: 'dash-grid' });
  grid.append(placeCell(classCard.root, 'col-6'), placeCell(ruleCard.root, 'col-6'));
  body.appendChild(grid);

  const top = rows('top-failures').slice(0, 8);
  const term = chartCardCell('Per-port wind & wave (top risks)', 'top-failures', 'classic-gate-ports.csv', top);
  const grid2 = el('div', { class: 'dash-grid' });
  grid2.append(placeCell(term.root, 'col-12'));
  body.appendChild(grid2);

  await Promise.all([
    mountChart(classCard.body, barChart(
      classCard.body,
      byClass.map((r) => String(r['Class'] ?? '')),
      [{ name: 'Ports', data: byClass.map((r) => Number(r['Count'] ?? 0)), color: '#0f766e' }],
    )),
    mountChart(ruleCard.body, donutChart(
      ruleCard.body,
      [
        { name: 'Pass', value: Number(ruleSums[0]?.['Count'] ?? 0), color: '#16a34a' },
        { name: 'Warn', value: Number(ruleSums[1]?.['Count'] ?? 0), color: '#d97706' },
        { name: 'Fail', value: Number(ruleSums[2]?.['Count'] ?? 0), color: '#dc2626' },
      ],
      'rules',
    )),
    mountChart(term.body, barChart(
      term.body,
      top.map((r) => String(r['Port'] ?? '')),
      [
        { name: 'Wind (kt)', data: top.map((r) => Number(r['Wind'] ?? 0)), color: '#0891b2' },
        { name: 'Wave (m)', data: top.map((r) => Number(r['Wave'] ?? 0) * 10), color: '#0f766e' },
      ],
      { stack: true },
    )),
  ]);
}

async function renderMap(body: HTMLElement): Promise<void> {
  // Facility map — real Leaflet map of the ports in scope, coloured by
  // operational class, plus the per-port conditions drill-down table.
  const ports = rows('active-ports') as Array<Row & {
    Lat: number; Lng: number; Port: string; Country: string;
    Wind: number; Wave: number; Class: string; Score: number;
  }>;
  const total = ports.length;
  const busiest = ports.slice().sort((a, b) => Number(b['Score'] ?? 0) - Number(a['Score'] ?? 0))[0];

  const kpis = el('div', { class: 'dash-grid' });
  kpis.append(
    placeCell(kpiById('active-ports', 'ports monitored'), 'col-4'),
    kpiTileCard('Facilities', String(total), prov('active-ports'), 'col-4'),
    kpiTileCard('Highest risk', busiest ? `${String(busiest['Port'])} · ${String(busiest['Score'])}` : '—', prov('top-failures'), 'col-4', '#dc2626'),
  );
  body.appendChild(kpis);

  const mapCard = el('div', { class: 'glass chart-card' });
  const mapHead = el('div', { class: 'chart-head' });
  mapHead.innerHTML = `<h3>Ports in scope (real conditions)</h3>`;
  if (ports.length) {
    const meta = prov('active-ports');
    const metaEl = el('div', { class: 'prov-meta' });
    metaEl.innerHTML = provHtml(meta);
    mapHead.appendChild(metaEl);
  }
  mapCard.appendChild(mapHead);
  const mapBody = el('div', { class: 'chart-body', style: 'height:360px' });
  mapCard.appendChild(mapBody);
  const mapCell = el('div', { class: 'col-12' });
  mapCell.appendChild(mapCard);
  const grid = el('div', { class: 'dash-grid' });
  grid.appendChild(mapCell);
  body.appendChild(grid);

  try {
    const points = ports.map((r) => {
      const color: 'teal' | 'amber' | 'red' =
        String(r['Class']) === 'fail' ? 'red' : String(r['Class']) === 'warn' ? 'amber' : 'teal';
      return {
        lat: Number(r['Lat']),
        lng: Number(r['Lng']),
        title: `${r['Port']} · ${r['Wind']} kt · ${r['Class']}`,
        color,
        radius: 9,
      };
    });
    const handle = await dashMap(mapBody, points, { zoom: 2 });
    activeCharts.push(handle);
  } catch (err) {
    mapBody.appendChild(unavailableState(err instanceof Error ? err.message : 'Map failed'));
  }

  const table = tableCell({
    title: 'Facility list & per-port conditions',
    columns: ['Port', 'Country', 'Wind', 'Wave', 'Class', 'Score'],
    rows: ports.map((r) => ({
      Port: r['Port'],
      Country: r['Country'],
      Wind: `${r['Wind']} kt`,
      Wave: `${r['Wave']} m`,
      Class: r['Class'],
      Score: r['Score'],
    })),
    csvName: 'classic-map-ports.csv',
  });
  const grid2 = el('div', { class: 'dash-grid' });
  grid2.append(placeCell(table, 'col-12'));
  body.appendChild(grid2);
}

async function renderArrivals(body: HTMLElement): Promise<void> {
  // Arrivals & congestion — live vessel states need AIS (UNAVAILABLE without a
  // key + cron), so that card is honest about it. The congestion score and the
  // per-port risk are real ESTIMATES from Open-Meteo + the risk engine.
  body.appendChild(
    kpiGrid(['active-ports', 'risk-score', 'iso-violations', 'vgm-overweight'], 'col-3'),
  );

  const ais = entry('ais-snapshot');
  const statesCard = el('div', { class: 'glass chart-card' });
  const statesHead = el('div', { class: 'chart-head' });
  statesHead.innerHTML = `<h3>Vessel states (approaching / waiting / alongside)</h3>`;
  const statesBody = el('div', { class: 'chart-body' });
  statesCard.append(statesHead, statesBody);
  if (ais && ais.payload.provenance.class === 'UNAVAILABLE') {
    statesBody.appendChild(unavailableState(ais.payload.provenance.method ?? 'AIS requires an aisstream.io API key + cron ingestion.'));
  } else {
    statesBody.appendChild(unavailableState('Live vessel states require an aisstream.io API key + cron.'));
  }

  const top = rows('top-failures').slice(0, 8);
  const cong = chartCardCell('Congestion-risk score by port', 'top-failures', 'classic-arrivals-congestion.csv', top);
  const grid = el('div', { class: 'dash-grid' });
  grid.append(placeCell(statesCard, 'col-6'), placeCell(cong.root, 'col-6'));
  body.appendChild(grid);

  const riskRows = rows('risk-score');
  const factors = chartCardCell('Risk-score factor breakdown', 'risk-score', 'classic-arrivals-factors.csv', riskRows);
  const grid2 = el('div', { class: 'dash-grid' });
  grid2.append(placeCell(factors.root, 'col-12'));
  body.appendChild(grid2);

  await Promise.all([
    mountChart(cong.body, barChart(
      cong.body,
      top.map((r) => String(r['Port'] ?? '')),
      [{ name: 'Risk score', data: top.map((r) => Number(r['Score'] ?? 0)), color: '#d97706' }],
    )),
    mountChart(factors.body, barChart(
      factors.body,
      riskRows.filter((r) => String(r['Factor'] ?? '') !== 'Total').map((r) => String(r['Factor'] ?? '')),
      [{ name: 'Contribution', data: riskRows.filter((r) => String(r['Factor'] ?? '') !== 'Total').map((r) => Number(r['Contribution'] ?? 0)), color: '#0891b2' }],
    )),
  ]);
}

async function renderCombo(body: HTMLElement): Promise<void> {
  // Combination view — reframed from a single legacy shipment (operational, no
  // free source) to a real selected-port conditions combo: current marine
  // snapshot + risk score, the 7-day pass/warn/fail forecast, and an honest
  // UNAVAILABLE card for per-shipment linked-container weights.
  const marine = entry('marine-snapshot')?.payload.value as
    | { windKnots?: number; waveM?: number; swellM?: number; visibilityKm?: number }
    | null
    | undefined;
  const risk = num('risk-score');
  const kpis = el('div', { class: 'dash-grid' });
  kpis.append(
    kpiTileCard('Wind', marine?.windKnots != null ? `${marine.windKnots} kt` : '—', prov('marine-snapshot'), 'col-3', '#0891b2'),
    kpiTileCard('Wave', marine?.waveM != null ? `${marine.waveM} m` : '—', prov('marine-snapshot'), 'col-3', '#0f766e'),
    kpiTileCard('Visibility', marine?.visibilityKm != null ? `${marine.visibilityKm} km` : '—', prov('marine-snapshot'), 'col-3'),
    kpiTileCard('Risk score', risk != null ? String(risk) : '—', prov('risk-score'), 'col-3', '#d97706'),
  );
  body.appendChild(kpis);

  const pr = entry('pass-rate');
  const wr = entry('warn-rate');
  const fl = entry('fail-rate');
  const labels = pr?.payload.labels ?? [];
  const combo = chartCardCell(
    'Operational forecast — pass / warn / fail (representative port)',
    'pass-rate',
    'classic-combo-forecast.csv',
    labels.map((l, i) => ({
      Day: l,
      Pass: pr?.payload.series?.[i] ?? 0,
      Warn: wr?.payload.series?.[i] ?? 0,
      Fail: fl?.payload.series?.[i] ?? 0,
    })),
  );
  const grid = el('div', { class: 'dash-grid' });
  grid.append(placeCell(combo.root, 'col-12'));
  body.appendChild(grid);

  // Per-shipment linked containers are operational data — no free public feed.
  const linked = el('div', { class: 'glass chart-card' });
  const linkedHead = el('div', { class: 'chart-head' });
  linkedHead.innerHTML = `<h3>Linked containers (per shipment)</h3>`;
  const linkedBody = el('div', { class: 'chart-body' });
  linkedBody.appendChild(
    unavailableState(
      'Per-shipment linked-container weights are operational data with no free public feed. ' +
      'Wire a terminal TOS / VGM declaration feed, or use the in-app VGM Method 2 calculator to ' +
      'compute a draft weight per container.',
    ),
  );
  linked.append(linkedHead, linkedBody);
  const grid2 = el('div', { class: 'dash-grid' });
  grid2.append(placeCell(linked, 'col-12'));
  body.appendChild(grid2);

  await mountChart(combo.body, lineChart(
    combo.body,
    labels,
    [
      { name: 'Pass %', data: pr?.payload.series ?? [], color: '#16a34a' },
      { name: 'Warn %', data: wr?.payload.series ?? [], color: '#d97706' },
      { name: 'Fail %', data: fl?.payload.series ?? [], color: '#dc2626' },
    ],
    { area: true },
  ));
}

async function renderExec(body: HTMLElement): Promise<void> {
  // Executive summary — real headline KPIs, ports-by-class donut, coverage +
  // VGM-ready gauges, top-risk ports and the pass-rate trend.
  body.appendChild(
    kpiGrid(['checks-today', 'iso-violations', 'active-ports', 'free-tier-budget'], 'col-3'),
  );

  const ports = rows('active-ports');
  const byClass = bucketClass(ports);
  const team = chartCardCell('Ports by operational class', 'active-ports', 'classic-exec-class.csv', byClass);
  const covVal = num('owner-coverage');
  const vgmVal = num('pass-rate');
  const covGauge = chartCardCell('Data coverage', 'owner-coverage', 'classic-exec-coverage.csv', [{ Metric: 'Coverage %', Value: covVal }]);
  const vgmGauge = chartCardCell('VGM-ready (pass rate)', 'pass-rate', 'classic-exec-vgm.csv', [{ Metric: 'Pass %', Value: vgmVal }]);
  const grid = el('div', { class: 'dash-grid' });
  grid.append(placeCell(team.root, 'col-6'), placeCell(covGauge.root, 'col-3'), placeCell(vgmGauge.root, 'col-3'));
  body.appendChild(grid);

  const top = rows('top-failures').slice(0, 8);
  const avoid = chartCardCell('Top operational risks (by port)', 'top-failures', 'classic-exec-risks.csv', top);
  const pr = entry('pass-rate');
  const time = chartCardCell(
    'Pass-rate trend (7-day forecast)',
    'pass-rate',
    'classic-exec-trend.csv',
    (pr?.payload.labels ?? []).map((l, i) => ({ Day: l, 'Pass %': pr?.payload.series?.[i] ?? 0 })),
  );
  const grid2 = el('div', { class: 'dash-grid' });
  grid2.append(placeCell(avoid.root, 'col-6'), placeCell(time.root, 'col-6'));
  body.appendChild(grid2);

  await Promise.all([
    mountChart(team.body, donutChart(
      team.body,
      byClass.map((r) => ({
        name: String(r['Class'] ?? ''),
        value: Number(r['Count'] ?? 0),
        color: String(r['Class']) === 'fail' ? '#dc2626' : String(r['Class']) === 'warn' ? '#d97706' : '#16a34a',
      })),
      `${ports.length} ports`,
    )),
    mountChart(covGauge.body, gaugeChart(covGauge.body, covVal, { label: 'Coverage', unit: '%' })),
    mountChart(vgmGauge.body, gaugeChart(vgmGauge.body, vgmVal, { label: 'VGM-ready', unit: '%' })),
    mountChart(avoid.body, barChart(
      avoid.body,
      top.map((r) => String(r['Port'] ?? '')),
      [{ name: 'Risk score', data: top.map((r) => Number(r['Score'] ?? 0)), color: '#dc2626' }],
      { horizontal: true },
    )),
    mountChart(time.body, lineChart(
      time.body,
      pr?.payload.labels ?? [],
      [{ name: 'Pass %', data: pr?.payload.series ?? [], color: '#0f766e' }],
      { area: true },
    )),
  ]);
}

/* --------------------------------- helpers --------------------------------- */

function entry(id: string): { def: WidgetDef; payload: WidgetPayload } | undefined {
  return cachedEntries.find((e) => e.def.id === id);
}

function prov(id: string): Provenance {
  const e = entry(id);
  if (e) return e.payload.provenance;
  return {
    source: 'BoxLens',
    fetchedAt: new Date(0).toISOString(),
    ttl: 60,
    stale: false,
    class: 'UNAVAILABLE',
    method: 'No payload fetched for this widget.',
  };
}

/** Numeric headline value of a widget, or 0 when missing. */
function num(id: string): number {
  const v = entry(id)?.payload.value;
  return typeof v === 'number' ? v : 0;
}

/** Drill-down rows of a widget (empty array when missing). */
function rows(id: string): Row[] {
  const r = entry(id)?.payload.rows;
  return (r ?? []) as Row[];
}

/** Minimal inline provenance meta HTML for hand-built cards. */
function provHtml(p: Provenance): string {
  const stale = p.stale ? '<span class="stale-flag">Stale</span>' : '';
  const method = p.method ? ` <span class="tiny muted" title="${escAttr(p.method)}">method ⓘ</span>` : '';
  const attr = p.attribution ? ` <span class="tiny muted">${esc(p.attribution)}</span>` : '';
  return (
    `<span class="dc-badge dc-${p.class.toLowerCase()}"><span class="dot"></span>${p.class}</span>` +
    `<span class="src">${esc(p.source)}</span>` +
    `<span>· ${esc(age(p.fetchedAt))}</span>` + stale + method + attr
  );
}

function age(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 'unknown age';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** KPI row built from real widget entries (provenance + delta from series). */
function kpiGrid(ids: string[], col: string): HTMLElement {
  const grid = el('div', { class: 'dash-grid' });
  for (const id of ids) {
    const e = entry(id);
    if (!e) continue;
    const series = e.payload.series ?? [];
    const delta = series.length >= 2 ? pctDelta(series) : null;
    const cell = el('div', { class: col });
    cell.appendChild(
      kpiCard({
        def: e.def,
        payload: e.payload,
        delta: delta !== null ? `${delta}%` : undefined,
        deltaDir: delta !== null && delta >= 0 ? 'up' : 'down',
        sub: 'vs previous period',
      }),
    );
    grid.appendChild(cell);
  }
  return grid;
}

/** A single KPI card from a widget id (for views that hand-pick KPIs). */
function kpiById(id: string, _sub: string): HTMLElement {
  const e = entry(id);
  if (!e) return unavailableState(`Widget ${id} not fetched.`);
  return kpiCard({ def: e.def, payload: e.payload });
}

/** A hand-built KPI tile with explicit value + provenance (for derived KPIs). */
function kpiTileCard(label: string, value: string, p: Provenance, col: string, tone?: string): HTMLElement {
  const card = el('div', { class: `glass kpi-card ${col}` });
  const toneStyle = tone ? ` style="color:${tone}"` : '';
  card.innerHTML =
    `<div class="kpi-label">${esc(label)}</div>` +
    `<div><span class="kpi-value"${toneStyle}>${esc(value)}</span></div>` +
    `<div class="prov-meta">${provHtml(p)}</div>`;
  return card;
}

/** Chart card with real provenance + CSV export, returning root + chart body. */
function chartCardCell(title: string, widgetId: string, csvName: string, csvRows: Row[]): { root: HTMLElement; body: HTMLElement } {
  const { root, body } = chartCard({
    title,
    provenance: prov(widgetId),
    exportCsv: () => exportTableCsv(csvName, csvRows),
  });
  return { root, body };
}

/** Wrap a card in a responsive grid cell. */
function placeCell(card: HTMLElement, col: string): HTMLElement {
  const cell = el('div', { class: col });
  cell.appendChild(card);
  return cell;
}

/** Await a chart helper, register its dispose handle, and never reject. */
async function mountChart(body: HTMLElement, p: Promise<ChartHandle>): Promise<void> {
  try {
    activeCharts.push(await p);
  } catch (err) {
    body.appendChild(unavailableState(err instanceof Error ? err.message : 'Chart failed'));
  }
}

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

/** Bucket the active-ports rows by operational class → [{Class, Count}]. */
function bucketClass(ports: Row[]): Row[] {
  const order = ['pass', 'warn', 'fail'];
  const counts = new Map<string, number>();
  for (const p of ports) {
    const c = String(p['Class'] ?? 'pass');
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return order
    .filter((c) => counts.has(c))
    .map((c) => ({ Class: c, Count: counts.get(c) ?? 0 }));
}

/** Sum the per-rule Pass/Warn/Fail columns → [{Class, Count}]. */
function sumRules(ruleRows: Row[]): Row[] {
  let pass = 0, warn = 0, fail = 0;
  for (const r of ruleRows) {
    pass += Number(r['Pass'] ?? 0);
    warn += Number(r['Warn'] ?? 0);
    fail += Number(r['Fail'] ?? 0);
  }
  return [
    { Class: 'Pass', Count: pass },
    { Class: 'Warn', Count: warn },
    { Class: 'Fail', Count: fail },
  ];
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s: string): string {
  return esc(s).replace(/"/g, '&quot;');
}
