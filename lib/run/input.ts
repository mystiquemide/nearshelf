// No server imports here: the browser uses this to read share links.
import { clampWindow } from "@/lib/rules/engine";

export const MAX_SEEDS = 3;
export const MAX_TITLE_LENGTH = 200;

export interface RunInput {
  seeds: string[];
  windowYears: number;
}

// Seeds are plain data. They only ever reach search params, never a prompt.
export function parseRunInput(body: unknown): RunInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { seeds?: unknown; windowYears?: unknown };
  if (!Array.isArray(b.seeds)) return null;
  const seeds = b.seeds
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter((s) => s.length > 0);
  if (seeds.length === 0 || seeds.length > MAX_SEEDS || b.seeds.length > MAX_SEEDS) return null;
  if (seeds.some((s) => s.length > MAX_TITLE_LENGTH)) return null;
  return { seeds: [...new Set(seeds)], windowYears: clampWindow(b.windowYears ?? undefined) };
}
