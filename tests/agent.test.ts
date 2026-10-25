import { describe, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { runAgent } from "@/lib/agent/agent";
import { QlooError, type QlooClient } from "@/lib/qloo/client";
import type { OpenLibraryClient } from "@/lib/openlibrary/client";
import type { RunDeps, RunEvent } from "@/lib/run/pipeline";
import type { Book } from "@/lib/qloo/types";

// Synthetic books and a scripted model. No Qloo or LLM output is stored here.
const book = (id: string, title: string, over: Partial<Book> = {}): Book => ({ id, title, author: "A. Writer", year: 2025, popularity: 0.3, ...over });
const library: Record<string, Book> = { "seed one": book("S1", "Seed One"), "seed two": book("S2", "Seed Two") };

function deps(insights?: QlooClient["bookInsights"]) {
  const qloo = {
    searchBooks: vi.fn(async (q: string) => (library[q.toLowerCase()] ? [library[q.toLowerCase()]!] : [])),
    bookInsights: vi.fn(insights ?? (async () => ({ books: [book("C1", "Comp One"), book("C2", "Old Comp", { year: 2001 })], explainability: null }))),
  } satisfies QlooClient;
  const openLibrary = { findBook: vi.fn(async () => null) } satisfies OpenLibraryClient;
  return { qloo, d: { qloo, openLibrary, popularityMax: 0.8, now: () => new Date("2026-10-25") } satisfies RunDeps };
}

const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } };
const call = (id: string, toolName: string, input: unknown) => ({
  content: [{ type: "tool-call" as const, toolCallId: id, toolName, input: JSON.stringify(input) }],
  finishReason: { unified: "tool-calls" as const, raw: "tool_calls" },
  usage, warnings: [],
});
const text = (t: string) => ({ content: [{ type: "text" as const, text: t }], finishReason: { unified: "stop" as const, raw: "stop" }, usage, warnings: [] });

async function collect(gen: AsyncGenerator<RunEvent>) {
  const out: RunEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}
const input = { seeds: ["Seed One", "Seed Two"], windowYears: 3 };

describe("runAgent", () => {
  it("streams real tool events in order and ends with the rule-checked result", async () => {
    const { d, qloo } = deps();
    const model = new MockLanguageModelV4({ doGenerate: [call("1", "resolve_titles", { titles: input.seeds }), call("2", "find_comps", { seedIds: ["S1", "S2"] }), text("done")] });
    const events = await collect(runAgent(input, d, model, "mock"));
    expect(events.map((e) => (e.type === "tool" ? `${e.name}:${e.status}` : e.type === "step" ? e.state : e.type))).toEqual([
      "agent", "resolve_titles:start", "RESOLVING", "seed", "seed", "resolve_titles:done",
      "find_comps:start", "QUERYING", "CHECKING", "result", "find_comps:done",
    ]);
    expect(events[0]).toEqual({ type: "agent", mode: "agent", model: "mock" });
    const result = events.find((e) => e.type === "result");
    expect(result?.type === "result" && result.accepted.map((v) => v.book.id)).toEqual(["C1"]);
    expect(qloo.bookInsights).toHaveBeenCalledTimes(1);
  });

  it("ignores injected seed ids and invented titles from the model", async () => {
    const { d, qloo } = deps();
    const model = new MockLanguageModelV4({
      doGenerate: [call("1", "resolve_titles", { titles: ["Seed One", "Harry Potter"] }), call("2", "find_comps", { seedIds: ["S1", "EVIL"] }), text("done")],
    });
    const events = await collect(runAgent(input, d, model, "mock"));
    expect(qloo.searchBooks.mock.calls.map((c) => c[0])).toEqual(["Seed One"]);
    expect(qloo.bookInsights.mock.calls[0]![0].seedIds).toEqual(["S1"]);
    expect(events.filter((e) => e.type === "seed").map((e) => e.type === "seed" && e.seed.input)).toEqual(["Seed One"]);
  });

  it("finishes with the fixed sequence when the model fails, without repeating Qloo calls", async () => {
    const { d, qloo } = deps();
    let n = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        if (n++ === 0) return call("1", "resolve_titles", { titles: input.seeds });
        throw new Error("provider down");
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const events = await collect(runAgent(input, d, model, "mock"));
    expect(events.filter((e) => e.type === "agent").map((e) => e.type === "agent" && e.mode)).toEqual(["agent", "fixed"]);
    expect(events.at(-1)?.type).toBe("result");
    expect(qloo.searchBooks).toHaveBeenCalledTimes(2);
    expect(qloo.bookInsights).toHaveBeenCalledTimes(1);
  });

  it("finishes the run when the model replies without calling tools", async () => {
    const { d } = deps();
    const events = await collect(runAgent(input, d, new MockLanguageModelV4({ doGenerate: [text("Try The Hunger Games!")] }), "mock"));
    expect(events.at(-1)).toMatchObject({ type: "result", state: "COMPLETE" });
    expect(JSON.stringify(events)).not.toContain("Hunger Games");
  });

  it("stops on a Qloo error and reports it once", async () => {
    const { d } = deps(async () => { throw new QlooError("timeout", "slow"); });
    const model = new MockLanguageModelV4({ doGenerate: [call("1", "resolve_titles", { titles: input.seeds }), call("2", "find_comps", { seedIds: ["S1"] }), text("retrying"), text("x")] });
    const events = await collect(runAgent(input, d, model, "mock"));
    expect(events.filter((e) => e.type === "error")).toEqual([expect.objectContaining({ state: "FAILED", reason: "qloo_unavailable", retryable: true })]);
    expect(events.filter((e) => e.type === "result")).toEqual([]);
  });

  it("runs the fixed sequence when no model is configured", async () => {
    const { d } = deps();
    const events = await collect(runAgent(input, d, null));
    expect(events[0]).toMatchObject({ type: "agent", mode: "fixed" });
    expect(events.at(-1)?.type).toBe("result");
  });
});
