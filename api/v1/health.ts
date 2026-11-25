// GET /api/v1/health — platform health + free-tier budget snapshot.
// Drives the Executive Overview "free-tier budget used %" KPI and the
// "providers healthy n/total" KPI, plus the Platform Health dashboard.
import type { VercelRequest, VercelResponse } from '../_lib/vercel.js';
import { jsonOk } from '../_lib/http.js';
import { quotaSnapshot } from '../_lib/quota.js';

export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<void> {
  const providers = (await quotaSnapshot()).map((p) => ({
    provider: p.provider,
    used: p.used,
    limit: p.limit,
    windowSec: p.windowSec,
    healthy: p.limit > 0 && p.used < p.limit,
  }));
  let usedSum = 0;
  let limitSum = 0;
  for (const p of providers) {
    usedSum += p.used;
    limitSum += p.limit;
  }
  const budgetUsedPct = limitSum === 0 ? 0 : Math.min(100, Math.round((usedSum / limitSum) * 100));
  const anyDown = providers.some((p) => !p.healthy);
  jsonOk(res, {
    status: anyDown ? 'degraded' : 'ok',
    time: new Date().toISOString(),
    budgetUsedPct,
    providers,
  });
}
