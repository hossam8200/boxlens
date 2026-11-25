// GET /api/v1/dashboards/:id — all widget payloads for a dashboard.
import type { VercelRequest, VercelResponse } from '../../_lib/vercel.js';
import { jsonOk, rfc7807, qp } from '../../_lib/http.js';
import { resolveDashboard, WIDGET_IDS_BY_DASHBOARD } from '../../_lib/widgets.js';
import type { DashboardId } from '../../../app/src/dashboards/framework/types.js';

const KNOWN = new Set<DashboardId>([
  'executive',
  'compliance',
  'weather',
  'chokepoints',
  'trade',
  'cost',
  'vessel',
  'health',
]);

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if ((req.method ?? 'GET') !== 'GET') {
    rfc7807(res, 405, 'Method not allowed', `Use GET.`);
    return;
  }
  const id = qp(req, 'id') as DashboardId | undefined;
  if (!id || !KNOWN.has(id)) {
    rfc7807(res, 404, 'Unknown dashboard', `Dashboard "${id ?? ''}" is not registered.`);
    return;
  }
  const filters = {
    port: qp(req, 'port'),
    country: qp(req, 'country'),
  };
  const widgetIds = WIDGET_IDS_BY_DASHBOARD[id];
  const out = await resolveDashboard(id, widgetIds, filters);
  jsonOk(res, out);
}
