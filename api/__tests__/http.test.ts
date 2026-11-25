import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { jsonOk, rfc7807, validateWith, qp, withTimeout } from '../_lib/http';
import type { VercelRequest, VercelResponse } from '../_lib/vercel';

function mockRes(): VercelResponse & {
  _status: () => number;
  _headers: () => Record<string, string>;
  _body: () => unknown;
} {
  let status = 200;
  const headers: Record<string, string> = {};
  let body: unknown = null;
  const res = {
    status(s: number) {
      status = s;
      return this;
    },
    setHeader(k: string, v: string | string[]) {
      headers[k] = Array.isArray(v) ? v.join(',') : v;
      return this;
    },
    json(b: unknown) {
      body = b;
    },
    end() {},
    _status: () => status,
    _headers: () => headers,
    _body: () => body,
  };
  return res as unknown as VercelResponse & {
    _status: () => number;
    _headers: () => Record<string, string>;
    _body: () => unknown;
  };
}

describe('jsonOk', () => {
  it('sets 200 + json content-type + body', () => {
    const res = mockRes();
    jsonOk(res, { hi: 1 });
    expect(res._status()).toBe(200);
    expect(res._headers()['content-type']).toContain('application/json');
    expect(res._body()).toEqual({ hi: 1 });
  });
});

describe('rfc7807', () => {
  it('emits an application/problem+json envelope', () => {
    const res = mockRes();
    rfc7807(res, 404, 'Unknown dashboard', 'No such id', { instance: '/x' });
    expect(res._status()).toBe(404);
    expect(res._headers()['content-type']).toContain('application/problem+json');
    const body = res._body() as Record<string, unknown>;
    expect(body.title).toBe('Unknown dashboard');
    expect(body.status).toBe(404);
    expect(body.detail).toBe('No such id');
    expect(body.type).toMatch(/problems\/unknown-dashboard$/);
    expect(body.instance).toBe('/x');
  });
});

describe('validateWith', () => {
  const schema = z.object({ x: z.number() });
  it('returns ok + value for valid input', () => {
    const r = validateWith(schema, { x: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ x: 1 });
  });
  it('returns error for invalid input', () => {
    const r = validateWith(schema, { x: 'a' });
    expect(r.ok).toBe(false);
  });
});

describe('qp', () => {
  it('reads a string param', () => {
    const req = { query: { a: 'x' } } as unknown as VercelRequest;
    expect(qp(req, 'a')).toBe('x');
  });
  it('reads the first of an array param', () => {
    const req = { query: { b: ['y', 'z'] } } as unknown as VercelRequest;
    expect(qp(req, 'b')).toBe('y');
  });
});

describe('withTimeout', () => {
  it('rejects with "timeout" when the promise is too slow', async () => {
    const slow = new Promise((r) => setTimeout(r, 1000));
    await expect(withTimeout(slow, 30)).rejects.toThrow('timeout');
  });
  it('resolves when the promise beats the timeout', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000)).resolves.toBe('ok');
  });
});
