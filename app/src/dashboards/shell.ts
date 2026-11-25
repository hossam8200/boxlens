// BoxLens Dashboards shell — modern UX (slice #1 redesign).
//
// Replaces the old sidebar+dropdown layout with:
//   • A sticky topbar carrying brand, breadcrumb, theme toggle, and a slim
//     horizontal "pill" rail to switch dashboards (NOT a dropdown — every
//     dashboard is always one click away).
//   • A "tile gallery" landing page (#/dashboards/ with no id) — large
//     gradient cards, one per dashboard, with icon, blurb, data-class badge
//     and a live status pill. Clicking a tile enters that dashboard.
//   • Inside a dashboard, a "← All dashboards" back button sits next to the
//     title, so navigating back to the gallery is always one click.
//
// The router still lazy-loads each dashboard route module; unimplemented
// routes fall back to an honest "coming in slice N" placeholder.
import { DASHBOARD_CATALOG } from './framework/registry';
import type { DashboardMeta } from './framework/registry';
import { dataClassMeta } from './framework/dataClass';
import { toggleTheme, getTheme } from './framework/theme';
import { parseHash, buildHash, readDashboard, readFilters, writeHash } from './framework/filters';
import { fetchHealth, apiBase } from './framework/api';
import type { DashboardId, FilterState } from './framework/types';
import { el } from './framework/components';
import { tileGallery } from './framework/gallery';
import { autocompleteField, type AutocompleteItem } from './framework/autocomplete';
import { COUNTRY_ITEMS } from '../vgm/ports';

export interface RouteRender {
  (root: HTMLElement, filters: FilterState): Promise<void>;
}

/** Which slice lands each dashboard (drives the "coming in slice N" placeholder). */
const SLICE_OF: Record<DashboardId, number> = {
  executive: 1,
  compliance: 2,
  weather: 3,
  chokepoints: 4,
  trade: 5,
  cost: 6,
  vessel: 7,
  health: 8,
  'classic-analytics': 9,
};

const ROUTES: Partial<Record<DashboardId, () => Promise<{ render: RouteRender }>>> = {
  executive: () => import('./routes/executive').then((m) => ({ render: m.render })),
  compliance: () => import('./routes/compliance').then((m) => ({ render: m.render })),
  weather: () => import('./routes/weather').then((m) => ({ render: m.render })),
  chokepoints: () => import('./routes/chokepoints').then((m) => ({ render: m.render })),
  trade: () => import('./routes/trade').then((m) => ({ render: m.render })),
  cost: () => import('./routes/cost').then((m) => ({ render: m.render })),
  vessel: () => import('./routes/vessel').then((m) => ({ render: m.render })),
  health: () => import('./routes/health').then((m) => ({ render: m.render })),
  'classic-analytics': () => import('./routes/classic-analytics').then((m) => ({ render: m.render })),
};

export interface Shell {
  content: HTMLElement;
  setLastUpdate(text: string): void;
  navigate(dashboard: DashboardId | null): void;
}

export function mountShell(root: HTMLElement): Shell {
  root.innerHTML = '';
  const app = el('div', { class: 'dash-app' });

  // ---- Main column (no sidebar — gallery lives inside the content area) ----
  const main = el('div', { class: 'dash-main' });
  const topbar = el('div', { class: 'dash-topbar' });

  const brand = el('button', { class: 'dash-brand', title: 'All dashboards' });
  brand.innerHTML =
    '<div class="logo">B</div>' +
    '<div class="brand-text"><div class="name">BoxLens</div><div class="sub">Dashboards</div></div>';
  brand.addEventListener('click', () => navigate(null));

  const crumb = el('div', { class: 'dash-crumb' }, ['Dashboards']);
  const title = el('div', { class: 'title' });

  // Pill rail: every dashboard one click away, scrollable on small screens.
  const rail = el('nav', { class: 'dash-rail', 'aria-label': 'Dashboards' });
  for (const d of DASHBOARD_CATALOG) {
    const meta = dataClassMeta(d.dataClass);
    const pill = el('button', {
      class: 'dash-pill',
      'data-dash': d.id,
      title: `${d.title} — ${meta.hint}`,
    });
    pill.innerHTML = `<span class="ico">${d.icon}</span><span class="lbl">${d.title}</span>`;
    pill.addEventListener('click', () => navigate(d.id));
    rail.appendChild(pill);
  }

  const themeBtn = el('button', { class: 'btn btn-ghost btn-icon', title: 'Toggle theme' },
    [getTheme() === 'dark' ? '☀️' : '🌙']);
  themeBtn.addEventListener('click', () => {
    const next = toggleTheme();
    themeBtn.textContent = next === 'dark' ? '☀️' : '🌙';
  });

  const railWrap = el('div', { class: 'dash-rail-wrap' }, [rail]);

  // Aux nav: every part of the app is one click away from this single URL —
  // Features (#/features), VGM (#/vgm, the classic container/VGM tool rebuilt
  // natively — no iframe), and API (#/api, the live serverless platform).
  const auxNav = el('nav', { class: 'dash-aux-nav', 'aria-label': 'Sections' });
  const featBtn = el('button', { class: 'dash-pill dash-pill-aux', title: 'Features & capabilities' });
  featBtn.innerHTML = '<span class="ico">✨</span><span class="lbl">Features</span>';
  featBtn.addEventListener('click', () => navigateFeatures());
  const vgmBtn = el('button', { class: 'dash-pill dash-pill-aux', title: 'VGM & container tools' });
  vgmBtn.innerHTML = '<span class="ico">🧮</span><span class="lbl">VGM</span>';
  vgmBtn.addEventListener('click', () => navigateVgm());
  const apiBtn = el('button', { class: 'dash-pill dash-pill-aux', title: 'Platform & API' });
  apiBtn.innerHTML = '<span class="ico">⚡</span><span class="lbl">API</span>';
  apiBtn.addEventListener('click', () => navigateApi());
  auxNav.append(featBtn, vgmBtn, apiBtn);

  topbar.append(brand, crumb, title, railWrap, auxNav, themeBtn);
  // Filter bar is shown only inside a dashboard (added per-render below).
  const filterHost = el('div', { class: 'dash-filter-host' });
  topbar.appendChild(filterHost);

  const content = el('main', { class: 'dash-content' });
  const footer = el('footer', { class: 'dash-footer' }, ['Loading…']);

  main.append(topbar, content, footer);
  app.append(main);
  root.appendChild(app);

  const shell: Shell = {
    content,
    setLastUpdate(text: string) {
      footer.textContent = text;
    },
    navigate,
  };

  type Mode = 'dashboards' | 'features' | 'vgm' | 'api';
  const MODE_META: Record<Mode, { title: string; crumb: string; hint: string }> = {
    dashboards: { title: '', crumb: 'Dashboards', hint: 'Pick a dashboard' },
    features: { title: '✨ Features & Capabilities', crumb: 'Features', hint: 'Overview of every capability' },
    vgm: { title: '🧮 VGM & Container tools', crumb: 'VGM', hint: 'ISO 6346 + VGM Method 2 (native)' },
    api: { title: '⚡ Platform & API', crumb: 'API', hint: 'Live platform status & endpoints' },
  };
  function setActive(id: DashboardId | null, mode: Mode = 'dashboards'): void {
    for (const btn of rail.querySelectorAll<HTMLButtonElement>('.dash-pill')) {
      btn.classList.toggle('active', btn.getAttribute('data-dash') === id);
    }
    featBtn.classList.toggle('active', mode === 'features');
    vgmBtn.classList.toggle('active', mode === 'vgm');
    apiBtn.classList.toggle('active', mode === 'api');
    filterHost.innerHTML = '';
    if (mode === 'dashboards') {
      const meta = DASHBOARD_CATALOG.find((d) => d.id === id);
      title.textContent = meta ? `${meta.icon} ${meta.title}` : '';
      // Breadcrumb: "Dashboards / <title>" inside a dashboard, just "Dashboards" on the gallery.
      crumb.textContent = meta ? `Dashboards › ${meta.title}` : 'Dashboards';
      // Filter bar visible only inside a dashboard.
      if (meta) filterHost.appendChild(buildFilterBar());
      else filterHost.appendChild(el('span', { class: 'muted small', style: 'align-self:center' }, ['Pick a dashboard']));
      return;
    }
    const m = MODE_META[mode];
    title.textContent = m.title;
    crumb.textContent = m.crumb;
    filterHost.appendChild(el('span', { class: 'muted small', style: 'align-self:center' }, [m.hint]));
  }

  async function navigate(id: DashboardId | null): Promise<void> {
    const filters = readFilters();
    if (id) {
      writeHash(id, filters);
      await renderRoute(id, filters);
    } else {
      // Gallery route: hash with no id segment.
      if (typeof history !== 'undefined') {
        history.replaceState(null, '', buildHash(null as never, filters).replace(/\/[^?]*\?/, '/?') || '#/dashboards/');
      }
      location.hash = '#/dashboards/';
      await renderGallery();
    }
  }

  let renderToken = 0;
  async function renderRoute(id: DashboardId | null, filters: FilterState): Promise<void> {
    const my = ++renderToken;
    setActive(id);
    content.innerHTML = '';
    if (!id) {
      await renderGallery();
      return;
    }
    const loader = ROUTES[id];
    if (!loader) {
      content.appendChild(comingNextPlaceholder(id));
      return;
    }
    try {
      const mod = await loader();
      if (my !== renderToken) return; // a newer render started mid-import; abort
      content.innerHTML = ''; // clear any stale partial append before rendering
      await mod.render(content, filters);
    } catch (err) {
      content.appendChild(el('div', { class: 'glass unavailable-state' }, [
        `Failed to load dashboard: ${err instanceof Error ? err.message : String(err)}`,
      ]));
    }
  }

  async function renderGallery(): Promise<void> {
    setActive(null);
    content.innerHTML = '';
    const gallery = tileGallery(DASHBOARD_CATALOG, (d) => void navigate(d.id));
    content.appendChild(gallery);
  }

  function navigateFeatures(): void {
    if (typeof history !== 'undefined') history.replaceState(null, '', '#/features');
    location.hash = '#/features';
    void renderFeaturesPage();
  }

  async function renderFeaturesPage(): Promise<void> {
    const my = ++renderToken;
    setActive(null, 'features');
    content.innerHTML = '';
    try {
      const mod = await import('./features');
      if (my !== renderToken) return; // a newer render started mid-import; abort
      content.innerHTML = '';
      mod.renderFeatures(content, (id) => void navigate(id));
    } catch (err) {
      content.appendChild(el('div', { class: 'glass unavailable-state' }, [
        `Failed to load Features page: ${err instanceof Error ? err.message : String(err)}`,
      ]));
    }
  }

  function navigateVgm(): void {
    if (typeof history !== 'undefined') history.replaceState(null, '', '#/vgm');
    location.hash = '#/vgm';
    void renderVgmPage();
  }

  // Native VGM & container tool — the classic "Check" view rebuilt inside the
  // modern shell with @boxlens/core (ISO 6346 + VGM Method 2). NO iframe: the
  // whole app is one application under one URL.
  async function renderVgmPage(): Promise<void> {
    const my = ++renderToken;
    setActive(null, 'vgm');
    content.innerHTML = '';
    try {
      const mod = await import('./vgm');
      if (my !== renderToken) return; // a newer render started mid-import; abort
      content.innerHTML = '';
      mod.renderVgm(content);
    } catch (err) {
      content.appendChild(el('div', { class: 'glass unavailable-state' }, [
        `Failed to load VGM tool: ${err instanceof Error ? err.message : String(err)}`,
      ]));
    }
  }

  function navigateApi(): void {
    if (typeof history !== 'undefined') history.replaceState(null, '', '#/api');
    location.hash = '#/api';
    void renderApiPage();
  }

  async function renderApiPage(): Promise<void> {
    const my = ++renderToken;
    setActive(null, 'api');
    content.innerHTML = '';
    try {
      const mod = await import('./api-view');
      if (my !== renderToken) return; // a newer render started mid-import; abort
      content.innerHTML = '';
      await mod.renderApiView(content);
    } catch (err) {
      content.appendChild(el('div', { class: 'glass unavailable-state' }, [
        `Failed to load API page: ${err instanceof Error ? err.message : String(err)}`,
      ]));
    }
  }

  function comingNextPlaceholder(id: DashboardId): HTMLElement {
    const n = SLICE_OF[id];
    const meta = DASHBOARD_CATALOG.find((d) => d.id === id);
    return el('div', { class: 'glass', style: 'padding:28px;max-width:620px' }, [
      el('h2', {}, [`${meta?.icon ?? ''} ${meta?.title ?? id}`]),
      el('p', { class: 'muted' }, [
        `This dashboard is built in slice #${n}, per the spec's build order.`,
      ]),
      el('p', { class: 'small muted' }, [
        'Until then it renders an explicit placeholder — never an empty chart, ' +
          'and never sample data presented as live.',
      ]),
    ]);
  }

  // ---- Router ----
  window.addEventListener('hashchange', () => {
    const hash = location.hash;
    if (hash === '#/features' || hash.startsWith('#/features')) {
      void renderFeaturesPage();
      return;
    }
    if (hash === '#/vgm' || hash.startsWith('#/vgm')) {
      void renderVgmPage();
      return;
    }
    if (hash === '#/api' || hash.startsWith('#/api')) {
      void renderApiPage();
      return;
    }
    const { dashboard, filters } = parseHash(hash);
    if (!dashboard) {
      void renderGallery();
    } else {
      void renderRoute(dashboard, filters);
    }
  });

  // Initial route: special in-app pages first; empty hash → gallery; otherwise a dashboard.
  const initHash = location.hash;
  if (initHash === '#/features' || initHash.startsWith('#/features')) {
    void renderFeaturesPage();
  } else if (initHash === '#/vgm' || initHash.startsWith('#/vgm')) {
    void renderVgmPage();
  } else if (initHash === '#/api' || initHash.startsWith('#/api')) {
    void renderApiPage();
  } else if (!readDashboard()) {
    if (initHash !== '#/dashboards/' && initHash !== '') {
      history.replaceState(null, '', '#/dashboards/');
    }
    void renderGallery();
  } else {
    void renderRoute(readDashboard(), readFilters());
  }

  return shell;
}

/** A minimal global filter bar (port / country / range / compare) synced to the hash. */
function buildFilterBar(): HTMLElement {
  const bar = el('div', { class: 'filter-bar' });
  const f = readFilters();
  // Port + Country are searchable autocomplete dropdowns — type to filter,
  // click to select. Choosing one updates the hash and re-fetches widgets.
  const apply = (next: FilterState): void => {
    const dash = readDashboard() ?? 'executive';
    // Setting location.hash (not replaceState) fires hashchange → re-render +
    // re-fetch with the new filter, so the dashboard reflects the selection.
    location.hash = buildHash(dash, next);
  };
  bar.appendChild(
    autocompleteField({
      label: 'Port',
      fetchItems: async (q: string): Promise<AutocompleteItem[]> => {
        // Debounced lookup against the full ~17.5k UN/LOCODE sea-port registry
        // served by /api/v1/ports/search. When a country is selected, the query
        // carries it so only ports in that country are returned.
        try {
          const country = readFilters().country ?? '';
          const qs = `q=${encodeURIComponent(q)}` + (country ? `&country=${encodeURIComponent(country)}` : '');
          const res = await fetch(`${apiBase()}/ports/search?${qs}`, {
            headers: { accept: 'application/json' },
          });
          if (!res.ok) return [];
          const j = (await res.json()) as { items?: AutocompleteItem[] };
          return j.items ?? [];
        } catch {
          return [];
        }
      },
      value: attr(f.port),
      placeholder: 'Search port…',
      onChange: (v) => { const cur = readFilters(); cur.port = v || undefined; apply(cur); },
    }),
  );
  bar.appendChild(
    autocompleteField({
      label: 'Country',
      items: COUNTRY_ITEMS,
      value: attr(f.country),
      placeholder: 'Search country…',
      onChange: (v) => {
        const cur = readFilters();
        cur.country = v || undefined;
        // Selecting a country narrows the port scope — clear a now-out-of-scope
        // port so the dashboard reflects the country, not a stale port pick.
        if (v) cur.port = undefined;
        apply(cur);
      },
    }),
  );
  const dates = el('div', { class: 'filter-dates' });
  dates.innerHTML =
    field('From', `<input data-k="from" type="date" value="${attr(f.from)}">`) +
    field('To', `<input data-k="to" type="date" value="${attr(f.to)}">`) +
    `<label class="tiny muted"><input type="checkbox" data-k="compare" ${f.compare ? 'checked' : ''}> Compare</label>`;
  bar.appendChild(dates);
  for (const input of bar.querySelectorAll<HTMLInputElement>('[data-k]')) {
    input.addEventListener('change', () => {
      const cur = readFilters();
      const k = input.getAttribute('data-k') as keyof FilterState;
      if (input.type === 'checkbox') (cur as unknown as Record<string, unknown>)[k] = input.checked;
      else (cur as unknown as Record<string, unknown>)[k] = input.value.trim() || undefined;
      apply(cur);
    });
  }
  return bar;
}

function field(label: string, control: string): string {
  return `<div class="field"><label>${label}</label>${control}</div>`;
}
function attr(v: string | undefined): string {
  return v ? v.replace(/"/g, '') : '';
}

/** Poll /api/v1/health and surface a "Last update X ago" footer + budget status. */
export async function pollHealth(shell: Shell): Promise<void> {
  const h = await fetchHealth<{ status: string; time: string }>();
  if (!h) {
    shell.setLastUpdate('API unreachable — showing UNAVAILABLE states. (Local dev has no /api/v1 server.)');
    return;
  }
  const ageMs = Date.now() - Date.parse(h.time);
  const mins = Math.max(0, Math.round(ageMs / 60_000));
  shell.setLastUpdate(`Last update ${mins}m ago · platform ${h.status} · $0 free tier`);
}

// Suppress an unused-symbol warning when tree-shaking in builds that drop the
// DashboardMeta import (kept for editor jump-to-definition on DASHBOARD_CATALOG).
export type { DashboardMeta };
