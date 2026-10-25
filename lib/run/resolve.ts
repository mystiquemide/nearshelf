import type { QlooClient } from "@/lib/qloo/client";
import type { Book } from "@/lib/qloo/types";
import { titlesMatch, type OpenLibraryClient } from "@/lib/openlibrary/client";

export type SeedStatus = "RESOLVED" | "NOT_FOUND" | "NO_QLOO_DATA";

export interface SeedResolution {
  input: string;
  status: SeedStatus;
  book: Book | null;
  // Set when the book is real per Open Library but Qloo has no readers for it.
  external: { title: string; author: string | null; year: number | null } | null;
}

// When an author is known (pasted comps, LLM output), a same-title book by that author wins.
export async function resolveSeed(input: string, deps: { qloo: QlooClient; openLibrary: OpenLibraryClient }, author?: string): Promise<SeedResolution> {
  const [qlooBooks, ol] = await Promise.all([deps.qloo.searchBooks(input, 5), deps.openLibrary.findBook(input)]);
  const sameTitle = qlooBooks.filter((b) => titlesMatch(b.title, input));
  const book = (author ? sameTitle.find((b) => authorsMatch(b.author, author)) : undefined) ?? sameTitle[0] ?? null;
  if (book) {
    // Fill a missing year from Open Library so the rule engine has something to check.
    const year = book.year ?? (ol && ol !== "unknown" ? ol.firstPublishYear : null);
    return { input, status: "RESOLVED", book: { ...book, year }, external: null };
  }
  if (ol && ol !== "unknown") {
    return { input, status: "NO_QLOO_DATA", book: null, external: { title: ol.title, author: ol.author, year: ol.firstPublishYear } };
  }
  return { input, status: "NOT_FOUND", book: null, external: null };
}

// Compares surnames so "S. A. Cosby" and "S.A. Cosby" match.
export function authorsMatch(a: string | null, b: string | null): boolean {
  const surname = (s: string | null) => (s ?? "").split(",")[0]!.toLowerCase().normalize("NFKD").replace(/[^a-z ]/g, " ").trim().split(/\s+/).pop() ?? "";
  const x = surname(a);
  return x.length > 0 && x === surname(b);
}
