import { describe, expect, it } from 'vitest';
import { QUALITY_STATES, provenanceClass, qualityBadgeParts } from '../src/provenance';

describe('qualityBadgeParts', () => {
  it('maps each known quality state', () => {
    expect(qualityBadgeParts('ok')).toEqual({ cls: 'ok', label: 'OK' });
    expect(qualityBadgeParts('partial')).toEqual({ cls: 'warn', label: 'Partial' });
    expect(qualityBadgeParts('missing')).toEqual({ cls: 'bad', label: 'Missing' });
    expect(qualityBadgeParts('stale')).toEqual({ cls: 'warn', label: 'Stale' });
    expect(qualityBadgeParts('conflict')).toEqual({ cls: 'bad', label: 'Conflict' });
  });
  it('falls back to neutral for an unknown state', () => {
    expect(qualityBadgeParts('unknown')).toEqual({ cls: 'neutral', label: '\u2014' });
    expect(qualityBadgeParts('')).toEqual({ cls: 'neutral', label: '\u2014' });
  });
});

describe('provenanceClass', () => {
  it('maps quality to a CSS class', () => {
    expect(provenanceClass('ok')).toBe('ok');
    expect(provenanceClass('stale')).toBe('warn');
    expect(provenanceClass('partial')).toBe('warn');
    expect(provenanceClass('missing')).toBe('bad');
  });
  it('defaults to info for unknown / conflict / other', () => {
    expect(provenanceClass('conflict')).toBe('info');
    expect(provenanceClass('unknown')).toBe('info');
  });
});

describe('QUALITY_STATES', () => {
  it('lists all five states, frozen', () => {
    expect(QUALITY_STATES).toEqual(['ok', 'partial', 'missing', 'stale', 'conflict']);
    expect(Object.isFrozen(QUALITY_STATES)).toBe(true);
  });
});
