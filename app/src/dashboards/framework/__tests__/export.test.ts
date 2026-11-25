import { describe, it, expect } from 'vitest';
import { toCsv } from '../export';

describe('toCsv', () => {
  it('serializes a simple table', () => {
    expect(toCsv([{ a: 1, b: 'x' }])).toBe('a,b\n1,x');
  });

  it('quotes fields with commas', () => {
    expect(toCsv([{ a: 'hi, there' }])).toBe('a\n"hi, there"');
  });

  it('doubles inner quotes', () => {
    expect(toCsv([{ a: 'quote"me' }])).toBe('a\n"quote""me"');
  });

  it('quotes fields with newlines', () => {
    expect(toCsv([{ a: 'line\nbreak' }])).toBe('a\n"line\nbreak"');
  });

  it('renders null as empty', () => {
    expect(toCsv([{ a: null }])).toBe('a\n');
  });

  it('returns empty for no rows', () => {
    expect(toCsv([])).toBe('');
  });

  it('honours an explicit column order', () => {
    expect(toCsv([{ b: 2, a: 1 }], ['a', 'b'])).toBe('a,b\n1,2');
  });

  it('collects columns across rows when not given', () => {
    expect(toCsv([{ a: 1 }, { b: 2 }])).toBe('a,b\n1,\n,2');
  });
});
