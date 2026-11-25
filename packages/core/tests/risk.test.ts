import { describe, it, expect } from 'vitest';
import {
  weatherRisk,
  visibilityPenalty,
  holidayBump,
  congestionContribution,
  operationalRisk,
  riskBucket,
} from '../src/risk';

describe('weatherRisk', () => {
  it('is 0 in calm weather', () => {
    expect(weatherRisk({ windKnots: 0, waveM: 0, swellM: 0 })).toBe(0);
  });
  it('caps wind contribution at 50', () => {
    expect(weatherRisk({ windKnots: 40, waveM: 0, swellM: 0 })).toBe(50);
  });
  it('caps wave at 30 and swell at 20', () => {
    expect(weatherRisk({ windKnots: 0, waveM: 5, swellM: 10 })).toBe(50);
  });
  it('sums sub-scores and caps at 100', () => {
    expect(weatherRisk({ windKnots: 25, waveM: 2, swellM: 4 })).toBe(100);
  });
});

describe('visibilityPenalty', () => {
  it('is 30 in fog (< 1 km)', () => {
    expect(visibilityPenalty(0.5)).toBe(30);
  });
  it('is 0 above 10 km', () => {
    expect(visibilityPenalty(15)).toBe(0);
  });
  it('scales linearly between', () => {
    // 5 km -> 30 - (5/10)*30 = 15
    expect(visibilityPenalty(5)).toBe(15);
  });
  it('treats invalid as max penalty', () => {
    expect(visibilityPenalty(-1)).toBe(30);
    expect(visibilityPenalty(Number.NaN)).toBe(30);
  });
});

describe('holidayBump', () => {
  it('adds 15 on a holiday', () => {
    expect(holidayBump(true)).toBe(15);
  });
  it('adds 0 otherwise', () => {
    expect(holidayBump(false)).toBe(0);
  });
});

describe('congestionContribution', () => {
  it('compresses the 0–100 congestion score into 0–30', () => {
    expect(congestionContribution([])).toBe(0);
    // queue 10, no waiting -> congestion score = 80 -> 24
    expect(congestionContribution([{ queue: 10, status: 'berthed' }])).toBe(24);
    // saturation
    expect(congestionContribution([{ queue: 20, status: 'waiting' }])).toBe(30);
  });
});

describe('operationalRisk', () => {
  it('is low in calm clear uncongested non-holiday conditions', () => {
    expect(
      operationalRisk({
        windKnots: 5,
        waveM: 0.3,
        swellM: 0,
        visibilityKm: 12,
        vessels: [],
        isHoliday: false,
      }),
    ).toBeLessThan(34);
  });
  it('clamps at 100 in a storm with fog, congestion and a holiday', () => {
    expect(
      operationalRisk({
        windKnots: 35,
        waveM: 5,
        swellM: 8,
        visibilityKm: 0.3,
        vessels: [{ queue: 20, status: 'waiting' }, { queue: 5, status: 'waiting' }],
        isHoliday: true,
      }),
    ).toBe(100);
  });
  it('is deterministic (pure)', () => {
    const input = {
      windKnots: 15,
      waveM: 1.5,
      swellM: 1,
      visibilityKm: 4,
      vessels: [{ queue: 3, status: 'waiting' }],
      isHoliday: true,
    };
    expect(operationalRisk(input)).toBe(operationalRisk(input));
  });
});

describe('riskBucket', () => {
  it('thresholds match the gauge colour convention', () => {
    expect(riskBucket(10)).toBe('low');
    expect(riskBucket(33)).toBe('low');
    expect(riskBucket(34)).toBe('medium');
    expect(riskBucket(66)).toBe('medium');
    expect(riskBucket(67)).toBe('high');
    expect(riskBucket(100)).toBe('high');
  });
});
