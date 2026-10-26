"use client";

import { useState } from "react";
import { VerdictRow } from "./verdict";
import type { CheckResult } from "./types";

export function CheckComps({ windowYears, replacement }: { windowYears: number; replacement: string | null }) {
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [results, setResults] = useState<CheckResult[]>([]);
  const [error, setError] = useState("");

  const titles = text.split("\n").map((t) => t.trim()).filter(Boolean);

  async function check() {
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ titles, windowYears }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't check these titles.");
      setResults(body.results);
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't check these titles.");
      setState("error");
    }
  }

  return (
    <section className="tool-section" aria-labelledby="check-h">
      <h2 id="check-h">Check my comps</h2>
      <p className="muted small">Paste the comps you already have, one per line, up to five. Same rules as the shelf.</p>
      <label className="sr-only" htmlFor="check-input">Your comp titles</label>
      <textarea id="check-input" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Fourth Wing\nThe Bee Sting"} />
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={titles.length === 0 || titles.length > 5 || state === "loading"} onClick={check}>
          {state === "loading" ? "Checking" : "Check them"}
        </button>
        {titles.length > 5 && <span className="small warn">Five titles at most.</span>}
      </div>
      {state === "error" && <p className="alert alert-fail" role="alert">{error}</p>}
      {state === "done" && (
        <ul className="verdicts" role="list" aria-live="polite">
          {results.map((r, i) => <VerdictRow key={i} r={r} replacement={replacement} />)}
        </ul>
      )}
    </section>
  );
}
