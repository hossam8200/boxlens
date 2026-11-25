// Theme controller: light/dark, persisted, respects prefers-color-scheme.
export type Theme = 'light' | 'dark';

const KEY = 'boxlens-dash-theme';

export function getTheme(): Theme {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  }
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function setTheme(t: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', t);
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, t);
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

/** Apply the persisted/preferred theme as early as possible to avoid flash. */
export function initTheme(): void {
  setTheme(getTheme());
}
