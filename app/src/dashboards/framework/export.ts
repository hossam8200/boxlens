// Export utilities: CSV serialization (pure, unit-tested) + PNG export from
// ECharts instances + browser download helpers.
import type { ECharts } from 'echarts';

type Row = Record<string, string | number | null>;

/**
 * Serialize rows to CSV. Strings containing comma, quote or newline are quoted
 * and inner quotes are doubled. Numbers and nulls pass through.
 */
export function toCsv(rows: readonly Row[], columns?: readonly string[]): string {
  if (rows.length === 0) return '';
  const cols = columns ?? Array.from(
    rows.reduce<Set<string>>((set, r) => {
      for (const k of Object.keys(r)) set.add(k);
      return set;
    }, new Set()),
  );
  const esc = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines: string[] = [cols.map(esc).join(',')];
  for (const r of rows) {
    lines.push(cols.map((c) => esc(r[c] ?? '')).join(','));
  }
  return lines.join('\n');
}

/** Trigger a browser download for a text blob (CSV, JSON, etc.). */
export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8'): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Export an ECharts chart as a PNG (honours the user's export option). */
export function exportChartPng(chart: ECharts, filename: string): void {
  const url = chart.getDataURL({
    type: 'png',
    pixelRatio: 2,
    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--dash-bg-1') || '#fff',
  });
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Export a table's rows as CSV via downloadText. */
export function exportTableCsv(filename: string, rows: readonly Row[], columns?: readonly string[]): void {
  downloadText(filename, toCsv(rows, columns));
}
