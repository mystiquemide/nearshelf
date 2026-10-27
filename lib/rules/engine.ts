import type { Book } from "@/lib/qloo/types";

export const WINDOW_MIN = 2;
export const WINDOW_MAX = 5;
export const WINDOW_DEFAULT = 3;
export const MAX_ACCEPTED = 6;

export type RuleId = "not_qloo_entity" | "is_seed" | "duplicate" | "year_unknown" | "too_old" | "popularity_unknown" | "too_big";

export interface RuleFailure {
  rule: RuleId;
  value?: number | string | null;
  limit?: number;
}

export interface RuleConfig {
  currentYear: number;
  windowYears: number;
  // null drops the size rule.
  popularityMax: number | null;
}

export interface Verdict {
  book: Book;
  accepted: boolean;
  failures: RuleFailure[];
}

export interface Shelf {
  accepted: Verdict[];
  rejected: Verdict[];
}

export function clampWindow(years: unknown): number {
  const n = typeof years === "number" ? years : Number(years);
  if (!Number.isInteger(n)) return WINDOW_DEFAULT;
  return Math.min(WINDOW_MAX, Math.max(WINDOW_MIN, n));
}

export function yearMin(cfg: RuleConfig): number {
  return cfg.currentYear - clampWindow(cfg.windowYears);
}

export function workKey(b: Pick<Book, "title" | "author">): string {
  const n = (s: string | null) => (s ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  return `${n(b.title)}|${n(b.author)}`;
}

// Checks one book against the content rules. Every failing rule is listed so the
// author sees "too old and too big", not just the first miss.
export function checkBook(book: Book, cfg: RuleConfig): RuleFailure[] {
  const failures: RuleFailure[] = [];
  if (!book.id || !book.id.trim()) failures.push({ rule: "not_qloo_entity" });

  const min = yearMin(cfg);
  if (book.year === null) failures.push({ rule: "year_unknown" });
  else if (book.year < min) failures.push({ rule: "too_old", value: book.year, limit: min });

  if (cfg.popularityMax !== null) {
    if (book.popularity === null) failures.push({ rule: "popularity_unknown" });
    else if (book.popularity > cfg.popularityMax) failures.push({ rule: "too_big", value: book.popularity, limit: cfg.popularityMax });
  }
  return failures;
}

// Ranks are kept from Qloo's order. Qloo silently ignores invalid filters, so
// every candidate is re-checked here regardless of what was requested.
export function buildShelf(candidates: Book[], seeds: Book[], cfg: RuleConfig): Shelf {
  const seedIds = new Set(seeds.map((s) => s.id));
  const seedKeys = new Set(seeds.map(workKey));
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const accepted: Verdict[] = [];
  const rejected: Verdict[] = [];

  for (const book of candidates) {
    const key = workKey(book);
    const failures: RuleFailure[] = [];
    if (seedIds.has(book.id) || seedKeys.has(key)) failures.push({ rule: "is_seed" });
    else if (seenIds.has(book.id) || seenKeys.has(key)) failures.push({ rule: "duplicate" });
    failures.push(...checkBook(book, cfg));
    seenIds.add(book.id);
    seenKeys.add(key);

    if (failures.length === 0 && accepted.length < MAX_ACCEPTED) accepted.push({ book, accepted: true, failures });
    else if (failures.length > 0) rejected.push({ book, accepted: false, failures });
  }
  return { accepted, rejected };
}
