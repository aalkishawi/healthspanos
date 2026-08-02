import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import { askAssistant } from "@/lib/ai/gateway";
import { checkRateLimit, clientKey, rateLimitHeaders, tooManyRequests } from "@/lib/ratelimit";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

const Body = z.object({ question: z.string().min(3).max(1000) });

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  // Keyed on the authenticated user, not IP: this limit exists to bound model
  // spend per account, and colleagues behind one office NAT must not share a
  // budget. Auth has already happened, so the identity is trustworthy.
  const rl = await checkRateLimit("assistant", clientKey(req, `user:${user.id}`));
  if (!rl.success) {
    log.warn("assistant.rate_limited", { userId: user.id, tenantId: user.tenantId });
    return tooManyRequests(rl);
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A question (3-1000 chars) is required." }, { status: 400 });

  try {
    const answer = await askAssistant(parsed.data.question);
    // The question itself is never logged — it is member health context.
    log.info("assistant.answered", { userId: user.id, tenantId: user.tenantId });
    return NextResponse.json(answer, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    log.error("assistant.failed", err, { userId: user.id, tenantId: user.tenantId });
    return NextResponse.json({ error: "The assistant is unavailable right now." }, { status: 502 });
  }
}
