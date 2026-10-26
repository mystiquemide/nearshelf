import { QlooError, type CrossDomainType, type NamedEntity, type QlooClient } from "@/lib/qloo/client";

export const ALSO_LOVE_TYPES: { key: "podcasts" | "shows" | "artists"; type: CrossDomainType }[] = [
  { key: "podcasts", type: "urn:entity:podcast" },
  { key: "shows", type: "urn:entity:tv_show" },
  { key: "artists", type: "urn:entity:artist" },
];

export type AlsoLove = Record<(typeof ALSO_LOVE_TYPES)[number]["key"], NamedEntity[] | null>;

const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,100}$/;

// Accepts at most three comp IDs from the client. They only become Qloo signals, never displayed text.
export function parseCompIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 3) return null;
  return raw.every((id) => typeof id === "string" && ID_PATTERN.test(id)) ? [...new Set(raw as string[])] : null;
}

// Each domain is fetched on its own so one failure leaves the others standing (null = unavailable).
export async function alsoLove(qloo: QlooClient, compIds: string[]): Promise<AlsoLove> {
  const settled = await Promise.allSettled(ALSO_LOVE_TYPES.map((t) => qloo.crossDomainInsights(t.type, compIds, 5)));
  const out = {} as AlsoLove;
  ALSO_LOVE_TYPES.forEach((t, i) => {
    const r = settled[i]!;
    if (r.status === "fulfilled") out[t.key] = r.value;
    else {
      if (!(r.reason instanceof QlooError)) console.error("also-love failed", r.reason);
      out[t.key] = null;
    }
  });
  return out;
}

export function alsoLoveEnabled(): boolean {
  return process.env.ALSO_LOVE === "on";
}
