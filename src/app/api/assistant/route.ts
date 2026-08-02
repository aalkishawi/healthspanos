import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import { askAssistant } from "@/lib/ai/gateway";
import { checkRateLimit, clientKey, rateLimitHeaders, tooManyRequests } from "@/lib/ratelimit";
import { log } from "@/lib/logger";
import { assistantQuotaRemaining } from "@/lib/billing/entitlements";

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

  // Plan gate, enforced here rather than only hidden in the UI. Checked before
  // the question is even parsed so a quota-exhausted tenant costs nothing.
  const quota = await assistantQuotaRemaining(user.tenantId);
  if (!quota.unlimited && quota.remaining <= 0) {
    return NextResponse.json(
      {
        error: `You have used all ${quota.limit} assistant questions included this month. Upgrade for unlimited questions.`,
        code: "QUOTA_EXCEEDED",
        used: quota.used,
        limit: quota.limit,
      },
      { status: 402 },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A question (3-1000 chars) is required." }, { status: 400 });

  try {
    const answer = await askAssistant(parsed.data.question, {
      tenantId: user.tenantId,
      userId: user.id,
    });
    // The question itself is never logged — it is member health context.
    log.info("assistant.answered", { userId: user.id, tenantId: user.tenantId });
    return NextResponse.json(answer, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    log.error("assistant.failed", err, { userId: user.id, tenantId: user.tenantId });
    return NextResponse.json({ error: "The assistant is unavailable right now." }, { status: 502 });
  }
}
