// Enterprise aggregates computed from REAL member cohorts.
//
// This replaces seeded numbers, and it is where the product's central privacy
// promise is kept or broken: an employer sees group patterns and never an
// individual. Two rules do that work.
//
//   COHORT ELIGIBILITY. A member counts only if they consented, at the current
//   consent version, and finished onboarding. `countsTowardCohort` from Phase 1
//   is the single predicate, reused rather than re-derived, so withdrawing
//   consent removes someone from every metric at once.
//
//   K-ANONYMITY. A cohort below K_ANONYMITY_MIN is not reportable. With three
//   people in a group, an average is close to a disclosure — and an employer
//   who knows who those three are can often infer the rest.
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { K_ANONYMITY_MIN } from "@/lib/tenant";
import { CONSENT_VERSION } from "@/lib/intake";
import { DOMAINS, bandFor, type Domain } from "@/lib/scoring/rules";

/** Current period label, e.g. "2026-Q3". */
export function currentPeriod(now = new Date()): string {
  return `${now.getUTCFullYear()}-Q${Math.floor(now.getUTCMonth() / 3) + 1}`;
}

export type ComputedMetric = { metric: string; value: number; cohortSize: number };

export type AggregationResult = {
  tenantId: string;
  period: string;
  eligibleMembers: number;
  totalMembers: number;
  metricsWritten: number;
  /** True when the tenant is too small for ANY metric to be reportable. */
  suppressedEntirely: boolean;
};

/**
 * Recompute every metric for one tenant.
 *
 * Metrics are still WRITTEN when the cohort is too small — the read layer is
 * what suppresses them. Storing them keeps the platform admin's view honest
 * ("this tenant has 4 eligible members") while the enterprise-facing reader in
 * ./read.ts never returns a value or a count for a small cohort. Suppressing at
 * write instead would make "no data" and "too few people" indistinguishable,
 * including to us.
 */
export async function computeTenantMetrics(
  tenantId: string,
  period = currentPeriod(),
): Promise<AggregationResult> {
  const totalMembers = await prisma.user.count({
    where: { tenantId, role: "MEMBER", status: "ACTIVE" },
  });

  const profiles = await prisma.memberProfile.findMany({
    where: {
      tenantId,
      consent: "GRANTED",
      consentVersion: CONSENT_VERSION,
      onboardingCompletedAt: { not: null },
    },
    select: {
      id: true,
      scores: {
        orderBy: { computedAt: "desc" },
        select: { domain: true, score: true, computedAt: true },
      },
    },
  });

  // Newest score per domain per member — the same "latest wins" rule the
  // passport uses, so the employer's aggregate and the member's own view are
  // computed from identical numbers.
  const perMember = profiles.map((p) => {
    const newest = new Map<string, number>();
    for (const s of p.scores) if (!newest.has(s.domain)) newest.set(s.domain, s.score);
    return newest;
  });

  const eligible = perMember.filter((m) => m.size > 0);
  const metrics: ComputedMetric[] = [];

  metrics.push({
    metric: "participation_rate",
    value: totalMembers > 0 ? eligible.length / totalMembers : 0,
    cohortSize: totalMembers,
  });

  const overalls = eligible
    .map((m) => [...m.values()])
    .filter((v) => v.length > 0)
    .map((v) => v.reduce((a, b) => a + b, 0) / v.length);

  if (overalls.length > 0) {
    metrics.push({
      metric: "avg_healthspan_index",
      value: mean(overalls),
      cohortSize: overalls.length,
    });
  }

  for (const d of DOMAINS) {
    const vals = eligible.map((m) => m.get(d)).filter((v): v is number => typeof v === "number");
    if (vals.length === 0) continue;

    metrics.push({ metric: `avg_${d}_index`, value: mean(vals), cohortSize: vals.length });
    // "Risk share" is deliberately the share in the LOW band, not a clinical
    // risk estimate — the product does not compute clinical risk.
    metrics.push({
      metric: `low_band_share_${d}`,
      value: vals.filter((v) => bandFor(v) === "low").length / vals.length,
      cohortSize: vals.length,
    });
  }

  await prisma.$transaction([
    // Replace the period wholesale: a member who withdraws consent must vanish
    // from the metric set, not linger because their row was never overwritten.
    prisma.aggregateMetric.deleteMany({ where: { tenantId, period } }),
    prisma.aggregateMetric.createMany({
      data: metrics.map((m) => ({
        tenantId,
        period,
        metric: m.metric,
        value: Number(m.value.toFixed(4)),
        cohortSize: m.cohortSize,
      })),
    }),
  ]);

  const result: AggregationResult = {
    tenantId,
    period,
    eligibleMembers: eligible.length,
    totalMembers,
    metricsWritten: metrics.length,
    suppressedEntirely: eligible.length < K_ANONYMITY_MIN,
  };
  log.info("analytics.computed", result);
  return result;
}

/** Recompute for every enterprise-shaped tenant. Demo tenants are excluded. */
export async function computeAllTenants(period = currentPeriod()): Promise<AggregationResult[]> {
  const tenants = await prisma.tenant.findMany({
    where: {
      isDemo: false,
      // INDIVIDUAL tenants are single-person by construction (docs/TENANCY.md);
      // aggregating one person is not an aggregate, it is that person's data.
      type: { in: ["ENTERPRISE", "INSURER", "HEALTHCARE", "GOVERNMENT", "CLINIC"] },
    },
    select: { id: true },
  });

  const out: AggregationResult[] = [];
  for (const t of tenants) {
    try {
      out.push(await computeTenantMetrics(t.id, period));
    } catch (err) {
      // One tenant's failure must not abandon the rest.
      log.error("analytics.tenant_failed", err, { tenantId: t.id });
    }
  }
  return out;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export type { Domain };
