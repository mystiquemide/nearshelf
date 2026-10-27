import { describe, expect, it, vi } from "vitest";
import { createQlooClient, QlooError, type Fetcher } from "@/lib/qloo/client";
import { toBook } from "@/lib/qloo/types";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const entity = { entity_id: "E1", name: "Synthetic Title", popularity: 0.42, properties: { publication_year: 2024, author: "Test Author" } };

function client(responses: (Response | Error)[]) {
  const fetcher = vi.fn<Fetcher>(async () => {
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next!;
  });
  return { fetcher, qloo: createQlooClient({ apiKey: "test-key", baseUrl: "https://qloo.test", fetcher, cache: null }) };
}

describe("qloo client", () => {
  it("sends a GET with the X-Api-Key header to the search path", async () => {
    const { fetcher, qloo } = client([json(200, { results: [entity] })]);
    const books = await qloo.searchBooks("Synthetic Title");
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe("https://qloo.test/search?query=Synthetic+Title&types=urn%3Aentity%3Abook&take=5");
    expect(init?.method).toBe("GET");
    expect((init?.headers as Record<string, string>)["X-Api-Key"]).toBe("test-key");
    expect(books).toEqual([{ id: "E1", title: "Synthetic Title", author: "Test Author", year: 2024, popularity: 0.42 }]);
  });

  it("builds insights params with filters and explainability", async () => {
    const { fetcher, qloo } = client([json(200, { results: { entities: [entity] }, query: { explainability: { ok: true } } })]);
    const res = await qloo.bookInsights({ seedIds: ["S1", "S2"], publicationYearMin: 2023, popularityMax: 0.8, explainability: true });
    const params = new URL(String(fetcher.mock.calls[0]![0])).searchParams;
    expect(Object.fromEntries(params)).toEqual({
      "filter.type": "urn:entity:book",
      "signal.interests.entities": "S1,S2",
      take: "30",
      "filter.publication_year.min": "2023",
      "filter.popularity.max": "0.8",
      "feature.explainability": "true",
    });
    expect(res.books).toHaveLength(1);
    expect(res.explainability).toEqual({ ok: true });
  });

  it("refuses insights without a seed and never calls Qloo", async () => {
    const { fetcher, qloo } = client([]);
    await expect(qloo.bookInsights({ seedIds: [] })).rejects.toMatchObject({ kind: "bad_request" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails clearly when the key is missing", async () => {
    const qloo = createQlooClient({ apiKey: "", fetcher: vi.fn<Fetcher>() });
    await expect(qloo.searchBooks("x")).rejects.toMatchObject({ kind: "config" });
  });

  it("retries a 5xx once, then succeeds", async () => {
    const { fetcher, qloo } = client([json(502, {}), json(200, { results: [entity] })]);
    expect(await qloo.searchBooks("x")).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not retry 4xx and maps status to a typed error", async () => {
    for (const [status, kind] of [[401, "unauthorized"], [403, "forbidden"], [429, "rate_limited"], [400, "bad_request"]] as const) {
      const { fetcher, qloo } = client([json(status, {})]);
      const err = await qloo.searchBooks("x").catch((e) => e);
      expect(err).toBeInstanceOf(QlooError);
      expect(err.kind).toBe(kind);
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });

  it("maps a timeout without retrying", async () => {
    const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });
    const { fetcher, qloo } = client([timeout]);
    await expect(qloo.searchBooks("x")).rejects.toMatchObject({ kind: "timeout", retryable: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns an empty list for an empty 200", async () => {
    const { qloo } = client([json(200, { results: { entities: [] } })]);
    expect(await qloo.searchBooks("x")).toEqual([]);
  });
});

describe("toBook", () => {
  it("drops entities without an id or name", () => {
    expect([toBook({ name: "No id" }), toBook({ entity_id: "x" }), toBook(null)]).toEqual([null, null, null]);
  });

  it("rejects popularity outside 0..1 and parses a year from a date", () => {
    expect(toBook({ entity_id: "x", name: "T", popularity: 7, properties: { publication_date: "2022-05-03" } })).toMatchObject({ popularity: null, year: 2022 });
  });
});

describe("toBook with Qloo's book shape", () => {
  // Field layout from live Qloo responses. Values are synthetic.
  it("reads the author from disambiguation and decodes entities", () => {
    expect(toBook({ entity_id: "X", name: "Blood &amp; Steel (Sample Series, #1)", popularity: 0.95, disambiguation: "2023, Sample  Writer", properties: { publication_year: "2023" } })).toEqual({
      id: "X", title: "Blood & Steel (Sample Series, #1)", author: "Sample Writer", year: 2023, popularity: 0.95,
    });
  });
});
