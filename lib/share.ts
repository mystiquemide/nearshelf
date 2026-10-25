import type { Book } from "@/lib/qloo/types";
import { clampWindow, WINDOW_DEFAULT } from "@/lib/rules/engine";
import { parseRunInput, type RunInput } from "@/lib/run/input";

// Built only from accepted comps. Returns null instead of a sentence with nothing in it.
export function compSentence(comps: Pick<Book, "title" | "author">[], myTitle?: string): string | null {
  const picks = comps.slice(0, 2).map((c) => (c.author ? `${c.title} by ${c.author}` : c.title));
  if (picks.length === 0) return null;
  const subject = myTitle?.trim() ? myTitle.trim() : "My novel";
  return `${subject} will appeal to readers of ${picks.join(" and ")}.`;
}

// A share link carries only the inputs. Opening it reruns the same query.
export function shareQuery(input: RunInput): string {
  const params = new URLSearchParams();
  for (const s of input.seeds) params.append("s", s);
  if (input.windowYears !== WINDOW_DEFAULT) params.set("w", String(input.windowYears));
  return params.toString();
}

export function parseShareQuery(query: string | URLSearchParams): RunInput | null {
  const params = typeof query === "string" ? new URLSearchParams(query) : query;
  return parseRunInput({ seeds: params.getAll("s"), windowYears: params.has("w") ? clampWindow(params.get("w")) : WINDOW_DEFAULT });
}
