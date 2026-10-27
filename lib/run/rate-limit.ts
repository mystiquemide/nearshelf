// In-memory sliding window per instance. Serverless instances don't share it,
// so this caps abuse per warm instance, not globally.
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

// One budget shared by every route that spends Qloo or LLM quota: 20 runs per 10 minutes per IP.
export const sharedLimiter = createRateLimiter(20, 10 * 60 * 1000);

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
