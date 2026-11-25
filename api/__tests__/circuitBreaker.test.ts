import { describe, it, expect } from 'vitest';
import { CircuitBreaker } from '../_lib/circuitBreaker';

describe('CircuitBreaker', () => {
  it('starts closed and allows requests', () => {
    const b = new CircuitBreaker(3, 1000);
    expect(b.getState()).toBe('closed');
    expect(b.canRequest(0)).toBe(true);
  });

  it('opens after the threshold of consecutive failures', () => {
    const b = new CircuitBreaker(3, 1000);
    b.recordFailure(0);
    b.recordFailure(0);
    b.recordFailure(0);
    expect(b.getState()).toBe('open');
    expect(b.canRequest(100)).toBe(false);
  });

  it('moves to half-open and allows a probe after the reset window', () => {
    const b = new CircuitBreaker(3, 1000);
    b.recordFailure(0);
    b.recordFailure(0);
    b.recordFailure(0);
    expect(b.getState()).toBe('open');
    expect(b.canRequest(2000)).toBe(true); // half-open probe
    expect(b.getState()).toBe('half-open');
  });

  it('closes on a successful probe', () => {
    const b = new CircuitBreaker(3, 1000);
    b.recordFailure(0);
    b.recordFailure(0);
    b.recordFailure(0);
    b.canRequest(2000); // probe
    b.recordSuccess();
    expect(b.getState()).toBe('closed');
  });

  it('re-opens immediately if a half-open probe fails', () => {
    const b = new CircuitBreaker(3, 1000);
    b.recordFailure(0);
    b.recordFailure(0);
    b.recordFailure(0);
    b.canRequest(2000); // half-open
    b.recordFailure(2000);
    expect(b.getState()).toBe('open');
  });

  it('success resets the failure counter while closed', () => {
    const b = new CircuitBreaker(3, 1000);
    b.recordFailure(0);
    b.recordFailure(0);
    b.recordSuccess();
    b.recordFailure(0); // only one failure now
    expect(b.getState()).toBe('closed');
  });
});
