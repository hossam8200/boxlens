// Quota client: reads the free-tier budget from /api/v1/health and exposes it
// to the UI (Executive Overview "free-tier budget used %", Platform Health).
import type { HealthPayload, ProviderBudget } from './types';
import { fetchHealth } from './api';

export async function fetchBudget(): Promise<HealthPayload | null> {
  return fetchHealth<HealthPayload>();
}

/** Overall budget used across providers, 0–100 (server computes it; client can recompute as a fallback). */
export function overallUsedPct(h: HealthPayload | null): number {
  if (!h) return 0;
  if (typeof h.budgetUsedPct === 'number') return h.budgetUsedPct;
  const providers = h.providers ?? [];
  if (providers.length === 0) return 0;
  let usedSum = 0;
  let limitSum = 0;
  for (const p of providers) {
    usedSum += p.used;
    limitSum += p.limit;
  }
  if (limitSum === 0) return 0;
  return Math.min(100, Math.round((usedSum / limitSum) * 100));
}

/** Providers currently unhealthy (drives the "providers healthy n/total" KPI). */
export function healthyProviders(h: HealthPayload | null): { healthy: number; total: number } {
  if (!h) return { healthy: 0, total: 0 };
  const providers: ProviderBudget[] = h.providers ?? [];
  const total = providers.length;
  const healthy = providers.filter((p) => p.healthy).length;
  return { healthy, total };
}
