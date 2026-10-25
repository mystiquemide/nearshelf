import { createQlooClient } from "@/lib/qloo/client";
import { createOpenLibraryClient } from "@/lib/openlibrary/client";
import { checkTitles, parseCheckTitles } from "@/lib/run/check";
import { errorEvent } from "@/lib/run/pipeline";
import { popularityCeiling } from "@/lib/run/config";
import { clientIp, sharedLimiter } from "@/lib/run/rate-limit";
import { clampWindow } from "@/lib/rules/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { titles?: unknown; windowYears?: unknown } | null;
  const titles = parseCheckTitles(body?.titles);
  if (!titles) return Response.json({ error: "Send one to five titles, each under 200 characters." }, { status: 400 });
  if (!sharedLimiter.take(clientIp(req))) return Response.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });

  const cfg = { currentYear: new Date().getFullYear(), windowYears: clampWindow(body?.windowYears ?? undefined), popularityMax: popularityCeiling() };
  try {
    const results = await checkTitles(titles, { qloo: createQlooClient(), openLibrary: createOpenLibraryClient() }, cfg);
    return Response.json({ results }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    const e = errorEvent(err);
    return Response.json({ error: e.message, reason: e.reason, retryable: e.retryable }, { status: e.state === "RATE_LIMITED" ? 429 : 502 });
  }
}
