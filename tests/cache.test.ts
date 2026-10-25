import { describe, expect, it, vi } from "vitest";
import { createTtlCache } from "@/lib/qloo/cache";
import { createQlooClient, type Fetcher } from "@/lib/qloo/client";

describe("createTtlCache", () => {
  it("serves hits until they expire", async () => {
    let t = 0;
    const cache = createTtlCache<number>({ max: 10, ttlMs: 100, now: () => t });
    const load = vi.fn(async () => 1);
    await cache.get("k", load);
    await cache.get("k", load);
    expect(load).toHaveBeenCalledTimes(1);
    t = 100;
    await cache.get("k", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight load between concurrent callers", async () => {
    const cache = createTtlCache<number>({ max: 10, ttlMs: 1000 });
    let release!: (n: number) => void;
    const load = vi.fn(() => new Promise<number>((r) => (release = r)));
    const all = Promise.all([cache.get("k", load), cache.get("k", load), cache.get("k", load)]);
    release(7);
    expect(await all).toEqual([7, 7, 7]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("doesn't keep failures", async () => {
    const cache = createTtlCache<number>({ max: 10, ttlMs: 1000 });
    await expect(cache.get("k", async () => { throw new Error("down"); })).rejects.toThrow("down");
    expect(await cache.get("k", async () => 2)).toBe(2);
  });

  it("evicts the least recently used entry past the limit", async () => {
    const cache = createTtlCache<string>({ max: 2, ttlMs: 1000 });
    await cache.get("a", async () => "a");
    await cache.get("b", async () => "b");
    await cache.get("a", async () => "a2");
    await cache.get("c", async () => "c");
    const loadB = vi.fn(async () => "b2");
    expect(await cache.get("b", loadB)).toBe("b2");
    expect(loadB).toHaveBeenCalled();
    expect(cache.size).toBe(2);
  });
});

describe("qloo client cache", () => {
  const ok = () => new Response(JSON.stringify({ results: [{ entity_id: "E1", name: "T" }] }), { status: 200 });

  it("calls Qloo once for repeated identical requests and again for different ones", async () => {
    const fetcher = vi.fn<Fetcher>(async () => ok());
    const qloo = createQlooClient({ apiKey: "k", baseUrl: "https://qloo.test", fetcher, cache: createTtlCache({ max: 10, ttlMs: 1000 }) });
    await qloo.searchBooks("Godkiller");
    await qloo.searchBooks("Godkiller");
    await qloo.searchBooks("The Bee Sting");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("asks Next's data cache to keep successful GETs", async () => {
    const fetcher = vi.fn<Fetcher>(async () => ok());
    await createQlooClient({ apiKey: "k", baseUrl: "https://qloo.test", fetcher, cache: null }).searchBooks("x");
    expect((fetcher.mock.calls[0]![1] as { next?: unknown }).next).toEqual({ revalidate: 86400 });
  });

  it("retries after a failed call instead of caching the error", async () => {
    const fetcher = vi.fn<Fetcher>().mockResolvedValueOnce(new Response("{}", { status: 503 })).mockResolvedValueOnce(new Response("{}", { status: 503 })).mockResolvedValue(ok());
    const qloo = createQlooClient({ apiKey: "k", baseUrl: "https://qloo.test", fetcher, cache: createTtlCache({ max: 10, ttlMs: 1000 }) });
    await expect(qloo.searchBooks("x")).rejects.toMatchObject({ kind: "upstream" });
    expect(await qloo.searchBooks("x")).toHaveLength(1);
  });
});
