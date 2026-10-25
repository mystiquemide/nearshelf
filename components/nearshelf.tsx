"use client";

import { useEffect, useRef, useState } from "react";
import { readNdjson } from "@/lib/client/ndjson";
import { WINDOW_DEFAULT, WINDOW_MAX, WINDOW_MIN } from "@/lib/rules/engine";
import { compSentence, parseShareQuery, shareQuery } from "@/lib/share";
import { Baseline } from "./baseline";
import { CheckComps } from "./check-comps";
import { Shelf } from "./shelf";
import type { BaselineResponse, RunError, RunEvent, RunResult, SeedResolution, StepState } from "./types";

// Inputs only. Every result shown for a preset comes from a live run.
const PRESETS: { label: string; seeds: [string, string, string] }[] = [
  { label: "Epic fantasy", seeds: ["The Jasmine Throne", "The Spear Cuts Through Water", "Godkiller"] },
  { label: "Literary", seeds: ["The Bee Sting", "Western Lane", "Small Things Like These"] },
  { label: "Thriller", seeds: ["Razorblade Tears", "The It Girl", "Rock Paper Scissors"] },
  { label: "Books that don't exist", seeds: ["The Glass Orchard of Velmora", "Saltwind Cathedral", "A Lantern for Nobody"] },
];

const STEPS: { state: StepState; label: string }[] = [
  { state: "RESOLVING", label: "Finding your books" },
  { state: "QUERYING", label: "Asking Qloo who reads these" },
  { state: "CHECKING", label: "Checking each against the rules" },
];

const SEED_NOTE: Record<SeedResolution["status"], (s: SeedResolution) => string> = {
  RESOLVED: (s) => `${s.book!.title}${s.book!.author ? ` by ${s.book!.author}` : ""}${s.book!.year ? `, ${s.book!.year}` : ""}`,
  NOT_FOUND: () => "Couldn't find this book",
  NO_QLOO_DATA: (s) => `Real book${s.external?.year ? ` (${s.external.year})` : ""}, but Qloo has no reader data for it`,
};

type Phase = "idle" | "running" | "done" | "error";

export function Nearshelf() {
  const [seeds, setSeeds] = useState<[string, string, string]>(["", "", ""]);
  const [windowYears, setWindowYears] = useState(WINDOW_DEFAULT);
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState<StepState | null>(null);
  const [seedResults, setSeedResults] = useState<Record<string, SeedResolution>>({});
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<RunError | null>(null);
  const [baseline, setBaseline] = useState<BaselineResponse | null>(null);
  const [baselineLoading, setBaselineLoading] = useState(false);
  const [myTitle, setMyTitle] = useState("");
  const [copied, setCopied] = useState<"sentence" | "link" | null>(null);
  const runId = useRef(0);

  const filled = seeds.map((s) => s.trim()).filter(Boolean);

  async function run(input: { seeds: string[]; windowYears: number }) {
    const id = ++runId.current;
    setPhase("running");
    setStep(null);
    setSeedResults({});
    setResult(null);
    setError(null);
    setBaseline(null);
    setBaselineLoading(true);
    history.replaceState(null, "", `?${shareQuery(input)}`);

    // The baseline runs alongside and never holds up or breaks the main run.
    fetch("/api/baseline", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) })
      .then((r) => r.json())
      .catch(() => ({ state: "UNAVAILABLE", message: "The plain-LLM comparison isn't available right now." }))
      .then((b: Partial<BaselineResponse> & { error?: string }) => {
        if (id !== runId.current) return;
        setBaseline(b.state ? (b as BaselineResponse) : { state: "UNAVAILABLE", message: b.error ?? "The plain-LLM comparison isn't available right now." });
        setBaselineLoading(false);
      });

    const fail = (message: string): RunError => ({ type: "error", state: "FAILED", reason: "qloo_unavailable", message, retryable: true });
    try {
      const res = await fetch("/api/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
      if (!res.body || (!res.ok && res.headers.get("content-type")?.includes("application/json"))) {
        const body = await res.json().catch(() => ({}));
        throw fail(body.error ?? "Couldn't start the run.");
      }
      let finished = false;
      await readNdjson<RunEvent>(res.body, (e) => {
        if (id !== runId.current) return;
        if (e.type === "step") setStep(e.state);
        else if (e.type === "seed") setSeedResults((prev) => ({ ...prev, [e.seed.input]: e.seed }));
        else if (e.type === "result") {
          finished = true;
          setResult(e);
          setPhase("done");
        } else {
          finished = true;
          setError(e);
          setPhase("error");
        }
      });
      if (!finished && id === runId.current) throw fail("The run stopped before it finished. Try again.");
    } catch (e) {
      if (id !== runId.current) return;
      setError(e && typeof e === "object" && "type" in e ? (e as RunError) : fail("Couldn't reach the server. Try again."));
      setPhase("error");
    }
  }

  // A share link reruns the same inputs on open.
  useEffect(() => {
    const input = parseShareQuery(window.location.search.slice(1));
    if (!input) return;
    setSeeds([input.seeds[0] ?? "", input.seeds[1] ?? "", input.seeds[2] ?? ""]);
    setWindowYears(input.windowYears);
    void run(input);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPreset(p: (typeof PRESETS)[number]) {
    setSeeds(p.seeds);
    void run({ seeds: p.seeds, windowYears });
  }

  async function copy(kind: "sentence" | "link", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  const stepIndex = step ? STEPS.findIndex((s) => s.state === step) : -1;
  const resolvedSeedTitles = Object.values(seedResults).flatMap((s) => (s.book ? [s.book.title] : []));
  const sentence = result ? compSentence(result.accepted.map((v) => v.book), myTitle) : null;
  const topComp = result?.accepted[0]?.book;
  const replacement = topComp ? `${topComp.title}${topComp.author ? ` by ${topComp.author}` : ""}` : null;

  return (
    <main className="wrap">
      <header className="hero">
        <h1>Nearshelf</h1>
        <p className="lede">Recent, mid-list comp titles for your query letter, backed by real reader data. If Qloo can't find the readers, it isn't a comp.</p>
      </header>

      <section className="panel" aria-labelledby="seeds-h">
        <h2 id="seeds-h">Your book reads like</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (filled.length) void run({ seeds: filled, windowYears });
          }}
        >
          {seeds.map((value, i) => {
            const r = seedResults[value.trim().replace(/\s+/g, " ")];
            return (
              <div className="field" key={i}>
                <label htmlFor={`seed-${i}`}>Book {i + 1}</label>
                <input
                  id={`seed-${i}`}
                  value={value}
                  maxLength={200}
                  autoComplete="off"
                  placeholder={i === 0 ? "A title you'd shelve yours next to" : "Optional"}
                  onChange={(e) => setSeeds((prev) => prev.map((s, j) => (j === i ? e.target.value : s)) as [string, string, string])}
                  aria-describedby={r ? `seed-${i}-note` : undefined}
                />
                {r && (
                  <p id={`seed-${i}-note`} className={`seed-note seed-${r.status.toLowerCase()}`}>
                    {SEED_NOTE[r.status](r)}
                  </p>
                )}
              </div>
            );
          })}
          <div className="row">
            <label htmlFor="window" className="small">Published in the last</label>
            <select id="window" value={windowYears} onChange={(e) => setWindowYears(Number(e.target.value))}>
              {Array.from({ length: WINDOW_MAX - WINDOW_MIN + 1 }, (_, i) => WINDOW_MIN + i).map((n) => (
                <option key={n} value={n}>{n} years</option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary" disabled={filled.length === 0 || phase === "running"}>
              {phase === "running" ? "Finding comps" : "Find comps"}
            </button>
          </div>
        </form>
        <div className="presets">
          <span className="small muted">Or try:</span>
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="btn btn-ghost" disabled={phase === "running"} onClick={() => applyPreset(p)}>
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {phase !== "idle" && (
        <ol className="steps" aria-live="polite" aria-label="Progress">
          {STEPS.map((s, i) => {
            const failedHere = phase === "error" && i === Math.max(stepIndex, 0);
            const status = failedHere ? "failed" : phase === "done" || i < stepIndex ? "done" : i === stepIndex ? "active" : "pending";
            return (
              <li key={s.state} className={`step step-${status}`}>
                <span className="dot" aria-hidden="true" />
                {s.label}
                <span className="sr-only"> ({status})</span>
              </li>
            );
          })}
        </ol>
      )}

      {error && (
        <div className="panel error-panel" role="alert">
          <p>{error.message}</p>
          {error.retryable && (
            <button type="button" className="btn" onClick={() => void run({ seeds: filled, windowYears })}>
              Try again
            </button>
          )}
        </div>
      )}

      <div className="grid">
        <div>
          {result && <Shelf key={result.accepted.map((v) => v.book.id).join()} result={result} seedTitles={resolvedSeedTitles} />}

          {sentence && (
            <section className="panel" aria-labelledby="sentence-h">
              <h2 id="sentence-h">Your comp line</h2>
              <label htmlFor="my-title" className="small">Your book's title (optional)</label>
              <input id="my-title" value={myTitle} maxLength={120} onChange={(e) => setMyTitle(e.target.value)} placeholder="My novel" />
              <blockquote className="sentence">{sentence}</blockquote>
              <div className="row">
                <button type="button" className="btn" onClick={() => copy("sentence", sentence)}>
                  {copied === "sentence" ? "Copied" : "Copy line"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => copy("link", window.location.href)}>
                  {copied === "link" ? "Link copied" : "Copy share link"}
                </button>
              </div>
            </section>
          )}

          <CheckComps windowYears={windowYears} replacement={replacement} />
        </div>

        {phase !== "idle" && <Baseline data={baseline} loading={baselineLoading} />}
      </div>

      <footer className="foot small muted">
        Reader data from Qloo. Publication years cross-checked with Open Library.
      </footer>
    </main>
  );
}
