import type { QlooClient } from "@/lib/qloo/client";
import type { OpenLibraryClient } from "@/lib/openlibrary/client";
import type { Book } from "@/lib/qloo/types";
import { checkBook, type RuleConfig, type RuleFailure } from "@/lib/rules/engine";
import { titlesMatch } from "@/lib/openlibrary/client";
import { authorsMatch, resolveSeed } from "./resolve";

export const MAX_CHECK_TITLES = 5;

export interface CheckInput {
  title: string;
  author?: string;
}

export type CheckStatus = "ACCEPTED" | "REJECTED" | "NOT_FOUND" | "NO_QLOO_DATA";

export interface CheckResult {
  input: CheckInput;
  status: CheckStatus;
  book: Book | null;
  external: { title: string; author: string | null; year: number | null } | null;
  failures: RuleFailure[];
  // True when the caller named an author and the book Qloo has under that title is by someone else.
  authorMismatch: boolean;
}

// Same rules as the shelf. Seed titles count as failures so an LLM echoing your own books gets caught.
export async function checkTitles(
  titles: CheckInput[],
  deps: { qloo: QlooClient; openLibrary: OpenLibraryClient },
  cfg: RuleConfig,
  seedTitles: string[] = [],
): Promise<CheckResult[]> {
  return Promise.all(
    titles.map(async (input): Promise<CheckResult> => {
      const r = await resolveSeed(input.title, deps, input.author);
      if (!r.book) return { input, status: r.status === "NO_QLOO_DATA" ? "NO_QLOO_DATA" : "NOT_FOUND", book: null, external: r.external, failures: [], authorMismatch: false };
      const failures: RuleFailure[] = [];
      if (seedTitles.some((s) => titlesMatch(r.book!.title, s))) failures.push({ rule: "is_seed" });
      failures.push(...checkBook(r.book, cfg));
      const authorMismatch = Boolean(input.author && r.book.author && !authorsMatch(r.book.author, input.author));
      return { input, status: failures.length ? "REJECTED" : "ACCEPTED", book: r.book, external: null, failures, authorMismatch };
    }),
  );
}

export function parseCheckTitles(raw: unknown, max = MAX_CHECK_TITLES): CheckInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > max) return null;
  const out: CheckInput[] = [];
  for (const item of raw) {
    const title = typeof item === "string" ? item : typeof item?.title === "string" ? item.title : null;
    const author = typeof item?.author === "string" ? item.author.trim().slice(0, 120) : undefined;
    const t = title?.trim().replace(/\s+/g, " ");
    if (!t || t.length > 200) return null;
    out.push(author ? { title: t, author } : { title: t });
  }
  return out;
}
