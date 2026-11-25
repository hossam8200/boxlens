// Data-class metadata + assignment helpers. Pure, unit-tested.
import type { DataClass } from './types';

export interface DataClassMeta {
  label: string;
  /** CSS class on the badge element. */
  cls: string;
  /** Foreground / accent colour for the badge dot. */
  color: string;
  /** Short tooltip explaining what the class means. */
  hint: string;
}

export const DATA_CLASS_META: Record<DataClass, DataClassMeta> = {
  LIVE: {
    label: 'LIVE',
    cls: 'dc-live',
    color: '#16a34a',
    hint: 'Real-time or near-real-time source.',
  },
  DAILY: {
    label: 'DAILY',
    cls: 'dc-daily',
    color: '#2563eb',
    hint: 'Refreshed once per day.',
  },
  ANNUAL: {
    label: 'ANNUAL',
    cls: 'dc-annual',
    color: '#7c3aed',
    hint: 'Refreshed yearly or slower. Not real time.',
  },
  ESTIMATE: {
    label: 'ESTIMATE',
    cls: 'dc-estimate',
    color: '#d97706',
    hint: 'Derived by a documented method — hover to see how.',
  },
  SAMPLE: {
    label: 'SAMPLE',
    cls: 'dc-sample',
    color: '#64748b',
    hint: 'Illustrative fixture, never presented as live.',
  },
  UNAVAILABLE: {
    label: 'UNAVAILABLE',
    cls: 'dc-unavailable',
    color: '#dc2626',
    hint: 'Not available on the free tier.',
  },
};

export const DATA_CLASSES: ReadonlyArray<DataClass> = Object.freeze([
  'LIVE',
  'DAILY',
  'ANNUAL',
  'ESTIMATE',
  'SAMPLE',
  'UNAVAILABLE',
]);

export function dataClassMeta(c: DataClass): DataClassMeta {
  return DATA_CLASS_META[c];
}

/** ESTIMATE and UNAVAILABLE widgets must explain their method on hover. */
export function requiresMethod(c: DataClass): boolean {
  return c === 'ESTIMATE' || c === 'UNAVAILABLE';
}

/** True when a data-class is honest about being non-authoritative. */
export function isNonAuthoritative(c: DataClass): boolean {
  return c === 'ESTIMATE' || c === 'SAMPLE' || c === 'UNAVAILABLE';
}
