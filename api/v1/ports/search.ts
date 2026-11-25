// GET /api/v1/ports/search?q=<text> — searchable UN/LOCODE port directory.
//
// Backed by api/_data/seaports.json, generated from the real UNECE UN/LOCODE
// code list (every entry whose Function field flags a port — ~17.5k sea/river/
// lake ports worldwide). The dashboard filter bar calls this debounced from the
// Port autocomplete so users can find any real port, not just the curated 46.
//
// Response: { source, total, items: [{ value, label, country }] } with up to 50
// substring matches (case-insensitive, on name OR UN/LOCODE code). Responses are
// CDN-cached — the underlying registry is static.
import type { VercelRequest, VercelResponse } from '../../_lib/vercel.js';
import { jsonOk, rfc7807, qp } from '../../_lib/http.js';
import SEAPORTS from '../../_data/seaports.json' with { type: 'json' };

type PortTuple = [string, string, string]; // [code, name, country]

const MAX = 50;

// Precompute a lowercased search haystack once per cold start so each request
// is a cheap linear scan over ~17.5k entries (a few ms warm).
const INDEX: { code: string; name: string; country: string; lc: string }[] = (SEAPORTS as PortTuple[]).map(
  ([code, name, country]) => ({
    code,
    name,
    country,
    lc: `${name} ${code}`.toLowerCase(),
  }),
);

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if ((req.method ?? 'GET') !== 'GET') {
    rfc7807(res, 405, 'Method not allowed', `Use GET.`);
    return;
  }
  const raw = qp(req, 'q') ?? '';
  const q = raw.trim().toLowerCase();

  // CDN-cache the static registry lookups (immutable input → immutable output).
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800');

  if (!q) {
    jsonOk(res, { source: 'UN/LOCODE (UNECE)', total: 0, items: [] });
    return;
  }

  const items: { value: string; label: string; country: string }[] = [];
  for (const p of INDEX) {
    if (p.lc.includes(q)) {
      items.push({ value: p.code, label: `${p.name} (${p.code})`, country: p.country });
      if (items.length >= MAX) break;
    }
  }
  jsonOk(res, { source: 'UN/LOCODE (UNECE)', total: items.length, truncated: items.length === MAX, items });
}
