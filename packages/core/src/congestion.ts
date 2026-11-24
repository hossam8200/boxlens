// Port congestion score. Pure.

export interface PortVessel {
  queue: number;
  status: string;
}

/**
 * Congestion score 0-100 for a port's vessel set. Formula (documented in
 * Methodology): queue-length * 8 + waiting-vessel-count * 15, capped at 100.
 */
export function score(vessels: ReadonlyArray<PortVessel>): number {
  const queue = vessels.reduce((a, x) => a + x.queue, 0);
  const waiting = vessels.filter((x) => x.status === 'waiting').length;
  return Math.min(100, queue * 8 + waiting * 15);
}
