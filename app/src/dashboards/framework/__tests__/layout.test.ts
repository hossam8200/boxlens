import { describe, it, expect } from 'vitest';
import { mergeLayout, orderedVisible, importLayout, exportLayout } from '../layout';

describe('mergeLayout', () => {
  it('applies saved entries and fills defaults', () => {
    const merged = mergeLayout(['a', 'b', 'c'], { b: { hidden: true, order: 0 } });
    expect(merged.a).toEqual({ hidden: false, order: 0 });
    expect(merged.b).toEqual({ hidden: true, order: 0 });
    expect(merged.c).toEqual({ hidden: false, order: 2 });
  });
});

describe('orderedVisible', () => {
  it('drops hidden and sorts by order', () => {
    const ids = ['a', 'b', 'c'];
    const layout = {
      a: { hidden: false, order: 2 },
      b: { hidden: true, order: 0 },
      c: { hidden: false, order: 1 },
    };
    expect(orderedVisible(ids, layout)).toEqual(['c', 'a']);
  });
  it('keeps natural order when no layout', () => {
    expect(orderedVisible(['a', 'b'], {})).toEqual(['a', 'b']);
  });
});

describe('importLayout / exportLayout', () => {
  it('round-trips a layout', () => {
    const state = { a: { hidden: true, order: 5 } };
    const json = exportLayout(state);
    expect(importLayout(json)).toEqual(state);
  });
  it('rejects bad JSON', () => {
    expect(importLayout('not json')).toEqual({});
  });
  it('rejects non-object JSON', () => {
    expect(importLayout('[]')).toEqual({});
    expect(importLayout('"x"')).toEqual({});
  });
  it('ignores malformed entries', () => {
    const out = importLayout('{"a":{"hidden":true,"order":3},"b":"bad"}');
    expect(out).toEqual({ a: { hidden: true, order: 3 } });
  });
});
