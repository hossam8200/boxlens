// Native VGM & container tool — the classic app's "Check" view rebuilt inside
// the modern shell. NO iframe: imports the real @boxlens/core (ISO 6346 + VGM
// Method 2) and the ported BIC owner / size-type / container reference data.
// Reached at #/vgm from the topbar nav — one application, one URL.
import { iso6346, vgm } from '@boxlens/core';
import type { ValidationResult, ContainerSpec } from '@boxlens/core';
import { el } from './framework/components';
import { OWNERS, SIZE_TYPES, CONTAINERS, SAMPLE_CONTAINERS } from '../vgm/data';

interface SessionLookup {
  id: string;
  ok: boolean;
  when: number;
}

const lookups: SessionLookup[] = [];
const manual: Record<string, ContainerSpec> = {};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Render the whole VGM tool into `root`. Sync (no network). */
export function renderVgm(root: HTMLElement): void {
  root.innerHTML = '';

  const head = el('div', { class: 'glass feat-hero' });
  head.innerHTML =
    '<div class="feat-hero-eyebrow">@boxlens/core · ISO 6346 + VGM Method 2</div>' +
    '<h1>VGM &amp; Container tools</h1>' +
    '<p class="muted">Validate any container number under ISO 6346, decode its BIC owner and size/type, ' +
    'look up technical specs, and compute the SOLAS Verified Gross Mass (Method 2). ' +
    'The classic VGM tool, rebuilt natively — no iframe, one application.</p>';
  root.appendChild(head);

  const grid = el('div', { class: 'vgm-grid' });
  const left = el('div', { class: 'vgm-col' });
  const right = el('div', { class: 'vgm-col' });

  // ---- Validate card ----
  const validateCard = el('div', { class: 'glass' });
  validateCard.innerHTML =
    '<h3>Container number</h3>' +
    '<div class="vgm-row"><input id="cnInput" class="mono" placeholder="e.g. CSQU3054383" maxlength="11" ' +
    'autocomplete="off" autocapitalize="characters" /><button class="btn primary" id="cnValidate">Validate</button></div>' +
    '<div id="cnResult" class="vgm-result"></div>' +
    '<div class="tiny muted">Try: ' +
    SAMPLE_CONTAINERS.map((s) => `<a href="#" class="vgm-sample" data-s="${esc(s.split(' ')[0] ?? '')}">${esc(s)}</a>`).join(', ') +
    '</div>';
  left.appendChild(validateCard);

  // ---- Owner lookup card ----
  const ownerCard = el('div', { class: 'glass' });
  ownerCard.innerHTML =
    '<h3>Owner code (BIC)</h3>' +
    '<div class="vgm-row"><input id="ownerInput" class="mono" maxlength="4" placeholder="e.g. MSCU" ' +
    'autocomplete="off" autocapitalize="characters" /><button class="btn" id="ownerLookup">Look up</button></div>' +
    '<div id="ownerResult" class="vgm-result"></div>';
  left.appendChild(ownerCard);

  // ---- Spec card (right) ----
  const specCard = el('div', { class: 'glass', id: 'specCard' });
  specCard.innerHTML =
    '<div class="empty-vgm"><div class="ic">📦</div><div class="muted">Enter a container number to see owner, ' +
    'size/type, weights, CSC and special-equipment data.</div></div>';
  right.appendChild(specCard);

  // ---- VGM card (right, hidden until a spec is available) ----
  const vgmCard = el('div', { class: 'glass vgm-calc', id: 'vgmCard', style: 'display:none' });
  vgmCard.innerHTML =
    '<h3>VGM — Method 2</h3>' +
    '<p class="muted tiny">VGM = tare + cargo + packing + dunnage. Enter the cargo weight to compute the SOLAS ' +
    'Verified Gross Mass and check it against the container limits.</p>' +
    '<div class="vgm-calc-grid">' +
    '<div><label>Tare (auto)</label><input id="vgmTare" disabled /></div>' +
    '<div><label>Cargo (kg) <span class="req">*</span></label><input id="vgmCargo" type="number" placeholder="25000" /></div>' +
    '<div><label>Computed VGM</label><input id="vgmOut" disabled /></div>' +
    '</div>' +
    '<div id="vgmWarn" class="vgm-result"></div>' +
    '<div class="vgm-row"><button class="btn primary" id="vgmCalc">Compute</button>' +
    '<button class="btn" id="vgmClear">Clear</button></div>';
  right.appendChild(vgmCard);

  // ---- Recent lookups ----
  const recentCard = el('div', { class: 'glass' });
  recentCard.innerHTML = '<h3>Recent lookups</h3><div id="recentBody"></div>';
  right.appendChild(recentCard);

  grid.append(left, right);
  root.appendChild(grid);

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
    'checked against the container\'s max gross mass (VGM) and max payload (cargo); exceeding either raises a ' +
    'rejection warning. A SOLAS declaration may not be filed for a container whose VGM exceeds its max gross.</p>' +
    '<p class="muted tiny">Golden tests run on module load: ' +
    (iso6346.runGoldenTests().length === 0 ? 'all pass ✓' : 'FAILURES: ' + esc(iso6346.runGoldenTests().join('; '))) +
    '.</p>' +
    '</div>';
  root.appendChild(meth);

  // ---- scoped query helper ----
  const $ = <T extends HTMLElement>(sel: string): T | null => root.querySelector<T>(sel);

  // ---- wire events ----
  const cnInput = $<HTMLInputElement>('#cnInput')!;
  const cnValidate = $<HTMLButtonElement>('#cnValidate')!;
  cnValidate.addEventListener('click', () => doValidate(cnInput.value));
  cnInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doValidate(cnInput.value);
  });
  for (const a of root.querySelectorAll<HTMLAnchorElement>('a.vgm-sample')) {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      cnInput.value = a.dataset.s ?? '';
      doValidate(a.dataset.s ?? '');
    });
  }

  $<HTMLButtonElement>('#ownerLookup')!.addEventListener('click', () => {
    doOwnerLookup(root, $<HTMLInputElement>('#ownerInput')!.value);
  });
  $<HTMLInputElement>('#ownerInput')!.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doOwnerLookup(root, $<HTMLInputElement>('#ownerInput')!.value);
  });

  $<HTMLButtonElement>('#vgmCalc')!.addEventListener('click', computeVgm);
  $<HTMLButtonElement>('#vgmClear')!.addEventListener('click', () => {
    const c = $<HTMLInputElement>('#vgmCargo')!;
    c.value = '';
    const out = $<HTMLInputElement>('#vgmOut')!;
    out.value = '';
    $<HTMLElement>('#vgmWarn')!.innerHTML = '';
  });

  drawRecent(root);

  // ---- core logic (scoped to `root`) ----
  function doValidate(raw: string): void {
    const r = iso6346.validate(raw);
    const box = $<HTMLElement>('#cnResult')!;
    if (r.valid) {
      box.innerHTML =
        '<div class="vgm-alert vgm-ok">✓ Valid ISO 6346 — check digit correct (' +
        r.checkDigit + ').</div>';
    } else {
      const corr = iso6346.suggestCorrected(raw);
      const corrHtml = corr ? ' Suggested: <code class="mono">' + esc(corr) + '</code>' : '';
      box.innerHTML =
        '<div class="vgm-alert vgm-bad">✗ Invalid: ' + esc(r.errors.join('; ')) + '.' + corrHtml + '</div>';
    }
    renderSpec(r);
    if (r.normalized) {
      lookups.unshift({ id: r.normalized, ok: r.valid, when: Date.now() });
      if (lookups.length > 8) lookups.pop();
      drawRecent(root);
    }
  }

  function renderSpec(r: ValidationResult): void {
    const card = $<HTMLElement>('#specCard')!;
    const vgmCardEl = $<HTMLElement>('#vgmCard')!;
    if (!r || !r.valid) {
      card.innerHTML = '<div class="vgm-alert vgm-warn">Fix the container number before lookup.</div>';
      vgmCardEl.style.display = 'none';
      return;
    }
    const id = r.normalized;
    let spec: ContainerSpec | undefined = CONTAINERS[id] ?? manual[id];
    let sourceLabel = 'BIC BoxTech';
    let quality = 'ok';
    let isManual = false;
    if (manual[id]) {
      spec = manual[id];
      sourceLabel = 'Manual (unverified)';
      quality = 'partial';
      isManual = true;
    }
    if (!spec) {
      card.innerHTML =
        '<div class="vgm-alert vgm-warn">No sample record for ' + esc(id) + '. Enter an unverified record to ' +
        'continue (the BIC BoxTech API supplies this in production).</div>' +
        '<details class="vgm-manual"><summary class="btn sm">Manual entry (unverified)</summary>' +
        '<div class="vgm-calc-grid" style="margin-top:10px">' +
        '<div><label>Size/type</label><input id="mST" class="mono" placeholder="42G1" /></div>' +
        '<div><label>Tare (kg)</label><input id="mTare" type="number" placeholder="3700" /></div>' +
        '<div><label>Max gross (kg)</label><input id="mMG" type="number" placeholder="30480" /></div>' +
        '<div><label>Max payload (kg)</label><input id="mMP" type="number" placeholder="26780" /></div>' +
        '</div><button class="btn primary sm" id="saveManual" style="margin-top:10px">Save unverified record</button></details>';
      vgmCardEl.style.display = 'none';
      $<HTMLButtonElement>('#saveManual')!.addEventListener('click', () => {
        const rec: ContainerSpec = {
          sizeType: $<HTMLInputElement>('#mST')!.value.trim() || null,
          tare: +$<HTMLInputElement>('#mTare')!.value || 0,
          maxGross: +$<HTMLInputElement>('#mMG')!.value || 0,
          maxPayload: +$<HTMLInputElement>('#mMP')!.value || 0,
          maxStacking: null,
          manufacturer: null,
          csc: null,
          special: null,
          source: 'Manual',
          fetchedAt: new Date().toISOString().slice(0, 10),
          quality: 'partial',
        };
        manual[id] = rec;
        renderSpec(r);
      });
      return;
    }
    const owner = OWNERS[id.slice(0, 4)];
    const stDesc = (spec.sizeType && SIZE_TYPES[spec.sizeType]) || 'Unknown code';
    const qBadge =
      quality === 'ok'
        ? '<span class="dc-badge dc-live"><span class="dot"></span>OK</span>'
        : quality === 'stale'
          ? '<span class="dc-badge dc-sample"><span class="dot"></span>Stale</span>'
          : '<span class="dc-badge dc-sample"><span class="dot"></span>Partial</span>';
    const cscBadge =
      spec.csc && spec.csc.approved
        ? '<span class="dc-badge dc-live"><span class="dot"></span>CSC current</span>'
        : '<span class="dc-badge dc-sample"><span class="dot"></span>CSC issue</span>';
    card.innerHTML =
      '<div class="spread"><h3>' + esc(id) + '</h3>' + qBadge + '</div>' +
      '<div class="vgm-tag-row"><span class="tiny muted">' + esc(sourceLabel) + '</span>' +
      (isManual ? '<span class="dc-badge dc-sample"><span class="dot"></span>Unverified</span>' : '') +
      cscBadge + '</div><hr>' +
      '<div class="vgm-kv-grid">' +
      kv('Owner', owner ? esc(owner.name) : '—') +
      kv('Size/type', esc(spec.sizeType ?? '—') + ' <span class="muted tiny">(' + esc(stDesc) + ')</span>') +
      kv('Tare', fmt(spec.tare, 'kg')) +
      kv('Max gross', fmt(spec.maxGross, 'kg')) +
      kv('Max payload', fmt(spec.maxPayload, 'kg')) +
      kv('Max stacking', spec.maxStacking ? fmt(spec.maxStacking, 'kg') : '—') +
      kv('Manufacturer', esc(spec.manufacturer ?? '—')) +
      kv('CSC next', spec.csc ? esc(spec.csc.nextInspection ?? '—') : '—') +
      '</div>' +
      (spec.special ? '<hr><div class="vgm-special"><div class="tiny muted">Special equipment</div><div class="mono small">' + esc(JSON.stringify(spec.special)) + '</div></div>' : '') +
      (quality === 'stale' ? '<div class="vgm-alert vgm-warn">Data is stale (last fetched ' + esc(spec.fetchedAt ?? '—') + ').</div>' : '');
    // show + populate the VGM card
    vgmCardEl.style.display = '';
    $<HTMLInputElement>('#vgmTare')!.value = `${spec.tare} kg`;
    $<HTMLInputElement>('#vgmCargo')!.value = '';
    $<HTMLInputElement>('#vgmOut')!.value = '';
    $<HTMLElement>('#vgmWarn')!.innerHTML = '';
  }

  function computeVgm(): void {
    const specId = ($<HTMLElement>('#specCard')!.querySelector('h3')?.textContent ?? '').trim();
    const spec: ContainerSpec | undefined = CONTAINERS[specId] ?? manual[specId];
    if (!spec) {
      $<HTMLElement>('#vgmWarn')!.innerHTML = '<div class="vgm-alert vgm-warn">Look up a container first.</div>';
      return;
    }
    const cargo = +$<HTMLInputElement>('#vgmCargo')!.value || 0;
    const r = vgm.evaluate(spec.tare, cargo, spec.maxGross, spec.maxPayload);
    $<HTMLInputElement>('#vgmOut')!.value = `${r.vgm} kg`;
    $<HTMLElement>('#vgmWarn')!.innerHTML = r.within
      ? '<div class="vgm-alert vgm-ok">✓ Within limits. VGM ' + r.vgm + ' kg ≤ max gross ' + spec.maxGross + ' kg.</div>'
      : '<div class="vgm-alert vgm-bad">⚠ ' + esc(r.warnings.join(' ')) + '</div>';
  }

  drawRecent(root);
}

function doOwnerLookup(root: HTMLElement, code: string): void {
  const c = String(code ?? '').toUpperCase().trim();
  const box = root.querySelector<HTMLElement>('#ownerResult')!;
  const o = OWNERS[c];
  box.innerHTML = o
    ? '<div class="vgm-owner"><div class="mono"><b>' + esc(o.name) + '</b></div>' +
      '<div class="tiny muted">' + esc(o.city) + ', ' + esc(o.country) + ' · ' + esc(o.contact) + '</div>' +
      '<span class="dc-badge dc-live"><span class="dot"></span>BIC Codes</span></div>'
    : '<div class="vgm-alert vgm-warn">Owner code not in sample set. (BIC Codes API in production.)</div>';
}

function drawRecent(root: HTMLElement): void {
  const body = root.querySelector<HTMLElement>('#recentBody');
  if (!body) return;
  body.innerHTML = lookups.length
    ? '<div class="table-wrap"><table class="drill-table"><thead><tr><th>Container</th><th>Result</th><th>When</th></tr></thead><tbody>' +
      lookups
        .map(
          (a) =>
            '<tr><td class="mono">' + esc(a.id) + '</td><td>' +
            (a.ok ? '<span class="dc-badge dc-live"><span class="dot"></span>valid</span>'
              : '<span class="dc-badge dc-unavailable"><span class="dot"></span>invalid</span>') +
            '</td><td class="tiny muted">' + ageMin(a.when) + '</td></tr>',
        )
        .join('') +
      '</tbody></table></div>'
    : '<div class="empty-vgm"><div class="ic">🕒</div><div class="muted">No lookups yet in this session.</div></div>';
}

function ageMin(ts: number): string {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  return m < 1 ? 'just now' : m + 'm ago';
}

function kv(k: string, v: string): string {
  return '<div class="vgm-kv"><div class="tiny muted">' + k + '</div><div class="mono"><b>' + v + '</b></div></div>';
}
function fmt(n: number | null | undefined, unit: string): string {
  return n == null ? '—' : `${n.toLocaleString('en-US')} <span class="muted tiny">${unit}</span>`;
}
