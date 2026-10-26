"use client";

import { useState } from "react";
import { describeFailure } from "@/lib/rules/labels";
import type { RunResult } from "./types";

// Spine color comes from the entity ID so the same book always looks the same. It carries no meaning.
function spineHue(id: string) {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h = Math.imul(h ^ (h >>> 15), 0x5bd1e995);
  return ((h ^ (h >>> 13)) >>> 0) % 360;
}

export function Shelf({ result, seedTitles, onWiden }: { result: RunResult; seedTitles: string[]; onWiden?: () => void }) {
  const [openId, setOpenId] = useState<string | null>(result.accepted[0]?.book.id ?? null);
  const open = result.accepted.find((v) => v.book.id === openId) ?? null;

  return (
    <section className="tool-section" aria-labelledby="shelf-h">
      <h2 id="shelf-h">Your comps</h2>
      <p className="muted small">
        Published {result.yearMin} or later
        {result.popularityMax !== null ? `, popularity under ${result.popularityMax.toFixed(2)}` : ", size rule off until calibrated"}. Every book here passed every rule.
      </p>

      {result.accepted.length === 0 ? (
        <div className="empty">
          <p>No comps passed the rules for these seeds. Try a wider window or different seed books.</p>
          {onWiden && <button type="button" className="btn btn-secondary" onClick={onWiden}>Widen to 5 years</button>}
        </div>
      ) : (
        <>
          <ul className="shelf" role="list">
            {result.accepted.map(({ book }) => (
              <li key={book.id}>
                <button
                  type="button"
                  className="spine"
                  style={{ "--hue": spineHue(book.id) } as React.CSSProperties}
                  aria-pressed={book.id === openId}
                  onClick={() => setOpenId(book.id)}
                >
                  <span className="spine-title">{book.title}</span>
                  <span className="spine-author">{book.author ?? ""}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="shelf-board" aria-hidden="true" />
          {result.accepted.length === 1 && (
            <div className="row">
              <p className="small muted">Only one book passed the rules.{onWiden ? " A wider window may find more." : ""}</p>
              {onWiden && <button type="button" className="btn btn-secondary" onClick={onWiden}>Widen to 5 years</button>}
            </div>
          )}
        </>
      )}

      {open && (
        <dl className="evidence" aria-live="polite">
          <div className="evidence-title">
            <strong>{open.book.title}</strong>
            {open.book.author && <span> by {open.book.author}</span>}
          </div>
          <dt>Qloo entity</dt>
          <dd><code>{open.book.id}</code></dd>
          <dt>Published</dt>
          <dd>{open.book.year}</dd>
          <dt>Popularity</dt>
          <dd>{open.book.popularity !== null ? open.book.popularity.toFixed(2) : "not used"}</dd>
          <dt>Readers found from</dt>
          <dd>{seedTitles.join(", ")}</dd>
        </dl>
      )}

      {result.rejected.length > 0 && (
        <details className="rejected">
          <summary>Didn't make it ({result.rejected.length})</summary>
          <ul role="list">
            {result.rejected.map(({ book, failures }) => (
              <li key={`${book.id}-${book.title}`}>
                <span className="book">{book.title}{book.author ? ` by ${book.author}` : ""}</span>
                <span className="reason">{failures.map(describeFailure).join(". ")}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
