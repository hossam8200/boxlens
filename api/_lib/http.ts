// HTTP helpers: Zod input validation, RFC 7807 problem+json errors, JSON OK,
// and a timeout racer for provider adapters. No external calls here.
import type { ZodSchema, ZodError } from 'zod';
import type { VercelRequest, VercelResponse } from './vercel.js';

/** Send a 200 JSON response. */
export function jsonOk(res: VercelResponse, body: unknown): void {
  res.status(200).setHeader('content-type', 'application/json; charset=utf-8');
  res.json(body);
}

/**
 * Send an RFC 7807 (application/problem+json) error. Every API failure uses
 * this shape so clients can parse a consistent contract.
 */
export function rfc7807(
  res: VercelResponse,
  status: number,
  title: string,
  detail: string,
  extra: Record<string, unknown> = {},
): void {
  res.status(status).setHeader('content-type', 'application/problem+json; charset=utf-8');
  res.json({
    type: `https://boxlens.example/problems/${kebab(title)}`,
    title,
    status,
    detail,
    ...extra,
  });
}

/** Validate `data` against a Zod schema; return a discriminated result. */
export function validateWith<T>(
  schema: ZodSchema<T>,
  data: unknown,
):
  | { ok: true; value: T }
  | { ok: false; error: ZodError } {
  const parsed = schema.safeParse(data);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, error: parsed.error };
}

/** Read a query param as a single string (Vercel may give string | string[]). */
export function qp(req: VercelRequest, name: string): string | undefined {
  const v = req.query?.[name];
  if (Array.isArray(v)) return v[0];
  return v;
}

/** Race a promise against a timeout; rejects with 'timeout' after `ms`. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function kebab(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
