"use client";

import { useEffect, useState } from "react";
import type { AlsoLove as AlsoLoveData } from "@/lib/run/also-love";

const SECTIONS: { key: keyof AlsoLoveData; label: string }[] = [
  { key: "podcasts", label: "Podcasts" },
  { key: "shows", label: "TV shows" },
];

export type AlsoLoveState = { state: "loading" | "done" | "error"; data: AlsoLoveData | null };

// Fetched once per run; the result can be shown in more than one place.
export function useAlsoLove(compIds: string[], enabled: boolean): AlsoLoveState | null {
  const [data, setData] = useState<AlsoLoveData | null>(null);
  const [state, setState] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    if (!enabled || compIds.length === 0) return;
    let live = true;
    setState("loading");
    fetch("/api/also-love", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ compIds }) })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return (await r.json()) as AlsoLoveData;
      })
      .then((d) => live && (setData(d), setState("done")))
      .catch(() => live && setState("error"));
    return () => {
      live = false;
    };
  }, [compIds, enabled]);

  return enabled && compIds.length > 0 ? { state, data } : null;
}

// Where to find these readers outside bookstores, for ads and newsletter swaps.
export function AlsoLove({ value, className }: { value: AlsoLoveState | null; className?: string }) {
  if (!value) return null;
  const { state, data } = value;

  // Qloo has no cross-domain signal for some books. Hide the section rather than show empty boxes.
  if (state === "error" || (state === "done" && data && SECTIONS.every(({ key }) => !data[key]?.length))) return null;

  return (
    <section className={`tool-section ${className ?? ""}`} aria-label="Readers of these comps also love" aria-busy={state === "loading"}>
      <h2>Readers of these comps also love</h2>
      <p className="muted small">From Qloo, based on your books and your top comps. Useful for ad targeting and newsletter swaps.</p>
      {state === "loading" && <p className="muted">Asking Qloo</p>}
      {state === "done" && data && (
        <div className="also">
          {SECTIONS.map(({ key, label }) => (
            <div key={key}>
              <h3>{label}</h3>
              {data[key] === null ? (
                <p className="small muted">Unavailable</p>
              ) : data[key]!.length === 0 ? (
                <p className="small muted">Nothing found</p>
              ) : (
                <ul role="list">{data[key]!.map((e) => <li key={e.id}>{e.name}</li>)}</ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
