// Billing: entitlements and webhook security.
//
// Two things carry real risk here. Entitlements decide who gets what, and the
// webhook signature is the only thing standing between a stranger with the URL
// and a free enterprise plan. Both are asserted directly.
import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import {
  FREE_ASSISTANT_QUESTIONS_PER_MONTH,
  planAllows,
  planEntitlements,
} from "@/lib/billing/entitlements";
import { mapStatus, planForPrice, verifyWebhookSignature } from "@/lib/billing/stripe";

// ── Entitlements ────────────────────────────────────────────────────────────

describe("plan entitlements", () => {
  it("gives FREE the assistant but not the paid features", () => {
    expect(planAllows("FREE", "NONE", "assistant")).toBe(true);
    expect(planAllows("FREE", "NONE", "unlimited_assistant")).toBe(false);
    expect(planAllows("FREE", "NONE", "enterprise_analytics")).toBe(false);
    expect(planAllows("FREE", "NONE", "member_invites")).toBe(false);
  });

  it("gives MEMBER_PRO unlimited questions and history, but not employer features", () => {
    expect(planAllows("MEMBER_PRO", "ACTIVE", "unlimited_assistant")).toBe(true);
    expect(planAllows("MEMBER_PRO", "ACTIVE", "score_history")).toBe(true);
    // A consumer subscription must not unlock workforce analytics.
    expect(planAllows("MEMBER_PRO", "ACTIVE", "enterprise_analytics")).toBe(false);
    expect(planAllows("MEMBER_PRO", "ACTIVE", "member_invites")).toBe(false);
  });

  it("gives ENTERPRISE_SEATS the employer features", () => {
    expect(planAllows("ENTERPRISE_SEATS", "ACTIVE", "enterprise_analytics")).toBe(true);
    expect(planAllows("ENTERPRISE_SEATS", "ACTIVE", "member_invites")).toBe(true);
  });

  it("keeps access alive while a payment is being retried", () => {
    // PAST_DUE must not instantly cut someone off from their own health record;
    // Stripe moves it to CANCELED once retries are exhausted.
    expect(planAllows("MEMBER_PRO", "PAST_DUE", "unlimited_assistant")).toBe(true);
  });

  it("falls back to FREE — not to nothing — when a subscription ends", () => {
    // An expired subscriber keeps basic access to their own data.
    const ents = planEntitlements("MEMBER_PRO", "CANCELED");
    expect(ents).toContain("assistant");
    expect(ents).not.toContain("unlimited_assistant");
  });

  it.each(["CANCELED", "INCOMPLETE", "NONE"])("treats %s as unpaid", (status) => {
    expect(planAllows("ENTERPRISE_SEATS", status, "enterprise_analytics")).toBe(false);
  });

  it("does not let an unknown plan grant anything extra", () => {
    expect(planEntitlements("NOT_A_PLAN" as never, "ACTIVE")).toEqual(planEntitlements("FREE", "NONE"));
  });

  it("has a free allowance big enough to evaluate the product", () => {
    expect(FREE_ASSISTANT_QUESTIONS_PER_MONTH).toBeGreaterThanOrEqual(5);
  });
});

// ── Webhook signature: the security boundary ────────────────────────────────

const SECRET = "whsec_test_secret";

function sign(payload: string, at = Date.now(), secret = SECRET): string {
  const t = Math.floor(at / 1000);
  const v1 = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

describe("webhook signature verification", () => {
  const payload = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated" });

  it("accepts a correctly signed, fresh request", () => {
    expect(verifyWebhookSignature(payload, sign(payload), SECRET).valid).toBe(true);
  });

  it("REJECTS an unsigned request", () => {
    // Without this, anyone who finds the URL can grant themselves a plan.
    const r = verifyWebhookSignature(payload, null, SECRET);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("missing-signature");
  });

  it("REJECTS a forged signature", () => {
    const forged = `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}`;
    expect(verifyWebhookSignature(payload, forged, SECRET).valid).toBe(false);
  });

  it("REJECTS a signature made with the wrong secret", () => {
    expect(verifyWebhookSignature(payload, sign(payload, Date.now(), "wrong"), SECRET).valid).toBe(false);
  });

  it("REJECTS a tampered payload signed for the original", () => {
    const header = sign(payload);
    const tampered = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated", hacked: true });
    expect(verifyWebhookSignature(tampered, header, SECRET).valid).toBe(false);
  });

  it("REJECTS a replayed old request", () => {
    // A captured valid request must not work an hour later.
    const old = sign(payload, Date.now() - 3600_000);
    const r = verifyWebhookSignature(payload, old, SECRET);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("timestamp-outside-tolerance");
  });

  it("rejects a malformed header rather than throwing", () => {
    for (const h of ["", "garbage", "t=123", "v1=abc", "t=,v1="]) {
      expect(verifyWebhookSignature(payload, h, SECRET).valid).toBe(false);
    }
  });

  it("tolerates small clock skew in both directions", () => {
    expect(verifyWebhookSignature(payload, sign(payload, Date.now() - 60_000), SECRET).valid).toBe(true);
    expect(verifyWebhookSignature(payload, sign(payload, Date.now() + 60_000), SECRET).valid).toBe(true);
  });
});

// ── Status and price mapping ────────────────────────────────────────────────

describe("stripe status mapping", () => {
  it("maps the documented statuses", () => {
    expect(mapStatus("active")).toBe("ACTIVE");
    expect(mapStatus("trialing")).toBe("TRIALING");
    expect(mapStatus("past_due")).toBe("PAST_DUE");
    expect(mapStatus("unpaid")).toBe("PAST_DUE");
    expect(mapStatus("canceled")).toBe("CANCELED");
  });

  it("fails CLOSED on an unknown status", () => {
    // A status we do not recognise must not be treated as paid.
    expect(mapStatus("something_new")).toBe("INCOMPLETE");
    expect(mapStatus("")).toBe("INCOMPLETE");
  });
});

describe("price to plan mapping", () => {
  it("refuses to grant a plan for an unrecognised price", () => {
    // Otherwise a subscription to any price at all would unlock a paid tier.
    expect(planForPrice("price_not_ours")).toBeNull();
    expect(planForPrice("")).toBeNull();
  });
});
