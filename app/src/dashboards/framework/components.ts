// DOM component helpers. Build real elements (jsdom-testable); badge/meta use
// HTML strings so they can be composed into innerHTML where convenient.
import type { Provenance, WidgetDef, WidgetPayload } from './types';
import { badgeParts } from './provenance';
import { dataClassMeta } from './dataClass';

type Attrs = Record<string, string>;

export function el(tag: string, attrs: Attrs = {}, children: (Node | string)[] = []): HTMLElement {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) {
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

/** Data-class badge + provenance meta as an HTML string (source · age · stale). */
export function provMetaHtml(p: Provenance, nowMs: number = Date.now()): string {
  const b = badgeParts(p, nowMs);
  const meta = dataClassMeta(p.class);
  const staleFlag = b.stale ? '<span class="stale-flag">Stale</span>' : '';
  const method = p.method
    ? ` <span class="tiny muted" title="${escapeAttr(p.method)}">method ⓘ</span>`
    : '';
  const attr = p.attribution ? ` <span class="tiny muted">${escapeHtml(p.attribution)}</span>` : '';
  return (
    `<span class="dc-badge ${meta.cls}" title="${escapeAttr(meta.hint)}">` +
    `<span class="dot"></span>${meta.label}</span>` +
    `<span class="src">${escapeHtml(b.source)}</span>` +
    `<span>· ${escapeHtml(b.ageText)}</span>` +
    staleFlag + method + attr
  );
}

export function kpiCard(opts: {
  def: WidgetDef;
  payload?: WidgetPayload;
  delta?: string;
  deltaDir?: 'up' | 'down';
  sub?: string;
}): HTMLElement {
  const { def, payload, delta, deltaDir, sub } = opts;
  const value = payload && payload.value !== null && payload.value !== undefined
    ? String(payload.value)
    : '—';
  const unit = payload?.unit ?? '';
  const card = el('div', { class: 'glass kpi-card' });
  const label = el('div', { class: 'kpi-label' }, [def.title]);

  const valueRow = el('div');
  valueRow.innerHTML = `<span class="kpi-value">${escapeHtml(value)}</span>` +
    (unit ? `<span class="kpi-unit">${escapeHtml(unit)}</span>` : '');

  const subRow = el('div', { class: 'kpi-sub' });
  const bits: string[] = [];
  if (delta) {
    const cls = deltaDir === 'down' ? 'down' : 'up';
    const arrow = deltaDir === 'down' ? '↓' : '↑';
    bits.push(`<span class="kpi-delta delta ${cls}">${arrow} ${escapeHtml(delta)}</span>`);
  }
  if (sub) bits.push(`<span>${escapeHtml(sub)}</span>`);
  subRow.innerHTML = bits.join(' ');

  const spark = el('div', { class: 'kpi-spark', id: `spark-${def.id}` });
  const prov = el('div', { class: 'prov-meta' });
  if (payload) prov.innerHTML = provMetaHtml(payload.provenance);

  card.append(label, valueRow, subRow, spark, prov);
  return card;
}

export function chartCard(opts: {
  title: string;
  provenance?: Provenance;
  exportPng?: () => void;
  exportCsv?: () => void;
}): { root: HTMLElement; body: HTMLElement } {
  const root = el('div', { class: 'glass chart-card' });
  const head = el('div', { class: 'chart-head' });
  head.innerHTML = `<h3>${escapeHtml(opts.title)}</h3><span class="spacer"></span>`;
  if (opts.exportPng) {
    const btn = el('button', { class: 'btn btn-ghost btn-icon', title: 'Export PNG' }, ['PNG']);
    btn.addEventListener('click', () => opts.exportPng?.());
    head.appendChild(btn);
  }
  if (opts.exportCsv) {
    const btn = el('button', { class: 'btn btn-ghost btn-icon', title: 'Export CSV' }, ['CSV']);
    btn.addEventListener('click', () => opts.exportCsv?.());
    head.appendChild(btn);
  }
  if (opts.provenance) {
    const meta = el('div', { class: 'prov-meta' });
    meta.innerHTML = provMetaHtml(opts.provenance);
    head.appendChild(meta);
  }
  const body = el('div', { class: 'chart-body' });
  root.append(head, body);
  return { root, body };
}

export function drilldownTable(
  rows: Record<string, string | number | null>[],
  columns?: string[],
): HTMLElement {
  const cols =
    columns ??
    Array.from(
      rows.reduce<Set<string>>((s, r) => {
        for (const k of Object.keys(r)) s.add(k);
        return s;
      }, new Set()),
    );
  const wrap = el('div', { class: 'table-wrap' });
  const table = el('table', { class: 'drill-table' });
  const thead = el('thead');
  thead.innerHTML = '<tr>' + cols.map((c) => `<th>${escapeHtml(c)}</th>`).join('') + '</tr>';
  const tbody = el('tbody');
  for (const r of rows) {
    const tr = el('tr');
    tr.innerHTML = cols
      .map((c) => {
        const v = r[c] ?? '';
        const isNum = typeof v === 'number';
        return `<td class="${isNum ? 'num' : ''}">${escapeHtml(String(v))}</td>`;
      })
      .join('');
    tbody.appendChild(tr);
  }
  table.append(thead, tbody);
  wrap.appendChild(table);
  return wrap;
}

export function skeleton(height = 22): HTMLElement {
  return el('div', { class: 'skeleton', style: `height:${height}px` });
}

export function unavailableState(reason: string): HTMLElement {
  return el('div', { class: 'unavailable-state glass', html:
    `<div class="big">⌀</div>` +
    `<div><span class="dc-badge dc-unavailable"><span class="dot"></span>UNAVAILABLE</span></div>` +
    `<div class="why">${escapeHtml(reason)}</div>`,
  });
}

export function spinner(): HTMLElement {
  return el('div', { class: 'skeleton', style: 'height:100%;min-height:80px' });
}

// ---- minimal HTML escapers (badge strings are inserted via innerHTML) ----
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;');
}
