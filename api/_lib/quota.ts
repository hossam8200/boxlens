// Quota manager: enforces per-provider free-tier call budgets with a sliding
// window. In-memory by default; Upstash Redis when env vars are set. The
// remaining budget is exposed to the UI via /api/v1/health.
export interface QuotaStore {
  /** Increment the counter for `key` in the current window; return the new count. */
  incrAndGet(key: string, windowSec: number): Promise<number>;
  /** Current count in the window (without incrementing). */
  current(key: string, windowSec: number): Promise<number>;
}

class InMemoryQuota implements QuotaStore {
  private hits = new Map<string, number[]>();
  private prune(key: string, windowSec: number, now: number): number[] {
    const cutoff = now - windowSec * 1000;
    const arr = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    this.hits.set(key, arr);
    return arr;
  }
  async incrAndGet(key: string, windowSec: number): Promise<number> {
    const now = Date.now();
    const arr = this.prune(key, windowSec, now);
    arr.push(now);
    this.hits.set(key, arr);
    return arr.length;
  }
  async current(key: string, windowSec: number): Promise<number> {
    return this.prune(key, windowSec, Date.now()).length;
  }
}

async function createUpstashQuota(): Promise<QuotaStore | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const mod = await import('@upstash/redis');
  const redis = new mod.Redis({ url, token });
  return {
    async incrAndGet(key: string, windowSec: number): Promise<number> {
      const k = `quota:${key}`;
      const count = await redis.incr(k);
      if (count === 1) await redis.expire(k, windowSec);
      return count;
    },
    async current(key: string): Promise<number> {
      const v = await redis.get<number>(`quota:${key}`);
      return v ?? 0;
    },
  };
}

let qPromise: Promise<QuotaStore> | null = null;
export function getQuota(): Promise<QuotaStore> {
  if (!qPromise) {
    qPromise = (async () => (await createUpstashQuota()) ?? new InMemoryQuota())();
  }
  return qPromise;
}

export interface ProviderLimit {
  limit: number;
  windowSec: number;
}

/**
 * Documented free-tier limits per provider (see DATA_SOURCES.md). Conservative
 * values that keep us well under each provider's published ceiling.
 */
export const PROVIDER_LIMITS: Record<string, ProviderLimit> = {
  'open-meteo': { limit: 9000, windowSec: 86_400 },
  'nager-date': { limit: 1000, windowSec: 86_400 },
  frankfurter: { limit: 1000, windowSec: 86_400 },
  'world-bank': { limit: 4000, windowSec: 86_400 },
  eonet: { limit: 2000, windowSec: 86_400 },
  usgs: { limit: 2000, windowSec: 86_400 },
  aisstream: { limit: 200, windowSec: 86_400 },
  imf: { limit: 0, windowSec: 86_400 }, // no free API -> always blocked
};

export interface QuotaCheck {
  allowed: boolean;
  used: number;
  limit: number;
  windowSec: number;
}

/** Pure: is a call allowed given current usage and the provider limit? */
export function isAllowed(used: number, limit: number): boolean {
  return limit > 0 && used <= limit;
}

/** Check + increment the budget for a provider. Returns whether the call is allowed. */
export async function checkAndIncrement(provider: string): Promise<QuotaCheck> {
  const cfg = PROVIDER_LIMITS[provider] ?? { limit: 1000, windowSec: 86_400 };
  const quota = await getQuota();
  if (cfg.limit === 0) {
    return { allowed: false, used: await quota.current(provider, cfg.windowSec), limit: 0, windowSec: cfg.windowSec };
  }
  const used = await quota.incrAndGet(provider, cfg.windowSec);
  return { allowed: isAllowed(used, cfg.limit), used, limit: cfg.limit, windowSec: cfg.windowSec };
}

/** Snapshot of all providers' current usage (for /api/v1/health). */
export async function quotaSnapshot(): Promise<
  { provider: string; used: number; limit: number; windowSec: number }[]
> {
  const quota = await getQuota();
  const out: { provider: string; used: number; limit: number; windowSec: number }[] = [];
  for (const [provider, cfg] of Object.entries(PROVIDER_LIMITS)) {
    out.push({
      provider,
      used: await quota.current(provider, cfg.windowSec),
      limit: cfg.limit,
      windowSec: cfg.windowSec,
    });
  }
  return out;
}
