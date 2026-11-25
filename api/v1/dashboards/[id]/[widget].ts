// GET /api/v1/dashboards/:id/:widget — a single widget payload with provenance.
import type { VercelRequest, VercelResponse } from '../../../_lib/vercel.js';
import { jsonOk, rfc7807, qp } from '../../../_lib/http.js';
import { resolveWidget } from '../../../_lib/widgets.js';
import type { DashboardId } from '../../../../app/src/dashboards/framework/types.js';

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
  const widget = qp(req, 'widget');
  if (!id || !KNOWN.has(id) || !widget) {
    rfc7807(res, 404, 'Unknown widget', `Widget "${widget ?? ''}" on "${id ?? ''}" is not registered.`);
    return;
  }
  const filters = {
    port: qp(req, 'port'),
    country: qp(req, 'country'),
  };
  // The resolver never throws — it returns a degraded payload on any failure so
  // the client always renders an honest badge instead of an empty chart.
  const payload = await resolveWidget(id, widget, filters);
  jsonOk(res, payload);
}
