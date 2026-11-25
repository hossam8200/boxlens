// Per-provider circuit breaker. After `threshold` consecutive failures it opens
// for `resetMs`, fast-failing further calls (so the cache can serve stale) until
// a half-open probe succeeds. Pure logic — unit-tested.
export type BreakerState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private failures = 0;
  private state: BreakerState = 'closed';
  private openedAt = 0;

  constructor(
    private readonly threshold: number = 5,
    private readonly resetMs: number = 30_000,
  ) {}

  /** May a call proceed? If open and the reset window has elapsed, move to half-open. */
  canRequest(now: number = Date.now()): boolean {
    if (this.state === 'open') {
      if (now - this.openedAt >= this.resetMs) {
        this.state = 'half-open';
        return true; // allow a single probe
      }
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure(now: number = Date.now()): void {
    this.failures += 1;
    if (this.state === 'half-open' || this.failures >= this.threshold) {
      this.state = 'open';
      this.openedAt = now;
    }
  }

  getState(): BreakerState {
    return this.state;
  }
}

const breakers = new Map<string, CircuitBreaker>();

export function getBreaker(provider: string): CircuitBreaker {
  let b = breakers.get(provider);
  if (!b) {
    b = new CircuitBreaker();
    breakers.set(provider, b);
  }
  return b;
}
