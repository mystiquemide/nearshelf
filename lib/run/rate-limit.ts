// In-memory sliding window per instance. Serverless instances don't share it,
// so this caps abuse per warm instance, not globally (see DEC-003).
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  return {
    take(key: string): boolean {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((h) => t - h < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(t);
      hits.set(key, recent);
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.every((h) => t - h >= windowMs)) hits.delete(k);
      return true;
    },
  };
}
