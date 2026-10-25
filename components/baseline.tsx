import { VerdictRow } from "./verdict";
import type { BaselineResponse } from "./types";

export function Baseline({ data, loading }: { data: BaselineResponse | null; loading: boolean }) {
  return (
    <section className="panel baseline" aria-labelledby="baseline-h" aria-busy={loading}>
      <h2 id="baseline-h">What a plain LLM said</h2>
      {loading && <p className="muted">Asking the model the same question</p>}
      {!loading && data?.state === "UNAVAILABLE" && <p className="muted">{data.message}</p>}
      {!loading && data && data.state !== "UNAVAILABLE" && (
        <>
          <p className="muted small">
            Same seeds, live, <code>{data.model}</code>
            {data.thinking ? "" : " with thinking off"}. Each title checked with the same rules.
          </p>
          {data.state === "CHECKED" ? (
            data.results.length ? (
              <ul className="verdicts" role="list">
                {data.results.map((r, i) => <VerdictRow key={i} r={r} />)}
              </ul>
            ) : (
              <p className="muted">The model didn't return any titles we could read.</p>
            )
          ) : (
            <>
              <p className="warn small">Not checked: {data.message}</p>
              <ul className="verdicts" role="list">
                {data.titles.map((t, i) => (
                  <li key={i} className="verdict">
                    <span className="chip chip-unchecked">Unchecked</span>
                    <span className="book">{t.title}{t.author ? ` by ${t.author}` : ""}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
