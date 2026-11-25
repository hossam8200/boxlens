// BoxLens "Platform & API" page — the #/api route. Surfaces the live serverless
// /api/v1 health, every widget endpoint, the data-class legend, and the
// platform architecture. Pure DOM + one live fetch; jsdom-testable.
import { el } from './framework/components';
import { DASHBOARD_CATALOG, getDashboardWidgets } from './framework/registry';
import { DATA_CLASSES, DATA_CLASS_META, dataClassMeta } from './framework/dataClass';
import { fetchHealth } from './framework/api';
import type { DataClass } from './framework/types';

interface EndpointRow {
  path: string;
  cls: DataClass;
  badgeCls: string;
  refresh: string;
}

function refreshLabel(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h`;
  if (sec < 604800) return `${Math.round(sec / 86400)}d`;
  return `${Math.round(sec / 604800)}w`;
}

/** Pure: collect a deduplicated, catalog-ordered list of widget endpoints. */
function collectEndpoints(): EndpointRow[] {
  const seen = new Set<string>();
  const out: EndpointRow[] = [];
  for (const d of DASHBOARD_CATALOG) {
    for (const w of getDashboardWidgets(d.id)) {
      if (!w.endpoint || seen.has(w.endpoint)) continue;
      seen.add(w.endpoint);
      out.push({
        path: w.endpoint,
        cls: w.dataClass,
        badgeCls: dataClassMeta(w.dataClass).cls,
        refresh: refreshLabel(w.refreshSec),
      });
    }
  }
  return out;
}

export async function renderApiView(root: HTMLElement): Promise<void> {
  root.innerHTML = '';

  // ---- Hero ----
  const hero = el('div', { class: 'glass feat-hero' });
  hero.innerHTML =
    '<div class="feat-hero-eyebrow">Serverless · /api/v1</div>' +
    '<h1>Platform &amp; API</h1>' +
    '<p class="muted">A single serverless API at <code class="mono">/api/v1</code> powers every widget. ' +
    'Keyless public providers sit behind a per-provider quota, a circuit breaker, and a ' +
    'stale-while-revalidate cache — so a failing source never breaks the page.</p>';
  root.appendChild(hero);

  // ---- Live health ----
  root.appendChild(sectionHead('Live health', 'GET /api/v1/health — the shell footer polls this every 60s.'));
  const healthCard = el('div', { class: 'glass api-health' });
  healthCard.innerHTML =
    '<div class="api-health-grid">' +
    '<div><div class="kpi-label">Status</div><div class="api-health-val"><span class="skeleton" style="height:20px;width:90px"></span></div></div>' +
    '<div><div class="kpi-label">Last update</div><div class="api-health-val muted"><span class="skeleton" style="height:20px;width:120px"></span></div></div>' +
    '<div><div class="kpi-label">Endpoint</div><div class="api-health-val mono small">/api/v1/health</div></div>' +
    '</div>' +
    '<div class="api-health-actions"><button class="btn btn-ghost btn-icon api-refresh">Refresh</button></div>';
  root.appendChild(healthCard);
  healthCard.querySelector<HTMLButtonElement>('.api-refresh')?.addEventListener('click', () => void refreshHealth(healthCard));
  void refreshHealth(healthCard);

  // ---- Widget endpoints ----
  root.appendChild(sectionHead('Widget endpoints', 'Every dashboard widget resolves to one serverless route.'));
  const endpoints = collectEndpoints();
  const wrap = el('div', { class: 'glass table-wrap' });
  let rowsHtml = '';
  for (const e of endpoints) {
    rowsHtml +=
      `<tr><td><span class="mono api-method">GET</span></td>` +
      `<td><code class="mono api-path">${esc(e.path)}</code></td>` +
      `<td><span class="dc-badge ${e.badgeCls}" title="${esc(DATA_CLASS_META[e.cls].hint)}"><span class="dot"></span>${e.cls}</span></td>` +
      `<td class="muted small">${esc(e.refresh)}</td></tr>`;
  }
  wrap.innerHTML =
    `<table class="drill-table api-table"><thead><tr><th>Method</th><th>Path</th><th>Data class</th><th>Refresh</th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
  root.appendChild(wrap);

  // ---- Data-class legend ----
  root.appendChild(sectionHead('Data-class badges', 'Each endpoint is tagged so you know how authoritative its data is.'));
  const dleg = el('div', { class: 'glass feat-legend' });
  for (const c of DATA_CLASSES) {
    const m = DATA_CLASS_META[c];
    const row = el('div', { class: 'feat-legend-row' });
    row.innerHTML = `<span class="dc-badge ${m.cls}"><span class="dot"></span>${m.label}</span><span class="muted small">${esc(m.hint)}</span>`;
    dleg.appendChild(row);
  }
  root.appendChild(dleg);

  // ---- Platform architecture ----
  root.appendChild(sectionHead('Platform architecture', 'Why the API stays fast, free, and honest.'));
  const arch = el('div', { class: 'glass feat-prov' });
  arch.innerHTML =
    `<p><b>Keyless providers.</b> Six public-data sources (Open-Meteo, NASA EONET, USGS, Frankfurter, Nager.Date, World Bank) need no API key — only AIS requires <code class="mono">AISSTREAM_KEY</code> + a cron.</p>` +
    `<p><b>Resilience.</b> Each provider has a per-day quota, a circuit breaker that opens on repeated failures, and an in-memory SWR cache that serves the last good value (flagged "stale") while a refresh is in flight or failing.</p>` +
    `<p><b>Honesty.</b> On a hard failure with no cached value, the endpoint returns an explicit <b>UNAVAILABLE</b> payload — never an empty chart, never sample data dressed as live.</p>` +
    `<p class="muted small">Set <code class="mono">UPSTASH_REDIS_REST_URL</code> + <code class="mono">UPSTASH_REDIS_REST_TOKEN</code> to share cache and quota across serverless instances.</p>`;
  root.appendChild(arch);
}

/** Fetch /api/v1/health and render status + age into the health card. */
async function refreshHealth(card: HTMLElement): Promise<void> {
  const vals = card.querySelectorAll<HTMLElement>('.api-health-val');
  const setStatus = (html: string) => { if (vals[0]) vals[0].innerHTML = html; };
  const setAge = (html: string) => { if (vals[1]) vals[1].innerHTML = html; };
  setStatus('<span class="skeleton" style="height:20px;width:90px"></span>');
  setAge('<span class="skeleton" style="height:20px;width:120px"></span>');
  const h = await fetchHealth<{ status: string; time: string }>();
  if (!h) {
    setStatus('<span class="dc-badge dc-unavailable"><span class="dot"></span>UNAVAILABLE</span>');
    setAge('API unreachable');
    return;
  }
  const ageMs = Date.now() - Date.parse(h.time);
  const mins = Math.max(0, Math.round(ageMs / 60_000));
  const ok = h.status === 'ok' || h.status === 'healthy';
  setStatus(`<span class="dc-badge ${ok ? 'dc-live' : 'dc-unavailable'}"><span class="dot"></span>${esc(h.status)}</span>`);
  setAge(`${mins}m ago · ${esc(h.time)}`);
}

function sectionHead(title: string, sub: string): HTMLElement {
  const h = el('div', { class: 'feat-section-head' });
  h.innerHTML = `<h2>${esc(title)}</h2><p class="muted small">${esc(sub)}</p>`;
  return h;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
