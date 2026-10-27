import type { RuleFailure } from "./engine";

const pct = (n: unknown) => (typeof n === "number" ? n.toFixed(3) : "?");

// Adds decimals until a failing score no longer rounds to the ceiling ("0.9953", not "0.995").
function popularityOver(value: unknown, limit: unknown): string {
  if (typeof value !== "number" || typeof limit !== "number") return pct(value);
  for (let d = 3; d < 6; d++) if (value.toFixed(d) !== limit.toFixed(d)) return value.toFixed(d);
  return value.toFixed(6);
}

// What the author reads next to a rejected title. Names the rule and the value that failed.
export function describeFailure(f: RuleFailure): string {
  switch (f.rule) {
    case "too_old":
      return `Too old: published ${f.value}, window starts ${f.limit}`;
    case "too_big":
      return `Too big: popularity ${popularityOver(f.value, f.limit)}, ceiling ${pct(f.limit)}`;
    case "is_seed":
      return "One of your own books";
    case "duplicate":
      return "Already on the shelf";
    case "year_unknown":
      return "No publication year on record";
    case "popularity_unknown":
      return "No popularity score on record";
    case "not_qloo_entity":
      return "Not a Qloo book";
  }
}
