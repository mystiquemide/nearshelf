export interface Book {
  id: string;
  title: string;
  author: string | null;
  year: number | null;
  popularity: number | null;
}

// Qloo doesn't document the book entity fields. These paths are the likely ones
// and the Phase 0 probe confirms which actually appear.
const YEAR_PATHS = ["publication_year", "publication_date", "release_year", "year"] as const;

export function toBook(raw: unknown): Book | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const props = (e.properties ?? {}) as Record<string, unknown>;
  const id = typeof e.entity_id === "string" ? e.entity_id : typeof e.id === "string" ? e.id : null;
  const title = typeof e.name === "string" ? e.name.trim() : null;
  if (!id || !title) return null;
  return { id, title, author: authorOf(props.author ?? props.authors ?? e.disambiguation), year: yearOf(props), popularity: popularityOf(e.popularity) };
}

function authorOf(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (Array.isArray(v)) {
    const names = v.map((a) => (typeof a === "string" ? a : (a as { name?: unknown })?.name)).filter((n): n is string => typeof n === "string");
    return names.length ? names.join(", ") : null;
  }
  return null;
}

function yearOf(props: Record<string, unknown>): number | null {
  for (const key of YEAR_PATHS) {
    const m = props[key] == null ? null : String(props[key]).match(/\b(1[5-9]\d{2}|20\d{2})\b/);
    if (m) return Number(m[1]);
  }
  return null;
}

function popularityOf(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}
