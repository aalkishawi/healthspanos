// Stripe integration — checkout, portal, and webhook handling.
//
// INERT WITHOUT KEYS. With no STRIPE_SECRET_KEY, `isConfigured()` is false,
// checkout returns a clear error, and the webhook route refuses. Nothing here
// can move money by accident, and nothing pretends a subscription exists that
// does not.
//
// Called over plain HTTP rather than the Stripe SDK for the same reason as the
// AI providers: three endpoints and a signature check do not justify the
// dependency. The signature verification below is the one piece that must be
// exactly right, so it is implemented explicitly and tested.
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

const API = "https://api.stripe.com/v1";

export function isConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function webhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

/** Price ids come from the Stripe dashboard; without them checkout can't run. */
export const PRICES = {
  MEMBER_PRO: () => process.env.STRIPE_PRICE_MEMBER_PRO ?? "",
  ENTERPRISE_SEATS: () => process.env.STRIPE_PRICE_ENTERPRISE_SEAT ?? "",
};

async function stripeCall(path: string, body: Record<string, string | number>): Promise<Record<string, unknown>> {
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) form.set(k, String(v));

  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
      // Stripe treats a repeated idempotency key as the same request, which
      // matters because a user double-clicking "Subscribe" must not create two
      // subscriptions.
      "idempotency-key": `${path}:${JSON.stringify(body)}`.slice(0, 255),
    },
    body: form.toString(),
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = (json as { error?: { message?: string } })?.error?.message ?? `Stripe ${res.status}`;
    throw new Error(`Stripe error: ${msg}`);
  }
  return json;
}

// ── Checkout ────────────────────────────────────────────────────────────────

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; reason: "not-configured" | "no-price" | "failed"; message: string };

export async function createCheckoutSession(input: {
  tenantId: string;
  email: string;
  plan: "MEMBER_PRO" | "ENTERPRISE_SEATS";
  quantity?: number;
  baseUrl: string;
}): Promise<CheckoutResult> {
  if (!isConfigured()) {
    return { ok: false, reason: "not-configured", message: "Billing is not configured on this deployment." };
  }
  const price = PRICES[input.plan]();
  if (!price) {
    return { ok: false, reason: "no-price", message: `No Stripe price is configured for ${input.plan}.` };
  }

  try {
    const session = await stripeCall("/checkout/sessions", {
      mode: "subscription",
      "line_items[0][price]": price,
      "line_items[0][quantity]": input.quantity ?? 1,
      customer_email: input.email,
      success_url: `${input.baseUrl}/billing?checkout=success`,
      cancel_url: `${input.baseUrl}/billing?checkout=cancelled`,
      // The tenant id travels with the session and comes back on the webhook.
      // Without it we would be guessing which tenant a payment belongs to.
      "metadata[tenantId]": input.tenantId,
      "subscription_data[metadata][tenantId]": input.tenantId,
      client_reference_id: input.tenantId,
    });
    log.info("billing.checkout_created", { tenantId: input.tenantId, plan: input.plan });
    return { ok: true, url: String(session.url) };
  } catch (err) {
    log.error("billing.checkout_failed", err, { tenantId: input.tenantId });
    return { ok: false, reason: "failed", message: "Could not start checkout. Please try again." };
  }
}

/** Stripe-hosted billing portal, so we never handle card details ourselves. */
export async function createPortalSession(customerId: string, baseUrl: string): Promise<CheckoutResult> {
  if (!isConfigured()) {
    return { ok: false, reason: "not-configured", message: "Billing is not configured on this deployment." };
  }
  try {
    const s = await stripeCall("/billing_portal/sessions", {
      customer: customerId,
      return_url: `${baseUrl}/billing`,
    });
    return { ok: true, url: String(s.url) };
  } catch (err) {
    log.error("billing.portal_failed", err, { customerId });
    return { ok: false, reason: "failed", message: "Could not open the billing portal." };
  }
}

// ── Webhook signature ───────────────────────────────────────────────────────

/**
 * Verify Stripe's `Stripe-Signature` header.
 *
 * This is the security boundary of the whole billing system: without it anyone
 * who finds the webhook URL can POST a fabricated `subscription.updated` and
 * grant themselves an enterprise plan. Implemented per Stripe's documented
 * scheme — HMAC-SHA256 over `timestamp.payload` — with two properties that
 * matter:
 *
 *   constant-time comparison, so the signature cannot be discovered byte by byte
 *   a timestamp tolerance, so a captured valid request cannot be replayed later
 */
const TOLERANCE_SECONDS = 300;

export function verifyWebhookSignature(
  payload: string,
  header: string | null,
  secret: string,
  now = Date.now(),
): { valid: boolean; reason?: string } {
  if (!header) return { valid: false, reason: "missing-signature" };

  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, ...rest] = p.split("=");
      return [k?.trim() ?? "", rest.join("=").trim()];
    }),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return { valid: false, reason: "malformed-signature" };

  const age = Math.abs(now / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) {
    return { valid: false, reason: "timestamp-outside-tolerance" };
  }

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return { valid: false, reason: "signature-mismatch" };
  if (!timingSafeEqual(a, b)) return { valid: false, reason: "signature-mismatch" };

  return { valid: true };
}

// ── Webhook application ─────────────────────────────────────────────────────

/** Stripe status strings → our enum. Unknown values fail closed to INCOMPLETE. */
export function mapStatus(stripeStatus: string): "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "INCOMPLETE" {
  switch (stripeStatus) {
    case "trialing": return "TRIALING";
    case "active": return "ACTIVE";
    case "past_due":
    case "unpaid": return "PAST_DUE";
    case "canceled":
    case "incomplete_expired": return "CANCELED";
    default: return "INCOMPLETE";
  }
}

/** Price id → plan. Unrecognised prices do NOT silently grant a paid plan. */
export function planForPrice(priceId: string): "MEMBER_PRO" | "ENTERPRISE_SEATS" | null {
  if (priceId && priceId === PRICES.MEMBER_PRO()) return "MEMBER_PRO";
  if (priceId && priceId === PRICES.ENTERPRISE_SEATS()) return "ENTERPRISE_SEATS";
  return null;
}

export type WebhookOutcome = "applied" | "duplicate" | "ignored" | "error";

/**
 * Record and apply one event.
 *
 * Duplicate suppression is on Stripe's event id, because Stripe retries and
 * does not guarantee exactly-once delivery. Without it a retried event could
 * extend a subscription twice — which reaches customers as free months.
 */
export async function handleEvent(event: {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}): Promise<WebhookOutcome> {
  const existing = await prisma.stripeEvent.findUnique({ where: { eventId: event.id } });
  if (existing?.processedAt) return "duplicate";

  await prisma.stripeEvent.upsert({
    where: { eventId: event.id },
    create: { eventId: event.id, type: event.type },
    update: {},
  });

  try {
    const obj = event.data.object;
    switch (event.type) {
      case "checkout.session.completed": {
        const tenantId = String(obj.client_reference_id ?? (obj.metadata as Record<string, string>)?.tenantId ?? "");
        if (!tenantId) return finish(event.id, "ignored", "no tenant reference on session");
        await upsertSubscription(tenantId, {
          stripeCustomerId: obj.customer ? String(obj.customer) : null,
          stripeSubscriptionId: obj.subscription ? String(obj.subscription) : null,
          status: "ACTIVE",
        });
        return finish(event.id, "applied");
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const tenantId = String((obj.metadata as Record<string, string>)?.tenantId ?? "");
        if (!tenantId) return finish(event.id, "ignored", "no tenantId in subscription metadata");

        const item = (obj.items as { data?: Array<{ price?: { id?: string }; quantity?: number }> })?.data?.[0];
        const plan = planForPrice(String(item?.price?.id ?? ""));
        const status = event.type === "customer.subscription.deleted"
          ? "CANCELED"
          : mapStatus(String(obj.status ?? ""));

        await upsertSubscription(tenantId, {
          stripeCustomerId: obj.customer ? String(obj.customer) : null,
          stripeSubscriptionId: String(obj.id),
          status,
          // A cancelled subscription reverts to FREE rather than keeping a paid
          // plan name with a dead status — entitlements read both, and one
          // source of truth is safer than two that must agree.
          plan: status === "CANCELED" ? "FREE" : (plan ?? undefined),
          seats: item?.quantity ?? undefined,
          currentPeriodEnd: obj.current_period_end
            ? new Date(Number(obj.current_period_end) * 1000)
            : undefined,
          cancelAtPeriodEnd: Boolean(obj.cancel_at_period_end),
        });
        return finish(event.id, "applied");
      }

      default:
        return finish(event.id, "ignored", `unhandled type ${event.type}`);
    }
  } catch (err) {
    log.error("billing.webhook_failed", err, { eventId: event.id, type: event.type });
    await prisma.stripeEvent.update({
      where: { eventId: event.id },
      data: { error: String(err).slice(0, 500) },
    });
    return "error";
  }
}

async function finish(eventId: string, outcome: WebhookOutcome, note?: string): Promise<WebhookOutcome> {
  await prisma.stripeEvent.update({
    where: { eventId },
    data: { processedAt: new Date(), error: note ?? null },
  });
  return outcome;
}

async function upsertSubscription(
  tenantId: string,
  data: {
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    status?: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "INCOMPLETE";
    plan?: "FREE" | "MEMBER_PRO" | "ENTERPRISE_SEATS";
    seats?: number;
    currentPeriodEnd?: Date;
    cancelAtPeriodEnd?: boolean;
  },
): Promise<void> {
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null));
  await prisma.subscription.upsert({
    where: { tenantId },
    create: { tenantId, ...clean },
    update: clean,
  });
  log.info("billing.subscription_updated", { tenantId, status: data.status, plan: data.plan });
}
