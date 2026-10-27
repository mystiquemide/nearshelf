"use client";

import { useEffect, useState } from "react";
import type { AlsoLove as AlsoLoveData } from "@/lib/run/also-love";

const SECTIONS: { key: keyof AlsoLoveData; label: string }[] = [
  { key: "podcasts", label: "Podcasts" },
  { key: "shows", label: "TV shows" },
];

// Where to find these readers outside bookstores, for ads and newsletter swaps.
export function AlsoLove({ compIds }: { compIds: string[] }) {
  const [data, setData] = useState<AlsoLoveData | null>(null);
  const [state, setState] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
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
  }, [compIds]);

  return (
    <section className="tool-section" aria-labelledby="also-h" aria-busy={state === "loading"}>
      <h2 id="also-h">Readers of these comps also love</h2>
      <p className="muted small">From Qloo, based on your books and your top comps. Useful for ad targeting and newsletter swaps.</p>
      {state === "loading" && <p className="muted">Asking Qloo</p>}
      {state === "error" && <p className="muted">This isn't available right now.</p>}
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
