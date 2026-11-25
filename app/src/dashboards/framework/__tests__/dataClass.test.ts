import { describe, it, expect } from 'vitest';
import { DATA_CLASSES, dataClassMeta, requiresMethod, isNonAuthoritative } from '../dataClass';

describe('dataClass', () => {
  it('exposes all six classes', () => {
    expect(DATA_CLASSES).toEqual(['LIVE', 'DAILY', 'ANNUAL', 'ESTIMATE', 'SAMPLE', 'UNAVAILABLE']);
  });

  it('returns metadata for each class', () => {
    expect(dataClassMeta('ESTIMATE').label).toBe('ESTIMATE');
    expect(dataClassMeta('UNAVAILABLE').cls).toBe('dc-unavailable');
    expect(dataClassMeta('LIVE').color).toMatch(/^#/);
  });

  it('marks ESTIMATE and UNAVAILABLE as method-requiring', () => {
    expect(requiresMethod('ESTIMATE')).toBe(true);
    expect(requiresMethod('UNAVAILABLE')).toBe(true);
    expect(requiresMethod('LIVE')).toBe(false);
    expect(requiresMethod('SAMPLE')).toBe(false);
  });

  it('flags non-authoritative classes', () => {
    expect(isNonAuthoritative('ESTIMATE')).toBe(true);
    expect(isNonAuthoritative('SAMPLE')).toBe(true);
    expect(isNonAuthoritative('UNAVAILABLE')).toBe(true);
    expect(isNonAuthoritative('LIVE')).toBe(false);
    expect(isNonAuthoritative('DAILY')).toBe(false);
  });
});
