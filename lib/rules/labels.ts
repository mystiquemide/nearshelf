import type { RuleFailure } from "./engine";

const pct = (n: unknown) => (typeof n === "number" ? n.toFixed(3) : "?");

// What the author reads next to a rejected title. Names the rule and the value that failed.
export function describeFailure(f: RuleFailure): string {
  switch (f.rule) {
    case "too_old":
      return `Too old: published ${f.value}, window starts ${f.limit}`;
    case "too_big":
      return `Too big: popularity ${pct(f.value)}, ceiling ${pct(f.limit)}`;
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
