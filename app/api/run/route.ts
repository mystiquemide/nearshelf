import { createQlooClient } from "@/lib/qloo/client";
import { createOpenLibraryClient } from "@/lib/openlibrary/client";
import { parseRunInput, type RunEvent } from "@/lib/run/pipeline";
import { nvidiaModel, runAgent } from "@/lib/agent/agent";
import { clientIp, sharedLimiter } from "@/lib/run/rate-limit";
import { popularityCeiling } from "@/lib/run/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Send JSON with a seeds array." }, { status: 400 });
  }
  const input = parseRunInput(body);
  if (!input) return Response.json({ error: "Send one to three titles, each under 200 characters." }, { status: 400 });

  if (!sharedLimiter.take(clientIp(req))) {
    const event: RunEvent = { type: "error", state: "RATE_LIMITED", reason: "rate_limited", message: "Too many searches from your connection in the last 10 minutes. Try again in a minute.", retryable: true };
    return new Response(JSON.stringify(event) + "\n", { status: 429, headers: { "content-type": "application/x-ndjson" } });
  }

  const deps = { qloo: createQlooClient(), openLibrary: createOpenLibraryClient(), popularityMax: popularityCeiling() };
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const event of runAgent(input, deps, nvidiaModel())) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}
