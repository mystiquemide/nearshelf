import { QlooError, type QlooClient } from "@/lib/qloo/client";
import type { OpenLibraryClient } from "@/lib/openlibrary/client";
import { buildShelf, clampWindow, yearMin, type RuleConfig, type Verdict } from "@/lib/rules/engine";
import { resolveSeed, type SeedResolution } from "./resolve";

export const MAX_SEEDS = 3;
export const MAX_TITLE_LENGTH = 200;

export interface RunInput {
  seeds: string[];
  windowYears: number;
}

export type RunEvent =
  | { type: "step"; state: "RESOLVING" | "QUERYING" | "CHECKING" }
  | { type: "seed"; seed: SeedResolution }
  | { type: "result"; state: "COMPLETE" | "COMPLETE_EMPTY"; accepted: Verdict[]; rejected: Verdict[]; explainability: unknown; yearMin: number; popularityMax: number | null }
  | { type: "error"; state: "FAILED" | "RATE_LIMITED"; reason: "no_seed_resolved" | "qloo_unavailable" | "qloo_not_configured" | "rate_limited"; message: string; retryable: boolean };

export interface RunDeps {
  qloo: QlooClient;
  openLibrary: OpenLibraryClient;
  popularityMax: number | null;
  now?: () => Date;
}

// Seeds are plain data. They only ever reach search params, never a prompt.
export function parseRunInput(body: unknown): RunInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { seeds?: unknown; windowYears?: unknown };
  if (!Array.isArray(b.seeds)) return null;
  const seeds = b.seeds
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter((s) => s.length > 0);
  if (seeds.length === 0 || seeds.length > MAX_SEEDS || b.seeds.length > MAX_SEEDS) return null;
  if (seeds.some((s) => s.length > MAX_TITLE_LENGTH)) return null;
  return { seeds: [...new Set(seeds)], windowYears: clampWindow(b.windowYears ?? undefined) };
}

export async function* runComps(input: RunInput, deps: RunDeps): AsyncGenerator<RunEvent> {
  const cfg: RuleConfig = { currentYear: (deps.now?.() ?? new Date()).getFullYear(), windowYears: input.windowYears, popularityMax: deps.popularityMax };
  try {
    yield { type: "step", state: "RESOLVING" };
    const seeds = await Promise.all(input.seeds.map((s) => resolveSeed(s, deps)));
    for (const seed of seeds) yield { type: "seed", seed };

    const resolved = seeds.flatMap((s) => (s.book ? [s.book] : []));
    if (resolved.length === 0) {
      yield { type: "error", state: "FAILED", reason: "no_seed_resolved", message: "None of these titles have Qloo reader data, so there's nothing to base comps on.", retryable: false };
      return;
    }

    yield { type: "step", state: "QUERYING" };
    const min = yearMin(cfg);
    const insights = await deps.qloo.bookInsights({
      seedIds: resolved.map((b) => b.id),
      publicationYearMin: min,
      popularityMax: cfg.popularityMax ?? undefined,
      explainability: true,
      take: 30,
    });

    yield { type: "step", state: "CHECKING" };
    const shelf = buildShelf(insights.books, resolved, cfg);
    yield {
      type: "result",
      state: shelf.accepted.length > 0 ? "COMPLETE" : "COMPLETE_EMPTY",
      accepted: shelf.accepted,
      rejected: shelf.rejected,
      explainability: insights.explainability,
      yearMin: min,
      popularityMax: cfg.popularityMax,
    };
  } catch (err) {
    yield errorEvent(err);
  }
}

export function errorEvent(err: unknown): Extract<RunEvent, { type: "error" }> {
  if (err instanceof QlooError) {
    if (err.kind === "rate_limited") return { type: "error", state: "RATE_LIMITED", reason: "rate_limited", message: "Too many requests to Qloo. Try again in a minute.", retryable: true };
    if (err.kind === "config") return { type: "error", state: "FAILED", reason: "qloo_not_configured", message: "Qloo isn't connected on this deployment yet.", retryable: false };
    return { type: "error", state: "FAILED", reason: "qloo_unavailable", message: err.kind === "timeout" ? "Qloo took too long to answer. Try again." : "Qloo couldn't complete the request. Try again.", retryable: err.retryable || err.kind === "upstream" };
  }
  console.error("run failed", err);
  return { type: "error", state: "FAILED", reason: "qloo_unavailable", message: "Something went wrong on our side. Try again.", retryable: true };
}
