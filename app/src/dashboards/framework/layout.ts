// Reorderable/hideable widget layouts, persisted in localStorage with JSON
// export/import. Pure merge + serialize logic is unit-tested.
import type { DashboardId } from './types';

export interface LayoutEntry {
  hidden: boolean;
  /** Sort order; lower comes first. */
  order: number;
}
export type LayoutState = Record<string, LayoutEntry>;

const PREFIX = 'boxlens-layout-';

function storage(): Storage | null {
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

export function loadLayout(dashboard: DashboardId): LayoutState {
  const raw = storage()?.getItem(PREFIX + dashboard);
  if (!raw) return {};
  return importLayout(raw);
}

export function saveLayout(dashboard: DashboardId, state: LayoutState): void {
  storage()?.setItem(PREFIX + dashboard, exportLayout(state));
}

export function exportLayout(state: LayoutState): string {
  return JSON.stringify(state);
}

/** Parse + validate a layout JSON string. Bad input yields an empty layout. */
export function importLayout(json: string): LayoutState {
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch {
    return {};
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return {};
  const out: LayoutState = {};
  const rec = obj as Record<string, unknown>;
  for (const [k, v] of Object.entries(rec)) {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) continue;
    const e = v as Record<string, unknown>;
    const hidden = e.hidden === true;
    const order = typeof e.order === 'number' && Number.isFinite(e.order) ? e.order : 0;
    out[k] = { hidden, order };
  }
  return out;
}

/**
 * Merge saved layout over defaults. Saved entries win; defaults fill gaps.
 * Hidden defaults to false; order defaults to the widget's natural index.
 * Pure.
 */
export function mergeLayout(
  widgetIds: readonly string[],
  saved: LayoutState,
): LayoutState {
  const out: LayoutState = {};
  widgetIds.forEach((id, idx) => {
    const s = saved[id];
    out[id] = {
      hidden: s?.hidden ?? false,
      order: s?.order ?? idx,
    };
  });
  return out;
}

/** Ordered, visible widget ids after applying a layout. Pure. */
export function orderedVisible(
  widgetIds: readonly string[],
  layout: LayoutState,
): string[] {
  return widgetIds
    .filter((id) => !(layout[id]?.hidden ?? false))
    .sort((a, b) => (layout[a]?.order ?? 0) - (layout[b]?.order ?? 0));
}
