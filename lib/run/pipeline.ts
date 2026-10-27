import { QlooError, type QlooClient } from "@/lib/qloo/client";
import type { OpenLibraryClient } from "@/lib/openlibrary/client";
import type { Book } from "@/lib/qloo/types";
import { buildShelf, yearMin, type RuleConfig, type Verdict } from "@/lib/rules/engine";
import { resolveSeed, type SeedResolution } from "./resolve";

export { MAX_SEEDS, MAX_TITLE_LENGTH, parseRunInput, type RunInput } from "./input";
import type { RunInput } from "./input";

export type ToolName = "resolve_titles" | "find_comps";

export type RunEvent =
  | { type: "agent"; mode: "agent" | "fixed"; model: string | null; reason?: string }
  | { type: "tool"; name: ToolName; status: "start" | "done" | "error"; ms?: number }
  | { type: "step"; state: "RESOLVING" | "QUERYING" | "CHECKING" }
  | { type: "seed"; seed: SeedResolution }
  | { type: "result"; state: "COMPLETE" | "COMPLETE_EMPTY"; accepted: Verdict[]; rejected: Verdict[]; explainability: unknown; yearMin: number; popularityMax: number | null }
  | { type: "error"; state: "FAILED" | "RATE_LIMITED"; reason: "no_seed_resolved" | "qloo_unavailable" | "qloo_not_configured" | "rate_limited"; message: string; retryable: boolean };

export type RunErrorEvent = Extract<RunEvent, { type: "error" }>;

export interface RunDeps {
  qloo: QlooClient;
  openLibrary: OpenLibraryClient;
  popularityMax: number | null;
  now?: () => Date;
}

// Holds one run's state. Both the agent's tools and the fixed sequence call into it,
// so every book and verdict comes from here and a fallback resumes without repeating calls.
export class RunSession {
  readonly cfg: RuleConfig;
  seeds: SeedResolution[] | null = null;
  outcome: Extract<RunEvent, { type: "result" }> | RunErrorEvent | null = null;

  constructor(
    readonly input: RunInput,
    private readonly deps: RunDeps,
    private readonly emit: (e: RunEvent) => void,
  ) {
    this.cfg = { currentYear: (deps.now?.() ?? new Date()).getFullYear(), windowYears: input.windowYears, popularityMax: deps.popularityMax };
  }

  get done() {
    return this.outcome !== null;
  }

  get resolvedBooks(): Book[] {
    return (this.seeds ?? []).flatMap((s) => (s.book ? [s.book] : []));
  }

  // Only titles the author typed can be resolved. Anything else the caller passes is ignored.
  async resolve(requested: string[] = this.input.seeds): Promise<SeedResolution[]> {
    if (this.seeds) return this.seeds;
    const allowed = this.input.seeds.filter((s) => requested.some((r) => r.trim().toLowerCase() === s.toLowerCase()));
    const titles = allowed.length ? allowed : this.input.seeds;
    this.emit({ type: "step", state: "RESOLVING" });
    try {
      this.seeds = await Promise.all(titles.map((s) => resolveSeed(s, this.deps)));
    } catch (err) {
      this.fail(errorEvent(err));
      throw err;
    }
    for (const seed of this.seeds) this.emit({ type: "seed", seed });
    if (this.resolvedBooks.length === 0) {
      this.fail({ type: "error", state: "FAILED", reason: "no_seed_resolved", message: "None of these titles have Qloo reader data, so there's nothing to base comps on.", retryable: false });
    }
    return this.seeds;
  }

  // Seed IDs must come from resolve(). Unknown IDs are dropped, so a caller can't add a book.
  async findComps(seedIds?: string[]) {
    if (this.done) return this.outcome!;
    if (!this.seeds) await this.resolve();
    if (this.done) return this.outcome!;
    const known = this.resolvedBooks;
    const picked = seedIds?.length ? known.filter((b) => seedIds.includes(b.id)) : known;
    const seeds = picked.length ? picked : known;

    this.emit({ type: "step", state: "QUERYING" });
    const min = yearMin(this.cfg);
    try {
      const insights = await this.deps.qloo.bookInsights({
        seedIds: seeds.map((b) => b.id),
        // No popularity filter here on purpose: megahits come back from Qloo and the rule engine
        // rejects them in plain view, so the size rule is enforced and shown, not delegated.
        publicationYearMin: min,
        explainability: true,
        take: 30,
      });
      this.emit({ type: "step", state: "CHECKING" });
      const shelf = buildShelf(insights.books, known, this.cfg);
      this.outcome = {
        type: "result",
        state: shelf.accepted.length > 0 ? "COMPLETE" : "COMPLETE_EMPTY",
        accepted: shelf.accepted,
        rejected: shelf.rejected,
        explainability: insights.explainability,
        yearMin: min,
        popularityMax: this.cfg.popularityMax,
      };
      this.emit(this.outcome);
      return this.outcome;
    } catch (err) {
      this.fail(errorEvent(err));
      throw err;
    }
  }

  private fail(e: RunErrorEvent) {
    if (this.done) return;
    this.outcome = e;
    this.emit(e);
  }

  // Finishes whatever is left with the fixed sequence. Errors are already emitted by fail().
  async finish() {
    try {
      if (!this.done) await this.findComps();
    } catch {
      // reported through fail()
    }
    if (!this.done) this.fail(errorEvent(new Error("run ended without an outcome")));
  }
}

// Turns a callback-driven run into a stream of events in order.
export async function* streamRun(start: (emit: (e: RunEvent) => void) => Promise<void>): AsyncGenerator<RunEvent> {
  const queue: RunEvent[] = [];
  let wake: (() => void) | null = null;
  let finished = false;
  const emit = (e: RunEvent) => {
    queue.push(e);
    wake?.();
  };
  const running = start(emit).finally(() => {
    finished = true;
    wake?.();
  });
  while (true) {
    if (queue.length) {
      yield queue.shift()!;
      continue;
    }
    if (finished) break;
    await new Promise<void>((r) => (wake = r));
    wake = null;
  }
  await running;
}

// The fixed sequence: resolve every seed, then find comps from all of them.
export function runComps(input: RunInput, deps: RunDeps): AsyncGenerator<RunEvent> {
  return streamRun(async (emit) => {
    emit({ type: "agent", mode: "fixed", model: null });
    await new RunSession(input, deps, emit).finish();
  });
}

export function errorEvent(err: unknown): RunErrorEvent {
  if (err instanceof QlooError) {
    if (err.kind === "rate_limited") return { type: "error", state: "RATE_LIMITED", reason: "rate_limited", message: "Too many requests to Qloo. Try again in a minute.", retryable: true };
    if (err.kind === "config") return { type: "error", state: "FAILED", reason: "qloo_not_configured", message: "Qloo isn't connected on this deployment yet.", retryable: false };
    return { type: "error", state: "FAILED", reason: "qloo_unavailable", message: err.kind === "timeout" ? "Qloo took too long to answer. Try again." : "Qloo couldn't complete the request. Try again.", retryable: err.retryable || err.kind === "upstream" };
  }
  console.error("run failed", err);
  return { type: "error", state: "FAILED", reason: "qloo_unavailable", message: "Something went wrong on our side. Try again.", retryable: true };
}
