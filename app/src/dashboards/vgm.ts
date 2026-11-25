// VGM & Container tools — a professional, tabbed logistics tool. Three tabs
// (Container | VGM | Route) behind a smart search bar that auto-detects
// container number / BIC owner / size-type. Reuses @boxlens/core (ISO 6346,
// size/type, VGM Method 2, chokepoint-aware sea route) — no business-rule
// changes, only UX/UI + layout. Reached at #/vgm; tab deep-links via #/vgm?tab=.
import { iso6346, sizetype, seaway, vgm } from '@boxlens/core';
import type { ValidationResult, ContainerSpec } from '@boxlens/core';
import { el } from './framework/components';
import { dashMap, type MapPoint } from './framework/map';
import { OWNERS, SIZE_TYPES, CONTAINERS, SAMPLE_CONTAINERS } from '../vgm/data';

interface SessionLookup {
  id: string;
  ok: boolean;
  when: number;
}

/** Major ports with coordinates for the sea-route estimator (curated, public). */
interface RoutePort {
  code: string;
  name: string;
  lat: number;
  lng: number;
}
const MAJOR_PORTS: readonly RoutePort[] = Object.freeze([
  { code: 'NLRTM', name: 'Rotterdam', lat: 51.95, lng: 4.07 },
  { code: 'DEHAM', name: 'Hamburg', lat: 53.54, lng: 9.93 },
  { code: 'BEANR', name: 'Antwerp-Bruges', lat: 51.32, lng: 4.31 },
  { code: 'GBFXT', name: 'Felixstowe', lat: 51.95, lng: 1.31 },
  { code: 'USNYC', name: 'New York / NJ', lat: 40.67, lng: -74.04 },
  { code: 'USLAX', name: 'Los Angeles', lat: 33.73, lng: -118.26 },
  { code: 'USSAV', name: 'Savannah', lat: 32.08, lng: -81.09 },
  { code: 'BRSSZ', name: 'Santos', lat: -23.97, lng: -46.3 },
  { code: 'CNSHA', name: 'Shanghai (Yangshan)', lat: 30.62, lng: 122.07 },
  { code: 'CNYTN', name: 'Yantian (Shenzhen)', lat: 22.59, lng: 114.31 },
  { code: 'SGSIN', name: 'Singapore (PSA)', lat: 1.27, lng: 103.84 },
  { code: 'HKHKG', name: 'Hong Kong', lat: 22.32, lng: 114.17 },
  { code: 'AEJEA', name: 'Jebel Ali', lat: 25.01, lng: 55.06 },
  { code: 'INMUN', name: 'Mumbai (JNPT)', lat: 18.95, lng: 72.95 },
  { code: 'ESALG', name: 'Algeciras', lat: 36.13, lng: -5.44 },
  { code: 'PANUM', name: 'Manzanillo (PA)', lat: 9.35, lng: -79.9 },
]);

const lookups: SessionLookup[] = [];
const manual: Record<string, ContainerSpec> = {};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s: string): string {
  return esc(s).replace(/"/g, '&quot;');
}

export type DetectMode = 'container' | 'owner' | 'sizetype';

/**
 * Auto-detect the tool mode from a pasted string. Pure — unit-tested.
 *   - 4 letters + 1–7 digits  → container number (CSQU3054383)
 *   - 2 digits + letter + alnum (4 chars) → ISO 6346 size/type (22G1, 45R1)
 *   - 3–4 letters             → BIC owner code (MSCU)
 */
export function detectMode(raw: string): DetectMode | null {
  const s = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!s) return null;
  if (/^[A-Z]{4}\d{1,7}$/.test(s) && s.length >= 5) return 'container';
  if (/^\d{2}[A-Z][A-Z0-9]$/.test(s)) return 'sizetype';
  if (/^[A-Z]{3,4}$/.test(s)) return 'owner';
  return null;
}

type TabId = 'container' | 'vgm' | 'route';
const TAB_LABELS: Record<TabId, string> = { container: 'Container', vgm: 'VGM', route: 'Route' };

/** Render the whole VGM tool into `root`. Sync (no network). */
export function renderVgm(root: HTMLElement): void {
  root.innerHTML = '';

  // ---- Header (user-facing; no developer language) ----
  const head = el('div', { class: 'glass vgm-head' });
  head.innerHTML =
    '<div class="vgm-head-row"><div><h1>VGM &amp; Container tools</h1>' +
    '<p class="muted">Validate a container number under ISO 6346, decode its BIC owner and size/type, ' +
    'look up technical specs, and compute the SOLAS Verified Gross Mass (Method 2). ' +
    'All tools run offline in your browser.</p></div>' +
    '<span class="dc-badge dc-live" id="vgmStatusChip"><span class="dot"></span>OFFLINE · client-side</span></div>';
  root.appendChild(head);

  // ---- Smart search bar ----
  const search = el('div', { class: 'glass vgm-search' });
  const portDatalist = MAJOR_PORTS.map((p) => `<option value="${esc(p.code)}">${esc(p.name)}</option>`).join('');
  search.innerHTML =
    '<label for="smartInput" class="visually-hidden">Smart search — container number, owner code or size/type</label>' +
    '<div class="vgm-search-row">' +
    '<input id="smartInput" class="vgm-input mono" placeholder="Paste a container number, owner code or size/type — e.g. CSQU3054383, MSCU, 22G1" ' +
    'autocomplete="off" autocapitalize="characters" spellcheck="false" />' +
    '<span class="vgm-mode-chip" id="smartModeChip" aria-live="polite">—</span>' +
    '<select id="smartOverride" class="vgm-input" aria-label="Override detected mode">' +
    '<option value="">Auto</option><option value="container">Container</option>' +
    '<option value="owner">Owner</option><option value="sizetype">Size/type</option></select>' +
    '<button class="btn btn-primary" id="smartGo" type="button">Go</button></div>' +
    '<div class="vgm-chips" id="smartExamples">' +
    '<span class="tiny muted">Try:</span> ' +
    SAMPLE_CONTAINERS.slice(0, 3).map((s) => `<button type="button" class="chip" data-s="${esc(s.split(' ')[0] ?? '')}">${esc(s)}</button>`).join(' ') +
    ' <button type="button" class="chip" data-s="MSCU">MSCU</button>' +
    ' <button type="button" class="chip" data-s="22G1">22G1</button>' +
    '</div>' +
    '<div class="vgm-chips" id="recentChips"><span class="tiny muted">Recent:</span> <span class="tiny muted" id="recentEmpty">none yet</span></div>' +
    '<datalist id="portList">' + portDatalist + '</datalist>';
  root.appendChild(search);

  // ---- Tabs ----
  const tabs = el('div', { class: 'vgm-tabs', role: 'tablist' });
  (['container', 'vgm', 'route'] as TabId[]).forEach((t) => {
    const b = el('button', {
      class: 'vgm-tab',
      role: 'tab',
      type: 'button',
      'aria-selected': 'false',
      'data-tab': t,
      id: `tab-${t}`,
    });
    b.textContent = TAB_LABELS[t];
    tabs.appendChild(b);
  });
  root.appendChild(tabs);

  // ---- Panels ----
  const panelWrap = el('div', { class: 'vgm-panels' });

  // Container panel: anatomy (left) + result (right)
  const pContainer = el('div', { class: 'vgm-panel', role: 'tabpanel', 'aria-labelledby': 'tab-container', id: 'panel-container' });
  pContainer.innerHTML =
    '<div class="vgm-layout">' +
    '<div class="vgm-col-input">' +
    '<div class="glass vgm-card">' +
    '<h3>Container number</h3>' +
    '<div class="vgm-anatomy" id="anatomy" aria-live="polite"></div>' +
    '<div class="tiny muted" id="anatomyHint">Type or paste a container number to see its anatomy (owner · category · serial · check digit).</div>' +
    '</div></div>' +
    '<div class="vgm-col-result">' +
    '<div class="glass vgm-card" id="cnResult"><div class="empty-vgm"><div class="ic">📦</div>' +
    '<div class="muted">Enter a container number, owner code or size/type to see the result.</div></div></div>' +
    '</div></div>';
  panelWrap.appendChild(pContainer);

  // VGM panel: guided calculator
  const pVgm = el('div', { class: 'vgm-panel', role: 'tabpanel', 'aria-labelledby': 'tab-vgm', id: 'panel-vgm', hidden: '' });
  pVgm.innerHTML =
    '<div class="glass vgm-card vgm-calc">' +
    '<div class="vgm-card-head"><h3>VGM — Method 2 (SOLAS)</h3>' +
    '<div class="vgm-unit-toggle" role="group" aria-label="Weight unit">' +
    '<button type="button" class="vgm-unit on" data-unit="kg" id="unitKg">kg</button>' +
    '<button type="button" class="vgm-unit" data-unit="lb" id="unitLb">lb</button></div></div>' +
    '<p class="muted tiny">VGM = tare + cargo + packing + dunnage. The shipper keeps the legal SOLAS VI/2 responsibility. ' +
    'This is a <b>DRAFT</b>, never a certification.</p>' +
    '<div class="vgm-calc-grid">' +
    '<div><label for="vgmTare">Tare (auto)</label><input id="vgmTare" class="vgm-input mono" disabled /></div>' +
    '<div><label for="vgmCargo">Cargo <span class="req">*</span></label><input id="vgmCargo" class="vgm-input" type="number" inputmode="numeric" placeholder="25000" /></div>' +
    '<div><label for="vgmPacking">Packing + dunnage</label><input id="vgmPacking" class="vgm-input" type="number" inputmode="numeric" placeholder="0" /></div>' +
    '<div><label for="vgmOut">Computed VGM</label><input id="vgmOut" class="vgm-input mono" disabled /></div>' +
    '</div>' +
    '<div id="vgmWarn" class="vgm-result" aria-live="polite"></div>' +
    '<div class="vgm-row"><button class="btn btn-primary" id="vgmCalc" type="button">Compute</button>' +
    '<button class="btn" id="vgmClear" type="button">Clear</button></div>' +
    '<div class="vgm-draft" id="vgmDraft" hidden><div class="vgm-draft-watermark">DRAFT</div>' +
    '<div class="vgm-draft-body" id="vgmDraftBody"></div></div></div>';
  panelWrap.appendChild(pVgm);

  // Route panel: map-first + controls
  const pRoute = el('div', { class: 'vgm-panel', role: 'tabpanel', 'aria-labelledby': 'tab-route', id: 'panel-route', hidden: '' });
  pRoute.innerHTML =
    '<div class="vgm-layout vgm-route-layout">' +
    '<div class="vgm-col-input">' +
    '<div class="glass vgm-card">' +
    '<h3>Sea route &amp; rough ETA</h3>' +
    '<p class="muted tiny">Chokepoint-aware great-circle estimate: the direct arc is tested against a coarse landmass mask ' +
    'and rerouted via Suez / Panama / Cape of Good Hope / Cape Horn when it would cross a continent. ' +
    'Estimate — verify against the carrier schedule.</p>' +
    '<div class="vgm-calc-grid">' +
    '<div><label for="srFrom">From port</label><input id="srFrom" class="vgm-input mono" list="portList" value="NLRTM" autocomplete="off" /></div>' +
    '<div><label for="srTo">To port</label><input id="srTo" class="vgm-input mono" list="portList" value="CNSHA" autocomplete="off" /></div>' +
    '</div>' +
    '<div class="vgm-row"><button class="btn btn-icon" id="srSwap" type="button" title="Swap From / To" aria-label="Swap From and To">⇄</button>' +
    '<button class="btn btn-primary" id="srCalc" type="button">Compute route</button></div>' +
    '<div class="vgm-speed">' +
    '<label for="srSpeed">Speed: <b id="srSpeedVal">18</b> kn</label>' +
    '<input id="srSpeed" type="range" min="10" max="30" step="1" value="18" />' +
    '<div class="vgm-presets">' +
    '<button type="button" class="chip" data-sp="14">14</button>' +
    '<button type="button" class="chip" data-sp="18">18</button>' +
    '<button type="button" class="chip" data-sp="22">22</button></div></div>' +
    '<div id="srResult" class="vgm-result" aria-live="polite"></div>' +
    '</div></div>' +
    '<div class="vgm-col-result"><div class="glass vgm-card vgm-map-card">' +
    '<h3>Route map</h3><div id="srMap" class="vgm-map"></div></div></div>' +
    '</div>';
  panelWrap.appendChild(pRoute);
  root.appendChild(panelWrap);

  // ---- Methodology (collapsible) ----
  const meth = el('details', { class: 'glass vgm-meth' });
  meth.innerHTML =
    '<summary>Methodology — ISO 6346 &amp; VGM Method 2</summary>' +
    '<div class="vgm-meth-body">' +
    '<p><b>ISO 6346 check digit.</b> The container number is 4 owner letters + 6 serial digits + 1 check digit. ' +
    'Each character is assigned a value (digits 0–9 their face value; letters sequential but skipping multiples ' +
    'of 11, so A=10, B=12, …, Z=38). The sum of <code>value × 2<sup>position</sup></code> over the first 10 ' +
    'characters is taken mod 11; a remainder of 10 is recorded as 0. CSQU3054383 anchors the Wikipedia worked ' +
    'example (check digit 3).</p>' +
    '<p><b>VGM Method 2 (SOLAS regulation VI/2).</b> VGM = tare + (cargo + packing + dunnage). The result is ' +
    "checked against the container's max gross mass (VGM) and max payload (cargo); exceeding either raises a " +
    'rejection warning. A SOLAS declaration may not be filed for a container whose VGM exceeds its max gross.</p>' +
    '<p class="muted tiny">Golden tests run on module load: ' +
    (iso6346.runGoldenTests().length === 0 ? 'all pass ✓' : 'FAILURES: ' + esc(iso6346.runGoldenTests().join('; '))) +
    '.</p></div>';
  root.appendChild(meth);

  // ---- scoped query helper ----
  const $ = <T extends HTMLElement>(sel: string): T | null => root.querySelector<T>(sel);

  // ---- tab switching (deep-link via replaceState — does not fire hashchange) ----
  let mapHandle: { dispose(): void } | null = null;
  function setTab(tab: TabId): void {
    for (const t of ['container', 'vgm', 'route'] as TabId[]) {
      const btn = $<HTMLButtonElement>(`#tab-${t}`);
      const panel = $<HTMLElement>(`#panel-${t}`);
      if (!btn || !panel) continue;
      const on = t === tab;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', String(on));
      panel.hidden = !on;
    }
    if (typeof history !== 'undefined' && history.replaceState) {
      history.replaceState(null, '', `#/vgm?tab=${tab}`);
    }
    if (tab === 'route') {
      // Render the map only when the route panel is visible (Leaflet needs layout).
      setTimeout(() => doSeaRoute(srFromEl.value, srToEl.value, srSpeedEl.value), 60);
    } else if (mapHandle) {
      mapHandle.dispose();
      mapHandle = null;
    }
  }
  for (const btn of root.querySelectorAll<HTMLButtonElement>('.vgm-tab')) {
    btn.addEventListener('click', () => setTab(btn.dataset.tab as TabId));
  }
  // initial tab from URL
  let initialTab: TabId = 'container';
  try {
    const m = (location.hash.match(/[?&]tab=([^&]+)/) ?? [])[1];
    if (m === 'vgm' || m === 'route' || m === 'container') initialTab = m;
  } catch { /* location unavailable (jsdom/test) */ }

  // ---- element refs ----
  const smartInput = $<HTMLInputElement>('#smartInput')!;
  const smartModeChip = $<HTMLElement>('#smartModeChip')!;
  const smartOverride = $<HTMLSelectElement>('#smartOverride')!;
  const anatomyEl = $<HTMLElement>('#anatomy')!;

  const srFromEl = $<HTMLInputElement>('#srFrom')!;
  const srToEl = $<HTMLInputElement>('#srTo')!;
  const srSpeedEl = $<HTMLInputElement>('#srSpeed')!;
  const srSpeedVal = $<HTMLElement>('#srSpeedVal')!;

  // ---- smart search: live mode detection + anatomy ----
  function currentMode(raw: string): DetectMode | null {
    const ov = smartOverride.value;
    if (ov === 'container' || ov === 'owner' || ov === 'sizetype') return ov;
    return detectMode(raw);
  }
  function refreshMode(): void {
    const mode = currentMode(smartInput.value);
    smartModeChip.textContent = mode ? mode.toUpperCase() : '—';
    smartModeChip.setAttribute('data-mode', mode ?? '');
    if (mode === 'container' || (mode === null && /^[A-Z0-9]*$/.test(smartInput.value.toUpperCase()))) {
      renderAnatomy(smartInput.value);
    } else {
      anatomyEl.innerHTML = '';
    }
  }
  smartInput.addEventListener('input', refreshMode);
  smartOverride.addEventListener('change', refreshMode);

  function smartGo(): void {
    const raw = smartInput.value;
    const mode = currentMode(raw);
    if (!mode) {
      setCnResult('<div class="vgm-alert vgm-warn">Enter a container number, owner code (3–4 letters) or size/type (e.g. 22G1).</div>');
      setTab('container');
      return;
    }
    setTab('container');
    if (mode === 'container') doValidate(raw);
    else if (mode === 'owner') doOwnerLookup(raw);
    else doDecodeSizeType(raw);
  }
  smartInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); smartGo(); }
    if (e.key === 'Escape') { smartInput.value = ''; refreshMode(); }
  });
  $<HTMLButtonElement>('#smartGo')!.addEventListener('click', smartGo);

  for (const c of root.querySelectorAll<HTMLButtonElement>('#smartExamples .chip')) {
    c.addEventListener('click', () => { smartInput.value = c.dataset.s ?? ''; refreshMode(); smartGo(); });
  }

  // ---- "/" focuses the search bar ----
  document.addEventListener('keydown', slashHandler);

  // ---- VGM unit toggle + live sum ----
  let vgmUnit: 'kg' | 'lb' = 'kg';
  function setUnit(u: 'kg' | 'lb'): void {
    vgmUnit = u;
    $<HTMLButtonElement>('#unitKg')!.classList.toggle('on', u === 'kg');
    $<HTMLButtonElement>('#unitLb')!.classList.toggle('on', u === 'lb');
    liveVgmSum();
  }
  $<HTMLButtonElement>('#unitKg')!.addEventListener('click', () => setUnit('kg'));
  $<HTMLButtonElement>('#unitLb')!.addEventListener('click', () => setUnit('lb'));
  $<HTMLInputElement>('#vgmCargo')!.addEventListener('input', liveVgmSum);
  $<HTMLInputElement>('#vgmPacking')!.addEventListener('input', liveVgmSum);

  $<HTMLButtonElement>('#vgmCalc')!.addEventListener('click', computeVgm);
  $<HTMLButtonElement>('#vgmClear')!.addEventListener('click', () => {
    $<HTMLInputElement>('#vgmCargo')!.value = '';
    $<HTMLInputElement>('#vgmPacking')!.value = '';
    $<HTMLInputElement>('#vgmOut')!.value = '';
    $<HTMLElement>('#vgmWarn')!.innerHTML = '';
    $<HTMLElement>('#vgmDraft')!.setAttribute('hidden', '');
    liveVgmSum();
  });

  // ---- Route: swap, presets, compute ----
  $<HTMLButtonElement>('#srSwap')!.addEventListener('click', () => {
    const a = srFromEl.value; srFromEl.value = srToEl.value; srToEl.value = a;
    doSeaRoute(srFromEl.value, srToEl.value, srSpeedEl.value);
  });
  srSpeedEl.addEventListener('input', () => { srSpeedVal.textContent = srSpeedEl.value; });
  $<HTMLButtonElement>('#srCalc')!.addEventListener('click', () => doSeaRoute(srFromEl.value, srToEl.value, srSpeedEl.value));
  for (const p of root.querySelectorAll<HTMLButtonElement>('.vgm-presets .chip')) {
    p.addEventListener('click', () => { srSpeedEl.value = p.dataset.sp ?? '18'; srSpeedVal.textContent = srSpeedEl.value; doSeaRoute(srFromEl.value, srToEl.value, srSpeedEl.value); });
  }

  // ---- initial render ----
  refreshMode();
  drawRecent(root);
  setTab(initialTab);

  // ---- core logic (scoped to `root`) ----
  function slashHandler(e: KeyboardEvent): void {
    if (!root.isConnected) return; // stale handler from a prior render — no-op
    if (e.key === '/' && document.activeElement !== smartInput && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement?.tagName ?? ''))) {
      e.preventDefault();
      smartInput.focus();
    }
  }

  function renderAnatomy(raw: string): void {
    const s = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const hint = $<HTMLElement>('#anatomyHint');
    if (s.length < 5 || !/^[A-Z]{4}\d{1,7}$/.test(s)) {
      anatomyEl.innerHTML = s ? `<span class="vgm-seg vgm-seg-dim">${esc(s)}</span>` : '';
      if (hint) hint.textContent = 'Type or paste a container number (4 letters + 6 digits + check digit).';
      return;
    }
    const owner = s.slice(0, 3);
    const cat = s.slice(3, 4);
    const serial = s.slice(4, 10);
    const check = s.slice(10, 11);
    const seg = (val: string, label: string, cls: string) =>
      `<div class="vgm-seg ${cls}"><span class="vgm-seg-val mono">${esc(val || '·')}</span><span class="vgm-seg-lbl">${label}</span></div>`;
    anatomyEl.innerHTML =
      seg(owner, 'Owner', 'vgm-seg-owner') +
      seg(cat, 'Cat.', 'vgm-seg-cat') +
      seg(serial, 'Serial', 'vgm-seg-serial') +
      (check ? seg(check, 'Check', 'vgm-seg-check') : '');
    if (hint) hint.textContent = 'Owner · category · serial · check digit.';
  }

  function setCnResult(html: string): void {
    $<HTMLElement>('#cnResult')!.innerHTML = html;
  }

  function doValidate(raw: string): void {
    const r = iso6346.validate(raw);
    renderAnatomy(raw);
    const box = $<HTMLElement>('#cnResult')!;
    if (r.valid) {
      box.innerHTML = statusBadge('valid', 'Valid ISO 6346', `Check digit ${r.checkDigit} correct.`) +
        '<div id="specInner"></div>';
      renderSpec(r);
    } else {
      const corr = iso6346.suggestCorrected(raw);
      const fixBtn = corr ? `<button type="button" class="btn btn-primary sm" id="cnFix" data-fix="${escAttr(corr)}">Use ${esc(corr)}</button>` : '';
      box.innerHTML = statusBadge('invalid', 'Invalid', esc(r.errors.join('; '))) +
        (corr ? `<div class="vgm-alert vgm-warn">Expected check digit: <code class="mono">${esc(corr.slice(-1))}</code>. ${fixBtn}</div>` : '') +
        '<div id="specInner"></div>';
      const fix = $<HTMLButtonElement>('#cnFix');
      if (fix) fix.addEventListener('click', () => {
        smartInput.value = fix.dataset.fix ?? '';
        refreshMode();
        doValidate(fix.dataset.fix ?? '');
      });
      renderSpec(r);
    }
    if (r.normalized) {
      lookups.unshift({ id: r.normalized, ok: r.valid, when: Date.now() });
      if (lookups.length > 8) lookups.pop();
      drawRecent(root);
    }
  }

  function renderSpec(r: ValidationResult): void {
    const inner = $<HTMLElement>('#specInner');
    if (!inner) return;
    if (!r || !r.valid) {
      inner.innerHTML = '<div class="vgm-alert vgm-warn">Fix the container number before lookup.</div>';
      return;
    }
    const id = r.normalized!;
    let spec: ContainerSpec | undefined = CONTAINERS[id] ?? manual[id];
    let sourceLabel = 'BIC BoxTech';
    let quality = 'ok';
    let isManual = false;
    if (manual[id]) { spec = manual[id]; sourceLabel = 'Manual (unverified)'; quality = 'partial'; isManual = true; }
    if (!spec) {
      inner.innerHTML =
        '<div class="vgm-alert vgm-warn">No sample record for ' + esc(id) + '. Enter an unverified record to ' +
        'continue (the BIC BoxTech API supplies this in production).</div>' +
        '<details class="vgm-manual"><summary class="btn sm">Manual entry (unverified)</summary>' +
        '<div class="vgm-calc-grid" style="margin-top:10px">' +
        '<div><label>Size/type</label><input id="mST" class="vgm-input mono" placeholder="42G1" /></div>' +
        '<div><label>Tare (kg)</label><input id="mTare" class="vgm-input" type="number" placeholder="3700" /></div>' +
        '<div><label>Max gross (kg)</label><input id="mMG" class="vgm-input" type="number" placeholder="30480" /></div>' +
        '<div><label>Max payload (kg)</label><input id="mMP" class="vgm-input" type="number" placeholder="26780" /></div>' +
        '</div><div class="vgm-row" style="margin-top:10px"><button class="btn btn-primary sm" id="saveManual" type="button">Save unverified record</button>' +
        '<button class="btn sm" id="fillNominal" type="button" title="Fill from the ISO 668 nominal record">Use nominal ISO 668</button></div></details>';
      $<HTMLButtonElement>('#saveManual')!.addEventListener('click', () => {
        const rec: ContainerSpec = {
          sizeType: $<HTMLInputElement>('#mST')!.value.trim() || null,
          tare: +$<HTMLInputElement>('#mTare')!.value || 0,
          maxGross: +$<HTMLInputElement>('#mMG')!.value || 0,
          maxPayload: +$<HTMLInputElement>('#mMP')!.value || 0,
          maxStacking: null, manufacturer: null, csc: null, special: null,
          source: 'Manual', fetchedAt: new Date().toISOString().slice(0, 10), quality: 'partial',
        };
        manual[id] = rec; renderSpec(r);
      });
      $<HTMLButtonElement>('#fillNominal')!.addEventListener('click', () => {
        const code = $<HTMLInputElement>('#mST')!.value.trim();
        const s = sizetype.specForSizeType(code);
        if (!s) return;
        $<HTMLInputElement>('#mTare')!.value = String(s.tare);
        $<HTMLInputElement>('#mMG')!.value = String(s.maxGross);
        $<HTMLInputElement>('#mMP')!.value = String(s.maxPayload);
      });
      return;
    }
    const owner = OWNERS[id.slice(0, 4)];
    const stDesc = (spec.sizeType && SIZE_TYPES[spec.sizeType]) || 'Unknown code';
    const qBadge = quality === 'ok' ? badge('live', 'OK') : badge('sample', quality === 'stale' ? 'Stale' : 'Partial');
    const cscBadge = spec.csc && spec.csc.approved ? badge('live', 'CSC current') : badge('sample', 'CSC issue');
    inner.innerHTML =
      '<div class="spread"><h3 class="mono">' + esc(id) + '</h3>' + qBadge + '</div>' +
      '<div class="vgm-tag-row"><span class="tiny muted">' + esc(sourceLabel) + '</span>' +
      (isManual ? badge('sample', 'Unverified') : '') + cscBadge + '</div><hr>' +
      silhouetteAndBars(spec, stDesc) +
      '<div class="vgm-kv-grid">' +
      kv('Owner', owner ? esc(owner.name) : '—') +
      kv('Owner country', owner ? esc(owner.country) : '—') +
      kv('Size/type', esc(spec.sizeType ?? '—') + ' <span class="muted tiny">(' + esc(stDesc) + ')</span>') +
      kv('Tare', fmt(spec.tare, 'kg')) +
      kv('Max gross', fmt(spec.maxGross, 'kg')) +
      kv('Max payload', fmt(spec.maxPayload, 'kg')) +
      kv('Max stacking', spec.maxStacking ? fmt(spec.maxStacking, 'kg') : '—') +
      kv('Manufacturer', esc(spec.manufacturer ?? '—')) +
      kv('CSC next', spec.csc ? esc(spec.csc.nextInspection ?? '—') : '—') +
      '</div>' +
      (spec.special ? '<hr><div class="vgm-special"><div class="tiny muted">Special equipment</div><div class="mono small">' + esc(JSON.stringify(spec.special)) + '</div></div>' : '') +
      (quality === 'stale' ? '<div class="vgm-alert vgm-warn">Data is stale (last fetched ' + esc(spec.fetchedAt ?? '—') + ').</div>' : '') +
      '<div class="vgm-row" style="margin-top:10px"><button class="btn sm" id="cnCopy" type="button">Copy</button>' +
      '<button class="btn sm" id="cnJson" type="button">Export JSON</button>' +
      '<button class="btn btn-primary sm" id="cnToVgm" type="button">Open in VGM →</button></div>';
    // pre-fill VGM tab
    $<HTMLInputElement>('#vgmTare')!.value = `${spec.tare} kg`;
    $<HTMLInputElement>('#vgmCargo')!.value = '';
    $<HTMLInputElement>('#vgmPacking')!.value = '';
    $<HTMLInputElement>('#vgmOut')!.value = '';
    $<HTMLElement>('#vgmWarn')!.innerHTML = '';
    $<HTMLElement>('#vgmDraft')!.setAttribute('hidden', '');
    $<HTMLButtonElement>('#cnCopy')!.addEventListener('click', () => copyText(`${id}\t${spec!.sizeType ?? ''}\ttare ${spec!.tare} kg\tmax gross ${spec!.maxGross} kg`));
    $<HTMLButtonElement>('#cnJson')!.addEventListener('click', () => downloadJson(`${id}.json`, { id, owner: owner?.name ?? null, ...spec }));
    $<HTMLButtonElement>('#cnToVgm')!.addEventListener('click', () => { setTab('vgm'); $<HTMLInputElement>('#vgmCargo')!.focus(); });
  }

  function liveVgmSum(): void {
    const tare = tareKg();
    const cargo = numVal('#vgmCargo');
    const packing = numVal('#vgmPacking');
    const sum = tare + cargo + packing;
    const out = $<HTMLInputElement>('#vgmOut')!;
    out.value = sum > 0 ? fmtWeight(sum) : '';
  }

  function computeVgm(): void {
    const specId = (currentLoadedSpecId());
    const spec: ContainerSpec | undefined = specId ? (CONTAINERS[specId] ?? manual[specId]) : undefined;
    if (!spec) {
      $<HTMLElement>('#vgmWarn')!.innerHTML = '<div class="vgm-alert vgm-warn">Look up a container first (Container tab → Go).</div>';
      return;
    }
    const cargoKg = vgmUnit === 'lb' ? numVal('#vgmCargo') / 2.20462 : numVal('#vgmCargo');
    const packingKg = vgmUnit === 'lb' ? numVal('#vgmPacking') / 2.20462 : numVal('#vgmPacking');
    const r = vgm.evaluate(spec.tare, cargoKg + packingKg, spec.maxGross, spec.maxPayload);
    $<HTMLInputElement>('#vgmOut')!.value = fmtWeight(spec.tare + cargoKg + packingKg);
    $<HTMLElement>('#vgmWarn')!.innerHTML = r.within
      ? '<div class="vgm-alert vgm-ok">✓ Within limits. VGM ' + Math.round(spec.tare + cargoKg + packingKg) + ' kg ≤ max gross ' + spec.maxGross + ' kg.</div>'
      : '<div class="vgm-alert vgm-bad">⚠ ' + esc(r.warnings.join(' ')) + '</div>';
    // DRAFT preview
    const draft = $<HTMLElement>('#vgmDraft')!;
    const body = $<HTMLElement>('#vgmDraftBody')!;
    draft.removeAttribute('hidden');
    body.innerHTML =
      '<div class="vgm-draft-line"><b>DRAFT — VGM Method 2 (SOLAS VI/2)</b></div>' +
      '<div class="vgm-draft-line">Container: <span class="mono">' + esc(specId ?? '') + '</span> · ' + esc(spec.sizeType ?? '') + '</div>' +
      '<div class="vgm-draft-line">Tare: ' + spec.tare + ' kg · Cargo+dunnage: ' + Math.round(cargoKg + packingKg) + ' kg</div>' +
      '<div class="vgm-draft-line"><b>VGM = ' + Math.round(spec.tare + cargoKg + packingKg) + ' kg</b> · Max gross ' + spec.maxGross + ' kg · ' +
      (r.within ? 'within limits' : 'OVER LIMIT') + '</div>' +
      '<div class="vgm-draft-line tiny muted">Not a certification. The shipper keeps the legal SOLAS responsibility.</div>';
  }

  function doOwnerLookup(code: string): void {
    const c = String(code ?? '').toUpperCase().replace(/[^A-Z]/g, '');
    let o = OWNERS[c];
    let matched = c;
    if (!o && c.length === 3) {
      const key = Object.keys(OWNERS).find((k) => k.startsWith(c));
      if (key) { o = OWNERS[key]; matched = key; }
    }
    const box = $<HTMLElement>('#cnResult')!;
    anatomyEl.innerHTML = '';
    if (!o) {
      box.innerHTML = statusBadge('invalid', 'Owner not found', `${esc(c)} is not in the sample set.`) +
        '<div class="vgm-alert vgm-warn">Owner code not in the sample set. The BIC Codes API supplies this in production.</div>';
      return;
    }
    box.innerHTML = statusBadge('valid', 'Owner found', `${esc(o.name)} — ${esc(o.country)}`) +
      `<div class="vgm-tag-row">${badge('live', 'BIC Codes')}</div>` +
      '<div class="vgm-kv-grid">' +
      kv('Code', esc(matched)) +
      kv('Owner', esc(o.name)) +
      kv('City', esc(o.city)) +
      kv('Country', esc(o.country)) +
      kv('Contact', esc(o.contact)) +
      '</div>';
  }

  function doDecodeSizeType(raw: string): void {
    const r = sizetype.decodeSizeType(raw);
    const box = $<HTMLElement>('#cnResult')!;
    anatomyEl.innerHTML = '';
    if (!r.normalized) {
      box.innerHTML = statusBadge('invalid', 'Invalid code', 'Enter a 4-character size/type code (e.g. 22G1).');
      return;
    }
    const spec = sizetype.specForSizeType(raw);
    box.innerHTML = statusBadge(r.valid ? 'valid' : 'invalid', r.valid ? 'Decoded' : 'Partial decode', esc(r.normalized)) +
      `<div class="vgm-tag-row">${r.valid ? badge('live', 'ISO 6346') : badge('sample', 'partial')}${spec ? badge('daily', 'ISO 668 nominal') : ''}</div>` +
      '<div class="vgm-kv-grid">' +
      kv('Length', esc(r.lengthLabel)) +
      kv('Height', esc(r.heightLabel)) +
      kv('Type group', esc(r.typeGroup)) +
      kv('Specific', esc(r.typeLabel)) +
      kv('Category', esc(r.category)) +
      (spec ? kv('Tare', fmt(spec.tare, 'kg')) + kv('Max gross', fmt(spec.maxGross, 'kg')) + kv('Max payload', fmt(spec.maxPayload, 'kg')) : '') +
      '</div>' +
      (r.errors.length ? `<div class="vgm-alert vgm-warn">${esc(r.errors.join('; '))}</div>` : '') +
      `<div class="tiny muted" style="margin-top:8px">Source: ${esc(spec?.source ?? 'ISO 6346 Annex A/C (offline)')}. Nominal ISO 668 — verify against the CSC plate.</div>`;
  }

  function doSeaRoute(fromCode: string, toCode: string, speedRaw: string): void {
    const box = $<HTMLElement>('#srResult')!;
    const mapEl = $<HTMLElement>('#srMap')!;
    const from = MAJOR_PORTS.find((p) => p.code === fromCode.toUpperCase());
    const to = MAJOR_PORTS.find((p) => p.code === toCode.toUpperCase());
    if (!from || !to) { box.innerHTML = '<div class="vgm-alert vgm-warn">Select both ports (from the list).</div>'; return; }
    if (from.code === to.code) { box.innerHTML = '<div class="vgm-alert vgm-warn">Origin and destination are the same port.</div>'; return; }
    const speed = Math.max(1, Math.min(40, Number(speedRaw) || 18));
    const r = seaway.seaRoute({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }, { speedKn: speed });
    const legs = r.path.map((w) => w.label ?? `${w.lat.toFixed(1)}°, ${w.lng.toFixed(1)}°`).join(' → ');
    box.innerHTML =
      '<div class="spread"><div class="mono"><b>' + esc(from.name) + ' → ' + esc(to.name) + '</b></div>' +
      badge('estimate', 'ESTIMATE') + '</div>' +
      '<div class="vgm-kv-grid">' +
      kv('Distance', fmt(r.distanceKm, 'km') + ' · ' + fmt(r.distanceNm, 'NM')) +
      kv('Rough ETA', r.etaDays + ' d (' + r.etaHours + ' h)') +
      kv('Assumed speed', r.speedKn + ' kn') +
      kv('Detour factor', String(r.detourFactor)) +
      kv('Route via', r.chokepoints.length ? esc(r.chokepoints.join(' + ')) : 'direct open-ocean arc') +
      kv('Path', esc(legs)) +
      '</div>' +
      '<div class="tiny muted" style="margin-top:8px">' + esc(r.method) + '</div>';
    // map: from/to + chokepoint markers + dashed path
    const points: MapPoint[] = [
      { lat: from.lat, lng: from.lng, title: `From: ${from.name}`, color: 'teal' },
      { lat: to.lat, lng: to.lng, title: `To: ${to.name}`, color: 'blue' },
    ];
    for (const w of r.path) {
      if (w.label) points.push({ lat: w.lat, lng: w.lng, title: w.label, color: 'amber', radius: 6 });
    }
    if (mapHandle) { mapHandle.dispose(); mapHandle = null; }
    mapEl.innerHTML = '';
    dashMap(mapEl, points, { path: { coords: r.path.map((w) => [w.lat, w.lng]), color: 'teal' } })
      .then((h) => { mapHandle = h; })
      .catch(() => { mapEl.innerHTML = '<div class="vgm-alert vgm-warn">Map unavailable.</div>'; });
  }

  function drawRecent(root2: HTMLElement): void {
    const body = root2.querySelector<HTMLElement>('#recentChips');
    if (!body) return;
    if (!lookups.length) {
      body.innerHTML = '<span class="tiny muted">Recent:</span> <span class="tiny muted">none yet</span>';
      return;
    }
    const chips = lookups.map((a) =>
      `<button type="button" class="chip ${a.ok ? 'chip-ok' : 'chip-bad'}" data-rec="${escAttr(a.id)}">${esc(a.id)}</button>`,
    ).join(' ');
    body.innerHTML = '<span class="tiny muted">Recent:</span> ' + chips +
      ' <button type="button" class="chip chip-clear" id="recClear" title="Clear recent">✕</button>';
    for (const c of body.querySelectorAll<HTMLButtonElement>('button[data-rec]')) {
      c.addEventListener('click', () => { smartInput.value = c.dataset.rec ?? ''; refreshMode(); smartGo(); });
    }
    body.querySelector<HTMLButtonElement>('#recClear')?.addEventListener('click', () => { lookups.length = 0; drawRecent(root2); });
  }
}

// ---- shared pure helpers (module scope, reused above) ----
function statusBadge(kind: 'valid' | 'invalid' | 'stale', title: string, detail: string): string {
  const ic = kind === 'valid' ? '✓' : kind === 'invalid' ? '✗' : '⏱';
  const cls = kind === 'valid' ? 'vgm-ok' : kind === 'invalid' ? 'vgm-bad' : 'vgm-warn';
  return `<div class="vgm-status ${cls}"><span class="vgm-status-ic">${ic}</span><div><div class="vgm-status-title">${title}</div>` +
    `<div class="vgm-status-detail">${detail}</div></div></div>`;
}
function badge(cls: string, label: string): string {
  return `<span class="dc-badge dc-${cls}"><span class="dot"></span>${esc(label)}</span>`;
}

/** SVG container silhouette + tare/payload/max-gross bars, scaled to the spec. */
function silhouetteAndBars(spec: ContainerSpec, stDesc: string): string {
  const st = spec.sizeType ? sizetype.decodeSizeType(spec.sizeType) : null;
  const lenFt = parseFt(st?.lengthLabel ?? '') ?? (stDesc.includes('45') ? 45 : 40);
  const hgtFt = parseFt(st?.heightLabel ?? '') ?? 8.5;
  const w = Math.round(40 + (lenFt / 45) * 120); // 20ft→93, 40ft→147, 45ft→160
  const h = Math.round(20 + (hgtFt / 9.5) * 30); // 8'6"→47, 9'6"→50
  const maxG = spec.maxGross || 30480;
  const tare = spec.tare || 0;
  const payload = spec.maxPayload || 0;
  const tarePct = Math.min(100, (tare / maxG) * 100);
  const payloadPct = Math.min(100, (payload / maxG) * 100);
  return '<div class="vgm-silhouette-wrap">' +
    `<svg class="vgm-silhouette" viewBox="0 0 ${w + 24} ${h + 28}" role="img" aria-label="Container silhouette, ${lenFt} ft × ${hgtFt} ft">` +
    `<rect x="12" y="8" width="${w}" height="${h}" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>` +
    `<text x="${12 + w / 2}" y="${h + 22}" text-anchor="middle" font-size="11" fill="currentColor">${lenFt} ft × ${hgtFt} ft</text>` +
    `</svg>` +
    '<div class="vgm-bars">' +
    bar('Tare', tare, tarePct, 'var(--dash-teal)') +
    bar('Max payload', payload, payloadPct, 'var(--dash-blue)') +
    bar('Max gross', maxG, 100, 'var(--dash-muted)') +
    '</div></div>';
}
function bar(label: string, val: number, pct: number, color: string): string {
  return `<div class="vgm-bar"><div class="vgm-bar-head"><span>${esc(label)}</span><span class="mono">${val.toLocaleString('en-US')} kg</span></div>` +
    `<div class="vgm-bar-track"><div class="vgm-bar-fill" style="width:${Math.max(2, pct)}%;background:${color}"></div></div></div>`;
}
function parseFt(label: string): number | null {
  const m = label.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const v = parseFloat(m[1]!);
  const inMatch = label.match(/(\d)\s*in/);
  if (inMatch) return v + parseInt(inMatch[1]!, 10) / 12; // "8 ft 6 in" → feet + inches/12
  return v;
}

function tareKg(): number {
  const raw = (document.querySelector<HTMLInputElement>('#vgmTare')?.value ?? '').match(/[\d.]+/);
  return raw ? parseFloat(raw[0]!) : 0;
}
function currentLoadedSpecId(): string | undefined {
  // The Container result card heading holds the currently-loaded container id.
  const h = document.querySelector<HTMLElement>('#cnResult h3');
  return h?.textContent?.trim() || undefined;
}
function numVal(sel: string): number {
  const v = parseFloat(document.querySelector<HTMLInputElement>(sel)?.value ?? '');
  return Number.isFinite(v) ? v : 0;
}
function fmtWeight(kg: number): string {
  return vgmUnitCurrent() === 'lb' ? `${Math.round(kg * 2.20462).toLocaleString('en-US')} lb` : `${Math.round(kg).toLocaleString('en-US')} kg`;
}
// fmtWeight needs the current unit; read the toggle state from the DOM (the
// "on" button) so it stays correct without threading state around.
function vgmUnitCurrent(): 'kg' | 'lb' {
  const lb = document.querySelector<HTMLButtonElement>('#unitLb');
  return lb && lb.classList.contains('on') ? 'lb' : 'kg';
}

function copyText(s: string): void {
  try { void navigator.clipboard?.writeText(s); } catch { /* clipboard unavailable */ }
}
function downloadJson(name: string, obj: unknown): void {
  try {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch { /* download unavailable */ }
}

function kv(k: string, v: string): string {
  return '<div class="vgm-kv"><div class="tiny muted">' + k + '</div><div class="mono"><b>' + v + '</b></div></div>';
}
function fmt(n: number | null | undefined, unit: string): string {
  return n == null ? '—' : `${n.toLocaleString('en-US')} <span class="muted tiny">${unit}</span>`;
}
