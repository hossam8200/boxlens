// Searchable autocomplete combobox for the dashboards filter bar.
// A text input with a filtered dropdown of matches. Supports two sources:
//  - `items` (sync): a static list, filtered client-side (used for Country).
//  - `fetchItems` (async): a debounced server lookup (used for Port, backed by
//    /api/v1/ports/search over the full ~17.5k UN/LOCODE registry).
// Selecting an item fires onChange(value); clearing the input fires onChange('').
// Pure DOM, jsdom-testable, mobile friendly. The dropdown already scrolls
// (max-height in styles.css), so we cap matches at 50 rather than the old 8.
import { el } from './components';

export interface AutocompleteItem {
  value: string;
  label: string;
}

const SYNC_CAP = 50;
const ASYNC_CAP = 50;
const DEBOUNCE_MS = 140;

export function autocompleteField(opts: {
  label: string;
  /** Sync source (filtered client-side). Mutually exclusive with fetchItems. */
  items?: readonly AutocompleteItem[];
  /** Async source (debounced server lookup). Mutually exclusive with items. */
  fetchItems?: (q: string) => Promise<AutocompleteItem[]>;
  value: string;
  placeholder: string;
  /** Fired with the chosen value (or '' when cleared). */
  onChange: (value: string) => void;
}): HTMLElement {
  const field = el('div', { class: 'field vgm-ac-field' });
  const lab = el('label', {}, [opts.label]);
  const wrap = el('div', { class: 'vgm-ac' });
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'vgm-ac-input';
  input.placeholder = opts.placeholder;
  input.value = opts.value;
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocapitalize', 'characters');
  const list = el('div', { class: 'vgm-ac-list' });
  wrap.append(input, list);
  field.append(lab, wrap);

  // Guards for the async path: only the most recent request paints, and we
  // collapse rapid keystrokes into one lookup.
  let reqToken = 0;
  let debounceT: ReturnType<typeof setTimeout> | undefined;

  function hide(): void {
    list.style.display = 'none';
    list.innerHTML = '';
  }

  function paint(items: AutocompleteItem[], hint?: 'searching' | 'empty'): void {
    if (items.length === 0) {
      if (hint) {
        list.innerHTML = `<div class="vgm-ac-empty">${hint}</div>`;
        list.style.display = 'block';
      } else {
        hide();
      }
      return;
    }
    list.innerHTML = items
      .map(
        (it) =>
          `<div class="vgm-ac-item" data-v="${esc(it.value)}" role="option">` +
          `<span>${esc(it.label)}</span></div>`,
      )
      .join('');
    list.style.display = 'block';
  }

  function renderSync(q: string): void {
    const ql = q.trim().toLowerCase();
    const matches = ql
      ? (opts.items ?? [])
          .filter((it) => it.value.toLowerCase().includes(ql) || it.label.toLowerCase().includes(ql))
          .slice(0, SYNC_CAP)
      : [];
    paint(matches, ql && matches.length === 0 ? 'empty' : undefined);
  }

  function renderAsync(q: string): void {
    const ql = q.trim();
    if (!ql) {
      hide();
      return;
    }
    if (debounceT) clearTimeout(debounceT);
    paint([], 'searching');
    const tok = ++reqToken;
    debounceT = setTimeout(() => {
      void opts
        .fetchItems!(ql)
        .then((items) => {
          if (tok !== reqToken) return; // a newer keystroke superseded this one
          paint(items.slice(0, ASYNC_CAP), items.length === 0 ? 'empty' : undefined);
        })
        .catch(() => {
          if (tok === reqToken) paint([], 'empty');
        });
    }, DEBOUNCE_MS);
  }

  function render(q: string): void {
    if (opts.fetchItems) renderAsync(q);
    else renderSync(q);
  }

  input.addEventListener('input', () => render(input.value));
  input.addEventListener('focus', () => render(input.value));
  // hide on blur (after a tick so a click on an item registers first)
  input.addEventListener('blur', () => {
    window.setTimeout(() => {
      list.style.display = 'none';
    }, 160);
  });

  list.addEventListener('click', (e: Event) => {
    const target = e.target as HTMLElement;
    const item = target.closest('.vgm-ac-item') as HTMLElement | null;
    if (!item) return;
    const v = item.dataset.v ?? '';
    input.value = v;
    list.style.display = 'none';
    opts.onChange(v);
  });

  // clear-on-Esc + notify empty; Enter picks the first match if any.
  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      input.value = '';
      hide();
      opts.onChange('');
    } else if (e.key === 'Enter') {
      const first = list.querySelector<HTMLElement>('.vgm-ac-item');
      if (first) {
        first.click();
      } else if (input.value.trim() === '') {
        opts.onChange('');
      }
    }
  });

  return field;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
