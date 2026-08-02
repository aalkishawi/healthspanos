import { NextResponse } from "next/server";
import { handleEvent, verifyWebhookSignature, webhookConfigured } from "@/lib/billing/stripe";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook receiver.
 *
 * Unauthenticated by necessity — Stripe cannot hold a session — so the SIGNATURE
 * is the entire security boundary. Without STRIPE_WEBHOOK_SECRET this refuses
 * every request rather than trusting the body: an open webhook lets anyone POST
 * a fabricated subscription.updated and grant themselves an enterprise plan.
 */
export async function POST(req: Request) {
  if (!webhookConfigured()) {
    log.error("billing.webhook_unconfigured", new Error("STRIPE_WEBHOOK_SECRET unset"));
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  // Raw body: the signature is over exact bytes, so parsing first would break it.
  const payload = await req.text();
  const check = verifyWebhookSignature(
    payload,
    req.headers.get("stripe-signature"),
    process.env.STRIPE_WEBHOOK_SECRET!,
  );
  if (!check.valid) {
    log.warn("billing.webhook_rejected", { reason: check.reason });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const outcome = await handleEvent(event);
  // Always 200 for a verified event, even on internal error: a non-2xx makes
  // Stripe retry, and retrying a bug produces the same bug plus noise. The
  // failure is recorded on StripeEvent.error for us to fix.
  return NextResponse.json({ received: true, outcome });
}
