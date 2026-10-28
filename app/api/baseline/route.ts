import { createQlooClient } from "@/lib/qloo/client";
import { createOpenLibraryClient } from "@/lib/openlibrary/client";
import { BaselineError, plainLlmComps } from "@/lib/llm/baseline";
import { checkTitles } from "@/lib/run/check";
import { errorEvent, parseRunInput } from "@/lib/run/pipeline";
import { popularityCeiling } from "@/lib/run/config";
import { clientIp, sharedLimiter } from "@/lib/run/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The plain-LLM panel. Its failures never affect the main run.
export async function POST(req: Request) {
  const input = parseRunInput(await req.json().catch(() => null));
  if (!input) return Response.json({ error: "Send one to three titles, each under 200 characters." }, { status: 400 });
  if (!sharedLimiter.take(clientIp(req))) return Response.json({ error: "You've run a lot of searches in the last 10 minutes. Wait a few minutes, then try again." }, { status: 429 });

  let llm;
  try {
    llm = await plainLlmComps(input.seeds);
  } catch (err) {
    if (!(err instanceof BaselineError)) console.error("baseline failed", err);
    return Response.json({ state: "UNAVAILABLE", message: "The plain-LLM comparison isn't available right now." }, { status: 503 });
  }

  const cfg = { currentYear: new Date().getFullYear(), windowYears: input.windowYears, popularityMax: popularityCeiling() };
  try {
    const results = await checkTitles(llm.titles, { qloo: createQlooClient(), openLibrary: createOpenLibraryClient() }, cfg, input.seeds);
    return Response.json({ state: "CHECKED", model: llm.model, thinking: llm.thinking, results }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    // The LLM answered but Qloo couldn't check it. Show the titles as unchecked, never as verdicts.
    const e = errorEvent(err);
    return Response.json({ state: "UNCHECKED", model: llm.model, thinking: llm.thinking, titles: llm.titles, message: e.message }, { headers: { "cache-control": "no-store" } });
  }
}
