import { createQlooClient } from "@/lib/qloo/client";
import { createOpenLibraryClient } from "@/lib/openlibrary/client";
import { parseRunInput, runComps, type RunEvent } from "@/lib/run/pipeline";
import { createRateLimiter } from "@/lib/run/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createRateLimiter(20, 10 * 60 * 1000);

// Unset until Phase 0 calibrates it from real data (BR-002). Unset means the size rule is off.
function popularityCeiling(): number | null {
  const n = Number(process.env.POPULARITY_MAX);
  return process.env.POPULARITY_MAX && Number.isFinite(n) && n > 0 && n <= 1 ? n : null;
}

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Send JSON with a seeds array." }, { status: 400 });
  }
  const input = parseRunInput(body);
  if (!input) return Response.json({ error: "Send one to three titles, each under 200 characters." }, { status: 400 });

  if (!limiter.take(clientIp(req))) {
    const event: RunEvent = { type: "error", state: "RATE_LIMITED", reason: "rate_limited", message: "Too many requests. Try again in a minute.", retryable: true };
    return new Response(JSON.stringify(event) + "\n", { status: 429, headers: { "content-type": "application/x-ndjson" } });
  }

  const deps = { qloo: createQlooClient(), openLibrary: createOpenLibraryClient(), popularityMax: popularityCeiling() };
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const event of runComps(input, deps)) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}
