// What each plan is allowed to do, and the server-side check that enforces it.
//
// Entitlements are read from the LOCAL Subscription projection, not from
// Stripe. Two reasons: a Stripe outage would otherwise take the product down
// for paying customers, and a network round-trip per feature check is not
// something to put in a request path.
//
// The UI hides what a plan cannot use, but hiding is not enforcing. Every gated
// operation calls `requireEntitlement` server-side; the tests assert that a
// FREE tenant is refused even when the request is well-formed.
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

export type Entitlement =
  | "assistant" // research assistant questions
  | "unlimited_assistant" // beyond the free monthly allowance
  | "score_history" // trend view over past recomputes
  | "enterprise_analytics" // aggregate workforce reporting
  | "member_invites"; // inviting members into a tenant

export type PlanName = "FREE" | "MEMBER_PRO" | "ENTERPRISE_SEATS";

// Deliberately additive and explicit rather than hierarchical. A tier ladder
// ("pro includes everything in free") reads well until one plan needs something
// an ostensibly higher plan does not, and then the ladder quietly lies.
const GRANTS: Record<PlanName, Entitlement[]> = {
  FREE: ["assistant"],
  MEMBER_PRO: ["assistant", "unlimited_assistant", "score_history"],
  ENTERPRISE_SEATS: ["assistant", "unlimited_assistant", "score_history", "enterprise_analytics", "member_invites"],
};

/** Free-tier monthly allowance. Enough to evaluate the product honestly. */
export const FREE_ASSISTANT_QUESTIONS_PER_MONTH = 10;

/**
 * Statuses that keep entitlements alive.
 *
 * PAST_DUE deliberately COUNTS as active: a failed card should start a dunning
 * conversation, not instantly cut off access to someone's health record. Stripe
 * moves the subscription to CANCELED when retries are exhausted, and that is
 * when access actually stops.
 */
const LIVE_STATUSES = new Set(["TRIALING", "ACTIVE", "PAST_DUE"]);

export function planEntitlements(plan: PlanName, status: string): Entitlement[] {
  // A plan that is not being paid for falls back to FREE rather than to
  // nothing — an expired subscriber keeps basic access to their own data.
  if (plan !== "FREE" && !LIVE_STATUSES.has(status)) return GRANTS.FREE;
  return GRANTS[plan] ?? GRANTS.FREE;
}

export function planAllows(plan: PlanName, status: string, need: Entitlement): boolean {
  return planEntitlements(plan, status).includes(need);
}

export type TenantEntitlements = {
  plan: PlanName;
  status: string;
  entitlements: Entitlement[];
  seats: number;
  currentPeriodEnd: Date | null;
};

/** Resolve a tenant's live entitlements. A tenant with no row is FREE. */
export async function entitlementsFor(tenantId: string): Promise<TenantEntitlements> {
  const sub = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { plan: true, status: true, seats: true, currentPeriodEnd: true },
  });
  const plan = (sub?.plan ?? "FREE") as PlanName;
  const status = sub?.status ?? "NONE";
  return {
    plan,
    status,
    entitlements: planEntitlements(plan, status),
    seats: sub?.seats ?? 0,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
  };
}

export class EntitlementError extends Error {
  constructor(
    readonly need: Entitlement,
    readonly plan: PlanName,
    message: string,
  ) {
    super(message);
    this.name = "EntitlementError";
  }
}

/**
 * Throw unless the tenant may do this. Call at the TOP of a gated handler,
 * before any work — a check after the side effect is not a gate.
 */
export async function requireEntitlement(tenantId: string, need: Entitlement): Promise<TenantEntitlements> {
  const ent = await entitlementsFor(tenantId);
  if (!ent.entitlements.includes(need)) {
    log.info("billing.entitlement_denied", { tenantId, need, plan: ent.plan });
    throw new EntitlementError(need, ent.plan, `Your ${ent.plan} plan does not include this feature.`);
  }
  return ent;
}

/**
 * Free-tier usage check for the assistant.
 *
 * Counts questions actually asked this month from the audit trail rather than a
 * counter, so it cannot drift out of sync with what happened.
 */
export async function assistantQuotaRemaining(tenantId: string): Promise<{ unlimited: boolean; used: number; limit: number; remaining: number }> {
  const ent = await entitlementsFor(tenantId);
  if (ent.entitlements.includes("unlimited_assistant")) {
    return { unlimited: true, used: 0, limit: Infinity, remaining: Infinity };
  }
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  const used = await prisma.assistantQuery.count({
    where: {
      tenantId,
      createdAt: { gte: start },
      // Refusals and escalations do not consume the allowance — a member should
      // not be charged a question for being told to see a doctor.
      outcome: { in: ["ANSWERED", "NO_EVIDENCE"] },
    },
  });
  const limit = FREE_ASSISTANT_QUESTIONS_PER_MONTH;
  return { unlimited: false, used, limit, remaining: Math.max(0, limit - used) };
}

/** Seat check for B2B invites. FREE and B2C plans cannot invite at all. */
export async function seatsAvailable(tenantId: string): Promise<{ allowed: boolean; used: number; seats: number; reason: string }> {
  const ent = await entitlementsFor(tenantId);
  if (!ent.entitlements.includes("member_invites")) {
    return { allowed: false, used: 0, seats: 0, reason: "Inviting members requires an enterprise plan." };
  }
  const used = await prisma.user.count({ where: { tenantId, role: "MEMBER" } });
  const pending = await prisma.invitation.count({
    where: { tenantId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
  });
  // Outstanding invitations count against seats. Otherwise a tenant could
  // invite far past their allowance and only discover it as people accept.
  const committed = used + pending;
  return {
    allowed: committed < ent.seats,
    used: committed,
    seats: ent.seats,
    reason:
      committed < ent.seats
        ? ""
        : `All ${ent.seats} seat(s) are used or pending. Add seats to invite more people.`,
  };
}
