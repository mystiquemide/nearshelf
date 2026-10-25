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

export async function resolveSeed(input: string, deps: { qloo: QlooClient; openLibrary: OpenLibraryClient }): Promise<SeedResolution> {
  const [qlooBooks, ol] = await Promise.all([deps.qloo.searchBooks(input, 5), deps.openLibrary.findBook(input)]);
  const book = qlooBooks.find((b) => titlesMatch(b.title, input)) ?? null;
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
