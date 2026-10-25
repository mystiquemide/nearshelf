import { describe, expect, it } from "vitest";
import { buildShelf, checkBook, clampWindow, MAX_ACCEPTED, type RuleConfig } from "@/lib/rules/engine";
import type { Book } from "@/lib/qloo/types";

// Synthetic books. No Qloo response data is stored in this repo.
const book = (id: string, over: Partial<Book> = {}): Book => ({ id, title: `Book ${id}`, author: "A. Writer", year: 2024, popularity: 0.4, ...over });
const cfg: RuleConfig = { currentYear: 2026, windowYears: 3, popularityMax: 0.8 };

describe("checkBook", () => {
  it("accepts a recent mid-list book", () => {
    expect(checkBook(book("a"), cfg)).toEqual([]);
  });

  it("names both rules for an old megahit", () => {
    expect(checkBook(book("hp", { year: 1997, popularity: 0.99 }), cfg)).toEqual([
      { rule: "too_old", value: 1997, limit: 2023 },
      { rule: "too_big", value: 0.99, limit: 0.8 },
    ]);
  });

  it("treats the window edge as inside", () => {
    expect(checkBook(book("edge", { year: 2023 }), cfg)).toEqual([]);
    expect(checkBook(book("edge", { year: 2022 }), cfg)[0]?.rule).toBe("too_old");
  });

  it("rejects unknown year and popularity instead of assuming", () => {
    expect(checkBook(book("u", { year: null, popularity: null }), cfg).map((f) => f.rule)).toEqual(["year_unknown", "popularity_unknown"]);
  });

  it("drops the size rule when no ceiling is set", () => {
    expect(checkBook(book("big", { popularity: 0.99 }), { ...cfg, popularityMax: null })).toEqual([]);
  });

  it("rejects a book with no Qloo entity id", () => {
    expect(checkBook(book(""), cfg).map((f) => f.rule)).toContain("not_qloo_entity");
  });
});

describe("clampWindow", () => {
  it("keeps the window between 2 and 5", () => {
    expect([clampWindow(1), clampWindow(4), clampWindow(9), clampWindow("x"), clampWindow(2.5)]).toEqual([2, 4, 5, 3, 3]);
  });
});

describe("buildShelf", () => {
  it("never returns a seed as its own comp, by id or by title and author", () => {
    const seed = book("s");
    const shelf = buildShelf([book("s"), book("other", { title: "book S", author: "a writer" }), book("ok")], [seed], cfg);
    expect(shelf.accepted.map((v) => v.book.id)).toEqual(["ok"]);
    expect(shelf.rejected.every((v) => v.failures[0]?.rule === "is_seed")).toBe(true);
  });

  it("dedupes by entity id and by normalized title plus author", () => {
    const shelf = buildShelf([book("a"), book("a"), book("b", { title: "Book a!" })], [], cfg);
    expect(shelf.accepted.map((v) => v.book.id)).toEqual(["a"]);
    expect(shelf.rejected.map((v) => v.failures[0]?.rule)).toEqual(["duplicate", "duplicate"]);
  });

  it("enforces the year rule even when Qloo ignores the filter", () => {
    const ignoredFilter = [book("old", { year: 2010 }), book("new", { year: 2025 })];
    const shelf = buildShelf(ignoredFilter, [], cfg);
    expect(shelf.accepted.map((v) => v.book.id)).toEqual(["new"]);
    expect(shelf.rejected[0]?.failures[0]).toEqual({ rule: "too_old", value: 2010, limit: 2023 });
  });

  it("caps the shelf and keeps Qloo's order", () => {
    const shelf = buildShelf(Array.from({ length: 10 }, (_, i) => book(String(i))), [], cfg);
    expect(shelf.accepted.map((v) => v.book.id)).toEqual(["0", "1", "2", "3", "4", "5"].slice(0, MAX_ACCEPTED));
  });

  it("every accepted comp has a Qloo entity id and passes every rule", () => {
    const mixed = [book("a"), book("", { title: "Injected" }), book("b", { year: 1990 }), book("c", { popularity: 0.95 }), book("d")];
    const shelf = buildShelf(mixed, [], cfg);
    for (const v of shelf.accepted) {
      expect(v.book.id).toBeTruthy();
      expect(checkBook(v.book, cfg)).toEqual([]);
    }
    expect(shelf.accepted.map((v) => v.book.id)).toEqual(["a", "d"]);
  });
});
