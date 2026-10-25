import "server-only";

const BASE_URL = "https://openlibrary.org";
const TIMEOUT_MS = 5_000;

export interface OpenLibraryMatch {
  title: string;
  author: string | null;
  firstPublishYear: number | null;
}

export type Fetcher = typeof fetch;

// Open Library is a cross-check only. Any failure returns "unknown" and never blocks a run.
export function createOpenLibraryClient(options: { baseUrl?: string; fetcher?: Fetcher; timeoutMs?: number } = {}) {
  const baseUrl = options.baseUrl ?? BASE_URL;
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;

  return {
    async findBook(title: string): Promise<OpenLibraryMatch | null | "unknown"> {
      const params = new URLSearchParams({ title, limit: "5", fields: "title,author_name,first_publish_year" });
      try {
        const res = await fetcher(`${baseUrl}/search.json?${params}`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) return "unknown";
        const body = (await res.json()) as { docs?: { title?: unknown; author_name?: unknown; first_publish_year?: unknown }[] };
        const doc = body.docs?.find((d) => typeof d.title === "string" && titlesMatch(d.title, title));
        if (!doc) return null;
        return {
          title: doc.title as string,
          author: Array.isArray(doc.author_name) && typeof doc.author_name[0] === "string" ? doc.author_name[0] : null,
          firstPublishYear: typeof doc.first_publish_year === "number" ? doc.first_publish_year : null,
        };
      } catch {
        return "unknown";
      }
    },
  };
}

export type OpenLibraryClient = ReturnType<typeof createOpenLibraryClient>;

export function normalizeTitle(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/^(the|a|an) /, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

// Exact match, or the candidate is the typed title plus a subtitle.
export function titlesMatch(candidate: string, typed: string): boolean {
  const c = normalizeTitle(candidate.split(":")[0] ?? candidate);
  const t = normalizeTitle(typed);
  return t.length > 0 && (c === t || normalizeTitle(candidate) === t);
}
