// Stale-while-revalidate cache with an in-memory store and an optional Upstash
// Redis adapter (used only when UPSTASH_REDIS_REST_URL + TOKEN are set). On a
// fetch error during revalidation, the last good value is served with stale=true
// so the UI always shows something with an honest age.
export interface CacheEntry<T> {
  value: T;
  fetchedAt: number;
  ttl: number;
}

export interface SwrResult<T> {
  value: T;
  fetchedAt: number;
  ttl: number;
  stale: boolean;
}

export interface KVStore {
  get(key: string): Promise<string | null>;
  setex(key: string, ttlSec: number, value: string): Promise<void>;
}

// ---- In-memory store (default; always available on the free tier) ----
class InMemoryKV implements KVStore {
  private map = new Map<string, { val: string; expires: number }>();
  async get(key: string): Promise<string | null> {
    const e = this.map.get(key);
    if (!e) return null;
    if (Date.now() > e.expires) {
      this.map.delete(key);
      return null;
    }
    return e.val;
  }
  async setex(key: string, ttlSec: number, value: string): Promise<void> {
    this.map.set(key, { val: value, expires: Date.now() + ttlSec * 1000 });
  }
}

// ---- Upstash Redis adapter (optional; needs env vars) ----
async function createUpstashKv(): Promise<KVStore | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const mod = await import('@upstash/redis');
  const redis = new mod.Redis({ url, token });
  return {
    async get(key: string): Promise<string | null> {
      return (await redis.get<string>(key)) ?? null;
    },
    async setex(key: string, ttlSec: number, value: string): Promise<void> {
      await redis.set(key, value, { ex: ttlSec });
    },
  };
}

let kvPromise: Promise<KVStore> | null = null;
export function getKv(): Promise<KVStore> {
  if (!kvPromise) {
    kvPromise = (async () => (await createUpstashKv()) ?? new InMemoryKV())();
  }
  return kvPromise;
}

/** Storage TTL is longer than the logical TTL so stale entries persist for
 *  revalidation (the badge age/ttl use the logical ttl; the store keeps the
 *  value around past it so we can serve stale on a fetch error). */
const STALE_FACTOR = 4;
const minStorageTtl = (ttlSec: number) => Math.max(60, ttlSec * STALE_FACTOR);

/**
 * Get a value from the cache or fetch+store it. Semantics:
 *  - not cached        -> await fetcher, store, return fresh (stale=false)
 *  - cached & fresh    -> return cached (stale=false)
 *  - cached & stale    -> try to revalidate; on success return fresh; on fetch
 *                         error return the stale value with stale=true
 */
export async function getOrFetch<T>(
  key: string,
  ttlSec: number,
  fetcher: () => Promise<T>,
): Promise<SwrResult<T>> {
  const kv = await getKv();
  const raw = await kv.get(key);
  const now = Date.now();
  if (raw) {
    try {
      const entry = JSON.parse(raw) as CacheEntry<T>;
      const ageSec = (now - entry.fetchedAt) / 1000;
      if (ageSec < ttlSec) {
        return { value: entry.value, fetchedAt: entry.fetchedAt, ttl: ttlSec, stale: false };
      }
      // stale -> revalidate; fall back to stale on error
      try {
        const value = await fetcher();
        const fresh: CacheEntry<T> = { value, fetchedAt: Date.now(), ttl: ttlSec };
        await kv.setex(key, minStorageTtl(ttlSec), JSON.stringify(fresh));
        return { value, fetchedAt: fresh.fetchedAt, ttl: ttlSec, stale: false };
      } catch {
        return { value: entry.value, fetchedAt: entry.fetchedAt, ttl: ttlSec, stale: true };
      }
    } catch {
      // corrupt cache entry -> fall through to fetch
    }
  }
  const value = await fetcher();
  const entry: CacheEntry<T> = { value, fetchedAt: Date.now(), ttl: ttlSec };
  await kv.setex(key, minStorageTtl(ttlSec), JSON.stringify(entry));
  return { value, fetchedAt: entry.fetchedAt, ttl: ttlSec, stale: false };
}
