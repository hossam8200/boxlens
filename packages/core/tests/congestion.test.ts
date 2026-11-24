import { describe, expect, it } from 'vitest';
import { score } from '../src/congestion';

describe('congestion.score', () => {
  it('returns 0 for an empty port', () => {
    expect(score([])).toBe(0);
  });
  it('returns 0 when no queue and no waiting vessels', () => {
    expect(score([{ queue: 0, status: 'alongside' }])).toBe(0);
    expect(score([{ queue: 0, status: 'approaching' }])).toBe(0);
  });
  it('combines queue*8 + waiting*15', () => {
    expect(score([{ queue: 5, status: 'waiting' }])).toBe(5 * 8 + 1 * 15); // 55
  });
  it('counts only waiting vessels toward the waiting term', () => {
    expect(
      score([
        { queue: 0, status: 'waiting' },
        { queue: 0, status: 'waiting' },
        { queue: 0, status: 'approaching' },
      ]),
    ).toBe(2 * 15); // 30
  });
  it('caps at 100', () => {
    expect(
      score([
        { queue: 10, status: 'waiting' },
        { queue: 5, status: 'approaching' },
      ]),
    ).toBe(100); // 15*8 + 1*15 = 135 -> 100
  });
  it('sums queue across all vessels regardless of status', () => {
    expect(
      score([
        { queue: 4, status: 'alongside' },
        { queue: 3, status: 'approaching' },
      ]),
    ).toBe(7 * 8); // 56, no waiting
  });
});
