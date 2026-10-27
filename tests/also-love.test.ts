import { describe, expect, it, vi } from "vitest";
import { alsoLove, parseCompIds } from "@/lib/run/also-love";
import { createQlooClient, QlooError, type Fetcher, type QlooClient } from "@/lib/qloo/client";

describe("parseCompIds", () => {
  it("accepts one to six plain IDs and dedupes", () => {
    expect(parseCompIds(["A1", "B-2", "A1"])).toEqual(["A1", "B-2"]);
  });

  it("rejects anything else", () => {
    for (const bad of [null, [], ["a", "b", "c", "d", "e", "f", "g"], [""], [42], ["<script>"], ["x".repeat(101)], "A1"]) expect(parseCompIds(bad)).toBeNull();
  });
});

describe("alsoLove", () => {
  it("queries each domain with the comp IDs and keeps a failed domain separate", async () => {
    const crossDomainInsights = vi.fn(async (type: string) => {
      if (type === "urn:entity:tv_show") throw new QlooError("upstream", "down", 502);
      return [{ id: type, name: `Top ${type}` }];
    });
    const qloo = { searchBooks: vi.fn(), bookInsights: vi.fn(), crossDomainInsights } satisfies QlooClient;
    const out = await alsoLove(qloo, ["C1", "C2"]);
    expect(out).toEqual({ podcasts: [{ id: "urn:entity:podcast", name: "Top urn:entity:podcast" }], shows: null });
    expect(crossDomainInsights.mock.calls.map((c) => c.slice(1))).toEqual([[["C1", "C2"], 5], [["C1", "C2"], 5]]);
  });
});

describe("crossDomainInsights", () => {
  it("sends the domain type and comp signals, and drops entities without id or name", async () => {
    const fetcher = vi.fn<Fetcher>(async () => new Response(JSON.stringify({ results: { entities: [{ entity_id: "P1", name: " A Podcast " }, { name: "no id" }, { entity_id: "P2" }] } })));
    const qloo = createQlooClient({ apiKey: "k", baseUrl: "https://qloo.test", fetcher, cache: null });
    expect(await qloo.crossDomainInsights("urn:entity:podcast", ["C1"], 5)).toEqual([{ id: "P1", name: "A Podcast" }]);
    expect(Object.fromEntries(new URL(String(fetcher.mock.calls[0]![0])).searchParams)).toEqual({ "filter.type": "urn:entity:podcast", "signal.interests.entities": "C1", take: "5" });
  });
});
