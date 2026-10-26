import "server-only";
import { createTtlCache, type TtlCache } from "./cache";
import { toBook, type Book } from "./types";

const BASE_URL = "https://hackathon.api.qloo.com";
const TIMEOUT_MS = 10_000;
const CACHE_TTL_S = 24 * 60 * 60;

// Private server-side caching is allowed by Qloo's hackathon terms. Response data never
// leaves the server. This instance cache is shared by every client in the process.
const sharedCache = createTtlCache<unknown>({ max: 500, ttlMs: CACHE_TTL_S * 1000 });

export type QlooErrorKind = "config" | "unauthorized" | "forbidden" | "rate_limited" | "bad_request" | "upstream" | "timeout" | "network";

export class QlooError extends Error {
  constructor(
    readonly kind: QlooErrorKind,
    message: string,
    readonly status?: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "QlooError";
  }

  get retryable() {
    return this.kind === "rate_limited" || this.kind === "upstream" || this.kind === "timeout" || this.kind === "network";
  }
}

export type Fetcher = typeof fetch;

export interface QlooClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetcher?: Fetcher;
  timeoutMs?: number;
  cache?: TtlCache<unknown> | null;
}

export interface InsightsParams {
  seedIds: string[];
  publicationYearMin?: number;
  popularityMax?: number;
  explainability?: boolean;
  take?: number;
}

export interface InsightsResult {
  books: Book[];
  explainability: unknown;
}

function kindForStatus(status: number): QlooErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "upstream";
  return "bad_request";
}

export function createQlooClient(options: QlooClientOptions = {}) {
  const apiKey = options.apiKey ?? process.env.QLOO_API_KEY;
  const baseUrl = options.baseUrl ?? BASE_URL;
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const cache = options.cache === undefined ? sharedCache : options.cache;

  async function attempt(url: string): Promise<unknown> {
    let res: Response;
    try {
      res = await fetcher(url, {
        method: "GET",
        headers: { "X-Api-Key": apiKey!, Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
        // Next's data cache shares successful GETs across serverless instances.
        next: { revalidate: CACHE_TTL_S },
      } as RequestInit);
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      throw new QlooError(timedOut ? "timeout" : "network", timedOut ? "Qloo took too long to respond" : "Couldn't reach Qloo", undefined, { cause: err });
    }
    if (!res.ok) throw new QlooError(kindForStatus(res.status), `Qloo returned ${res.status}`, res.status);
    try {
      return await res.json();
    } catch (err) {
      throw new QlooError("upstream", "Qloo returned a response that isn't JSON", res.status, { cause: err });
    }
  }

  // One retry on 5xx only. Timeouts and 4xx are not retried so a run stays inside its time budget.
  async function get(path: string, params: Record<string, string>): Promise<unknown> {
    if (!apiKey) throw new QlooError("config", "QLOO_API_KEY is not set");
    const url = `${baseUrl}${path}?${new URLSearchParams(params)}`;
    const load = async () => {
      try {
        return await attempt(url);
      } catch (err) {
        if (err instanceof QlooError && err.kind === "upstream" && err.status !== undefined) return attempt(url);
        throw err;
      }
    };
    if (!cache) return load();
    const key = `${path}?${new URLSearchParams(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)))}`;
    return cache.get(key, load);
  }

  return {
    async searchBooks(query: string, take = 5): Promise<Book[]> {
      const body = await get("/search", { query, types: "urn:entity:book", take: String(take) });
      return entitiesOf(body).map(toBook).filter((b): b is Book => b !== null);
    },

    async bookInsights(p: InsightsParams): Promise<InsightsResult> {
      if (p.seedIds.length === 0) throw new QlooError("bad_request", "At least one resolved seed is required");
      const params: Record<string, string> = {
        "filter.type": "urn:entity:book",
        "signal.interests.entities": p.seedIds.join(","),
        take: String(p.take ?? 30),
      };
      if (p.publicationYearMin !== undefined) params["filter.publication_year.min"] = String(p.publicationYearMin);
      if (p.popularityMax !== undefined) params["filter.popularity.max"] = String(p.popularityMax);
      if (p.explainability) params["feature.explainability"] = "true";
      const body = await get("/v2/insights", params);
      return {
        books: entitiesOf(body).map(toBook).filter((b): b is Book => b !== null),
        explainability: (body as { query?: { explainability?: unknown } })?.query?.explainability ?? null,
      };
    },

    // Taste beyond books: what readers of the given books also like in another domain.
    async crossDomainInsights(type: CrossDomainType, seedIds: string[], take = 5): Promise<NamedEntity[]> {
      if (seedIds.length === 0) throw new QlooError("bad_request", "At least one seed is required");
      const body = await get("/v2/insights", { "filter.type": type, "signal.interests.entities": seedIds.join(","), take: String(take) });
      return entitiesOf(body).flatMap((e) => {
        const r = e as { entity_id?: unknown; id?: unknown; name?: unknown };
        const id = typeof r.entity_id === "string" ? r.entity_id : typeof r.id === "string" ? r.id : null;
        return id && typeof r.name === "string" && r.name.trim() ? [{ id, name: r.name.trim() }] : [];
      });
    },
  };
}

export type CrossDomainType = "urn:entity:podcast" | "urn:entity:tv_show" | "urn:entity:artist";

export interface NamedEntity {
  id: string;
  name: string;
}

export type QlooClient = ReturnType<typeof createQlooClient>;

function entitiesOf(body: unknown): unknown[] {
  const b = body as { results?: unknown; entities?: unknown } | null;
  const results = b?.results as { entities?: unknown } | unknown[] | undefined;
  if (Array.isArray(results)) return results;
  if (results && Array.isArray(results.entities)) return results.entities;
  if (Array.isArray(b?.entities)) return b.entities;
  return [];
}
