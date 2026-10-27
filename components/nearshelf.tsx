"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { readNdjson } from "@/lib/client/ndjson";
import { WINDOW_DEFAULT, WINDOW_MAX, WINDOW_MIN } from "@/lib/rules/engine";
import { compSentence, parseShareQuery, shareQuery } from "@/lib/share";
import { Copy, Link2, ListChecks, Scale, Search } from "lucide-react";
import { AgentLog } from "./agent-log";
import { AlsoLove } from "./also-love";
import { Baseline } from "./baseline";
import { RulesPanel } from "./rules-panel";
import { CheckComps } from "./check-comps";
import { Shelf } from "./shelf";
import type { AgentEvent, BaselineResponse, RunError, RunEvent, RunResult, SeedResolution, StepState, ToolEvent } from "./types";

// Inputs only. Every result shown for a preset comes from a live run.
const PRESETS: { label: string; color: string; seeds: [string, string, string] }[] = [
  { label: "Epic fantasy", color: "#b45309", seeds: ["The Jasmine Throne", "The Blacktongue Thief", "The Book Eaters"] },
  { label: "Literary", color: "#059669", seeds: ["Western Lane", "The Candy House", "Memphis"] },
  { label: "Thriller", color: "#dc2626", seeds: ["Such a Quiet Place", "The It Girl", "Rock Paper Scissors"] },
  { label: "Books that don't exist", color: "#71717a", seeds: ["The Glass Orchard of Velmora", "Saltwind Cathedral", "A Lantern for Nobody"] },
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

export function Nearshelf({
  popularityMax,
  alsoLoveEnabled = false,
  qlooReady = false,
}: {
  popularityMax: number | null;
  alsoLoveEnabled?: boolean;
  qlooReady?: boolean;
}) {
  const [seeds, setSeeds] = useState<[string, string, string]>(["", "", ""]);
  const [windowYears, setWindowYears] = useState(WINDOW_DEFAULT);
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState<StepState | null>(null);
  const [seedResults, setSeedResults] = useState<Record<string, SeedResolution>>({});
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<RunError | null>(null);
  const [agent, setAgent] = useState<AgentEvent[]>([]);
  const [tools, setTools] = useState<ToolEvent[]>([]);
  const [baseline, setBaseline] = useState<BaselineResponse | null>(null);
  const [baselineLoading, setBaselineLoading] = useState(false);
  const [myTitle, setMyTitle] = useState("");
  const [copied, setCopied] = useState<"sentence" | "link" | "failed" | null>(null);
  const runId = useRef(0);
  const lastInput = useRef<{ seeds: string[]; windowYears: number } | null>(null);
  const [tab, setTab] = useState<Tab>("find");
  const [sharedSeeds, setSharedSeeds] = useState<string[] | null>(null);

  const filled = seeds.map((s) => s.trim()).filter(Boolean);

  async function run(input: { seeds: string[]; windowYears: number }) {
    const id = ++runId.current;
    lastInput.current = input;
    setPhase("running");
    setStep(null);
    setSeedResults({});
    setAgent([]);
    setTools([]);
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
        if (e.type === "agent") setAgent((prev) => [...prev, e]);
        else if (e.type === "tool") setTools((prev) => (e.status === "start" ? [...prev, e] : prev.map((t) => (t.name === e.name && t.status === "start" ? e : t))));
        else if (e.type === "step") setStep(e.state);
        else if (e.type === "seed") setSeedResults((prev) => ({ ...prev, [e.seed.input]: e.seed }));
        else if (e.type === "result") {
          finished = true;
          setResult(e);
          setPhase("done");
        } else if (e.type === "error") {
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
    setSharedSeeds(input.seeds);
    setSeeds([input.seeds[0] ?? "", input.seeds[1] ?? "", input.seeds[2] ?? ""]);
    setWindowYears(input.windowYears);
    void run(input);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "#check" links anywhere on the page open the checker tab inside the tool.
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash !== "#check") return;
      setTab("check");
      document.getElementById("tool")?.scrollIntoView({ block: "start" });
    };
    // A second click on a "#check" link doesn't change the hash, so clicks are handled too.
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.('a[href="#check"]')) window.setTimeout(onHash, 0);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick);
    };
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
      // Clipboard can be blocked by the browser. The text stays on screen to select by hand.
      setCopied("failed");
    }
  }

  const stepIndex = step ? STEPS.findIndex((s) => s.state === step) : -1;
  const resolvedSeedTitles = Object.values(seedResults).flatMap((s) => (s.book ? [s.book.title] : []));
  const sentence = result ? compSentence(result.accepted.map((v) => v.book), myTitle) : null;
  const topComp = result?.accepted[0]?.book;
  const replacement = topComp ? `${topComp.title}${topComp.author ? ` by ${topComp.author}` : ""}` : null;
  const retry = () => lastInput.current && void run(lastInput.current);
  const widen = () => {
    if (!lastInput.current) return;
    setWindowYears(WINDOW_MAX);
    void run({ ...lastInput.current, windowYears: WINDOW_MAX });
  };
  const alsoLoveIds = useMemo(
    () => (result ? [...new Set([...Object.values(seedResults).flatMap((s) => (s.book ? [s.book.id] : [])), ...result.accepted.slice(0, 3).map((v) => v.book.id)])] : []),
    [result, seedResults],
  );
  const canWiden = (lastInput.current?.windowYears ?? WINDOW_MAX) < WINDOW_MAX;

  const startSearch = () => {
    setTab("find");
    window.setTimeout(() => document.getElementById("seed-0")?.focus({ preventScroll: true }), 50);
  };

  return (
    <section className="tool-page" aria-labelledby="tool-h">
      <div className="container">
        <div className="tool-head">
          <h1 id="tool-h">{sharedSeeds ? `Comps for books like ${sharedSeeds.join(", ")}` : "Find comps for your book"}</h1>
          <p>Add up to three books yours reads like. Every comp is checked against the rules and shown with its evidence.</p>
        </div>
            <div className="frame" id="tool">
              <div className="frame-bar">
                <span className="frame-title">Nearshelf</span>
                <span className={`status ${qlooReady ? "status-on" : "status-off"}`}>
                  {qlooReady ? "Qloo reader data connected" : "Qloo not connected yet"}
                </span>
              </div>
              <div className="frame-main">
              <div className="sidebar" role="tablist" aria-label="Tool" aria-orientation="vertical">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    id={`tab-${t.id}`}
                    className="side-tab"
                    aria-selected={tab === t.id}
                    aria-controls="tool-panel"
                    onClick={() => setTab(t.id)}
                  >
                    <t.icon size={16} strokeWidth={1.75} aria-hidden="true" />
                    {t.label}
                  </button>
                ))}
                <p className="sidebar-note">{FRAME_NOTE[tab]}</p>
              </div>
              <div className="frame-body" id="tool-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
                {tab === "find" && findPanel()}
                {tab === "check" && <CheckComps windowYears={windowYears} replacement={replacement} />}
                {tab === "llm" &&
                  (phase === "idle" ? (
                    <div className="tool-section">
                      <h2>What a plain LLM said</h2>
                      <p className="muted">Run a search first, then compare. The same seed books go to an LLM with no Qloo access.</p>
                      <div className="row" style={{ marginTop: 16 }}>
                        <button type="button" className="btn btn-primary" onClick={startSearch}>Find comps first</button>
                      </div>
                    </div>
                  ) : (
                    <Baseline data={baseline} loading={baselineLoading} />
                  ))}
              </div>
              </div>
            </div>
      </div>
    </section>
  );

  function findPanel() {
    return (
      <div className="tool-grid">
        <div>
          <section className="tool-section" aria-labelledby="seeds-h">
            <h2 id="seeds-h">Your book reads like</h2>
            <form
              style={{ marginTop: 12 }}
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
              <div className="row form-actions">
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
              {filled.length === 0 && phase !== "running" && <p className="small muted" style={{ marginTop: 8 }}>Add at least one book to start.</p>}
            </form>
            <div className="row presets">
              <span className="small muted">Try one:</span>
              {PRESETS.map((p) => (
                <button key={p.label} type="button" className="preset" disabled={phase === "running"} onClick={() => applyPreset(p)}>
                  <span className="swatch" style={{ background: p.color }} aria-hidden="true" />
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          {phase !== "idle" && (
            <section className="tool-section" aria-label="Progress">
              <ol className="steps" aria-live="polite">
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
              {agent.length > 0 && <AgentLog agent={agent} tools={tools} />}
              {error && (
                <div className={`alert ${error.state === "RATE_LIMITED" ? "alert-wait" : "alert-fail"}`} role="alert" style={{ marginTop: 16 }}>
                  <p>{error.message}</p>
                  {error.retryable && (
                    <button type="button" className="btn btn-primary" onClick={retry}>
                      Try again
                    </button>
                  )}
                </div>
              )}
            </section>
          )}
          {result && <VersusLlm accepted={result.accepted.length} baseline={baseline} loading={baselineLoading} onOpen={() => setTab("llm")} />}
        </div>

        <div>
          {phase === "idle" && <RulesPanel windowYears={windowYears} popularityMax={popularityMax} />}
          {result && (
            <Shelf
              key={result.accepted.map((v) => v.book.id).join()}
              result={result}
              seedTitles={resolvedSeedTitles}
              onWiden={canWiden ? widen : undefined}
            />
          )}
          {sentence && (
            <section className="tool-section" aria-labelledby="sentence-h">
              <h2 id="sentence-h">Your comp line</h2>
              <label htmlFor="my-title" className="small" style={{ marginTop: 12 }}>Your book&apos;s title (optional)</label>
              <input id="my-title" value={myTitle} maxLength={120} onChange={(e) => setMyTitle(e.target.value)} placeholder="My novel" />
              <blockquote className="sentence">{sentence}</blockquote>
              {result?.accepted.length === 1 && (
                <p className="small muted">One comp is weaker than two in a query. Widen the window or add a seed book.</p>
              )}
              <div className="row" style={{ marginTop: 12 }}>
                <button type="button" className="btn btn-primary" onClick={() => copy("sentence", sentence)}>
                  <Copy size={15} strokeWidth={1.75} aria-hidden="true" />
                  {copied === "sentence" ? "Copied" : "Copy line"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => copy("link", window.location.href)}>
                  <Link2 size={15} strokeWidth={1.75} aria-hidden="true" />
                  {copied === "link" ? "Link copied" : "Copy share link"}
                </button>
              </div>
              {copied === "failed" && <p className="small warn" role="status" style={{ marginTop: 8 }}>Your browser blocked copying. Select the text above and copy it by hand.</p>}
            </section>
          )}
          {alsoLoveEnabled && alsoLoveIds.length > 0 && <AlsoLove compIds={alsoLoveIds} />}
        </div>
      </div>
    );
  }
}

const TABS: { id: Tab; label: string; icon: typeof Search }[] = [
  { id: "find", label: "Find comps", icon: Search },
  { id: "check", label: "Check my comps", icon: ListChecks },
  { id: "llm", label: "Compare with an LLM", icon: Scale },
];

const FRAME_NOTE: Record<Tab, string> = {
  find: "Live search on Qloo reader data",
  check: "Same rules as the shelf",
  llm: "Same books, plain LLM, same rules",
};

type Tab = "find" | "check" | "llm";

// Same seeds, same rules: the shelf's count next to the plain LLM's, without leaving the find panel.
function VersusLlm({ accepted, baseline, loading, onOpen }: { accepted: number; baseline: BaselineResponse | null; loading: boolean; onOpen: () => void }) {
  const llm =
    loading || !baseline
      ? "Asking a plain LLM the same question"
      : baseline.state === "CHECKED"
        ? `${baseline.results.filter((r) => r.status === "ACCEPTED").length} of ${baseline.results.length} passed the same rules`
        : baseline.state === "UNCHECKED"
          ? "Answered, but its titles couldn't be checked right now"
          : "Not available right now";
  return (
    <section className="tool-section versus" aria-labelledby="versus-h" aria-busy={loading}>
      <h2 id="versus-h">Nearshelf vs a plain LLM</h2>
      <div className="versus-grid">
        <div className="versus-col">
          <p className="label">Nearshelf</p>
          <p className="versus-num">{accepted} of {accepted} passed</p>
          <p className="small muted">Every comp on the shelf came from Qloo and passed every rule.</p>
        </div>
        <div className="versus-col">
          <p className="label">Plain LLM, same seeds</p>
          <p className="versus-num">{llm}</p>
          <button type="button" className="link-btn small" onClick={onOpen} disabled={loading || !baseline || baseline.state === "UNAVAILABLE"}>
            See each title and why it failed
          </button>
        </div>
      </div>
    </section>
  );
}
