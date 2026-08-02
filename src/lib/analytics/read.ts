// The ONLY way the enterprise portal reads analytics.
//
// Everything an employer can see passes through `enterpriseMetrics`, so
// k-anonymity is enforced in one auditable place rather than in each page that
// happens to remember. If a future surface needs metrics, it calls this — and
// the test suite asserts a small cohort yields neither a value nor a count.
//
// WHY THE COUNT IS HIDDEN TOO. The previous UI suppressed the value but still
// printed "n=3". That is a disclosure on its own: it tells an employer exactly
// how many people are in a group they were not allowed to see, and combined
// with a headcount they usually know, it can identify who. Suppression means
// suppressing the size as well.
import { prisma } from "@/lib/db";
import { K_ANONYMITY_MIN } from "@/lib/tenant";

export type SafeMetric = {
  metric: string;
  period: string;
  /** null when the cohort is below the k-anonymity threshold. */
  value: number | null;
  /** null when suppressed — see the note above. */
  cohortSize: number | null;
  suppressed: boolean;
};

/** Pure so the rule is testable without a database. */
export function sanitize(row: { metric: string; period: string; value: number; cohortSize: number }): SafeMetric {
  const suppressed = row.cohortSize < K_ANONYMITY_MIN;
  return {
    metric: row.metric,
    period: row.period,
    value: suppressed ? null : row.value,
    cohortSize: suppressed ? null : row.cohortSize,
    suppressed,
  };
}

/**
 * Aggregates for ONE tenant, k-anonymised.
 *
 * `tenantId` must come from the caller's session, never from a request
 * parameter — an employer supplying another tenant's id is exactly the attack
 * this signature is shaped to prevent.
 */
export async function enterpriseMetrics(tenantId: string, period?: string): Promise<SafeMetric[]> {
  const rows = await prisma.aggregateMetric.findMany({
    where: { tenantId, ...(period ? { period } : {}) },
    select: { metric: true, period: true, value: true, cohortSize: true },
    orderBy: [{ period: "desc" }, { metric: "asc" }],
  });
  return rows.map(sanitize);
}

/** Periods that have data, newest first — drives a period selector. */
export async function availablePeriods(tenantId: string): Promise<string[]> {
  const rows = await prisma.aggregateMetric.findMany({
    where: { tenantId },
    select: { period: true },
    distinct: ["period"],
    orderBy: { period: "desc" },
  });
  return rows.map((r) => r.period);
}

/**
 * Headline summary for the overview page.
 *
 * Returns `reportable: false` rather than zeros when the tenant is too small —
 * a zero would read as "our workforce scores 0", which is both alarming and
 * false.
 */
export async function enterpriseSummary(tenantId: string, period?: string) {
  const metrics = await enterpriseMetrics(tenantId, period);
  const by = (name: string) => metrics.find((m) => m.metric === name);

  const overall = by("avg_healthspan_index");
  const participation = by("participation_rate");

  return {
    reportable: Boolean(overall && !overall.suppressed),
    overallIndex: overall?.value ?? null,
    participationRate: participation?.value ?? null,
    cohortSize: overall?.cohortSize ?? null,
    threshold: K_ANONYMITY_MIN,
    metrics,
  };
}
