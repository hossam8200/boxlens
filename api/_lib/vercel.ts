// Minimal Vercel Node serverless-function types.
// Avoids a hard dependency on @vercel/node just for type-checking; the runtime
// passes the real IncomingMessage / ServerResponse, which match this shape.
export interface VercelRequest {
  method?: string;
  url?: string;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface VercelResponse {
  status(code: number): this;
  setHeader(name: string, value: string | string[]): this;
  json(body: unknown): void;
  end(body?: string | Buffer): void;
}

export type Handler = (req: VercelRequest, res: VercelResponse) => void | Promise<void>;
