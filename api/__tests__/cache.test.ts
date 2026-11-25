import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getOrFetch } from '../_lib/cache';

describe('cache getOrFetch', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000_000 });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches when missing and stores fresh', async () => {
    const fetcher = vi.fn(async () => 'v1');
    const r = await getOrFetch('c1', 100, fetcher);
    expect(r.value).toBe('v1');
    expect(r.stale).toBe(false);
    expect(r.ttl).toBe(100);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('serves a fresh cached value without refetching', async () => {
    const fetcher = vi.fn(async () => 'v1');
    await getOrFetch('c2', 100, fetcher);
    vi.advanceTimersByTime(50_000); // within ttl
    const r = await getOrFetch('c2', 100, fetcher);
    expect(r.value).toBe('v1');
    expect(r.stale).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('revalidates when the entry is past its logical ttl', async () => {
    const fetcher = vi.fn(async () => 'v1');
    await getOrFetch('c3', 100, fetcher);
    vi.advanceTimersByTime(200_000); // past ttl(100), within storage ttl(400)
    fetcher.mockResolvedValue('v2');
    const r = await getOrFetch('c3', 100, fetcher);
    expect(r.value).toBe('v2');
    expect(r.stale).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('serves the stale value (stale=true) when revalidation throws', async () => {
    const fetcher = vi.fn(async () => 'v1');
    await getOrFetch('c4', 100, fetcher);
    vi.advanceTimersByTime(200_000);
    fetcher.mockRejectedValue(new Error('upstream down'));
    const r = await getOrFetch('c4', 100, fetcher);
    expect(r.value).toBe('v1');
    expect(r.stale).toBe(true);
  });
});
