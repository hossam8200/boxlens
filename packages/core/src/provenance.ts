// Provenance/quality model. Pure mappings used by the UI badge renderers;
// returns structured data (no HTML/DOM) so the UI layer formats the markup.

import type { Quality } from './types';

const QUALITY_BADGE: Record<Quality, { cls: string; label: string }> = {
  ok: { cls: 'ok', label: 'OK' },
  partial: { cls: 'warn', label: 'Partial' },
  missing: { cls: 'bad', label: 'Missing' },
  stale: { cls: 'warn', label: 'Stale' },
  conflict: { cls: 'bad', label: 'Conflict' },
};

/** CSS class + human label for a quality state (drives the UI badge). */
export function qualityBadgeParts(q: string): { cls: string; label: string } {
  return QUALITY_BADGE[q as Quality] ?? { cls: 'neutral', label: '\u2014' };
}

/** CSS class for a provenance badge given a quality state. */
export function provenanceClass(q: string): string {
  switch (q as Quality) {
    case 'ok':
      return 'ok';
    case 'stale':
      return 'warn';
    case 'partial':
      return 'warn';
    case 'missing':
      return 'bad';
    default:
      return 'info';
  }
}

/** The full set of provenance states (for documentation/UI). */
export const QUALITY_STATES: ReadonlyArray<Quality> = Object.freeze([
  'ok',
  'partial',
  'missing',
  'stale',
  'conflict',
]);
