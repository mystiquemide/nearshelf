import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface EvalTotals {
  sets: number;
  nearshelfSetsWithThreePlus: number;
  llmTitles: number;
  llmPassed: number;
  llmNotFound: number;
}

// eval/results.json only exists after a real `npm run eval`. Without it the page shows no numbers.
export function loadEvalTotals(): EvalTotals | null {
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "eval", "results.json"), "utf8")) as { totals?: Partial<EvalTotals> };
    const t = raw.totals;
    const keys: (keyof EvalTotals)[] = ["sets", "nearshelfSetsWithThreePlus", "llmTitles", "llmPassed", "llmNotFound"];
    if (!t || !keys.every((k) => typeof t[k] === "number") || t.sets! < 1 || t.llmTitles! < 1) return null;
    return t as EvalTotals;
  } catch {
    return null;
  }
}
