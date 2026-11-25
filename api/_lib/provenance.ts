// Provenance builder (server side). Stamps every payload with source, fetchedAt,
// ttl, stale and data-class — the contract the client renders as a badge.
import type { Provenance, DataClass } from '../../app/src/dashboards/framework/types.js';

export function buildProvenance(opts: {
  source: string;
  class: DataClass;
  ttl: number;
  stale?: boolean;
  method?: string;
  attribution?: string;
}): Provenance {
  return {
    source: opts.source,
    fetchedAt: new Date().toISOString(),
    ttl: opts.ttl,
    stale: opts.stale ?? false,
    class: opts.class,
    method: opts.method,
    attribution: opts.attribution,
  };
}
