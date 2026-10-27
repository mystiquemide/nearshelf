import { createQlooClient } from "@/lib/qloo/client";
import { alsoLove, alsoLoveEnabled, parseCompIds } from "@/lib/run/also-love";
import { clientIp, sharedLimiter } from "@/lib/run/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!alsoLoveEnabled()) return Response.json({ error: "Not enabled." }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { compIds?: unknown } | null;
  const compIds = parseCompIds(body?.compIds);
  if (!compIds) return Response.json({ error: "Send one to six book IDs." }, { status: 400 });
  if (!sharedLimiter.take(clientIp(req))) return Response.json({ error: "Too many searches from your connection in the last 10 minutes." }, { status: 429 });
  return Response.json(await alsoLove(createQlooClient(), compIds), { headers: { "cache-control": "no-store" } });
}
