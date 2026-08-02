// Scoring orchestration: run the pure rules, persist the results, keep history.
//
// The rules live in ./rules.ts and know nothing about the database. This file is
// the only part that writes, which keeps the scoring logic testable without a
// Postgres and keeps persistence concerns out of the rules.
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { IntakeSchema, type Intake } from "@/lib/intake";
import { DOMAINS, overallIndex, scoreAll, type Domain, type DomainScore } from "./rules";
import { derivePlans, initialStatus } from "./plans";

export * from "./rules";
export * from "./plans";

export type ScoringResult = {
  scores: DomainScore[];
  overall: number;
  plansCreated: number;
  plansHeldForReview: number;
};

/**
 * Recompute every domain score for a profile and persist the results.
 *
 * HISTORY IS APPEND-ONLY. Each run inserts a fresh row per domain rather than
 * updating the last one, so `computedAt` gives a real timeline: a member can
 * see that their sleep index moved after they changed their answers, which is
 * the entire point of recomputing. Readers take the newest row per domain.
 *
 * Returns null when the intake is absent or invalid — a member who has not
 * finished onboarding gets no scores rather than scores built from defaults.
 */
export async function recomputeScores(profileId: string): Promise<ScoringResult | null> {
  const profile = await prisma.memberProfile.findUnique({
    where: { id: profileId },
    select: { id: true, tenantId: true, intake: true },
  });
  if (!profile) return null;

  const parsed = IntakeSchema.safeParse(profile.intake);
  if (!parsed.success) {
    // Not an error: onboarding simply isn't finished. Scoring a partial intake
    // would mean scoring form defaults and presenting them as the member's.
    log.info("scoring.skipped_incomplete_intake", { profileId });
    return null;
  }

  const intake: Intake = parsed.data;
  const scores = scoreAll(intake);
  const drafts = derivePlans(intake, scores);

  await prisma.$transaction(async (tx) => {
    await tx.healthspanScore.createMany({
      data: scores.map((s) => ({
        profileId: profile.id,
        domain: s.domain,
        score: s.score,
        band: s.band,
        explanation: s.explanation,
      })),
    });

    // Supersede previous auto-generated plans that are still inactive, so a
    // member who redoes onboarding doesn't accumulate stale advice. ACTIVE and
    // APPROVED plans are left alone — the member (or a reviewer) acted on those,
    // and silently archiving a plan someone approved would undo a human
    // decision.
    await tx.actionPlan.updateMany({
      where: { profileId: profile.id, status: { in: ["DRAFT", "PENDING_SAFETY_REVIEW"] } },
      data: { status: "ARCHIVED" },
    });

    for (const d of drafts) {
      await tx.actionPlan.create({
        data: {
          profileId: profile.id,
          title: d.title,
          summary: d.summary,
          requiresReview: d.requiresReview,
          status: initialStatus(d.requiresReview),
        },
      });
    }

    await tx.auditLog.create({
      data: {
        tenantId: profile.tenantId,
        userId: null,
        action: "scoring.recomputed",
        entity: `member_profile:${profile.id}`,
        // Domain scores are health data; record the shape, not the values.
        meta: { domains: scores.length, plans: drafts.length },
      },
    });
  });

  const held = drafts.filter((d) => d.requiresReview).length;
  log.info("scoring.recomputed", {
    profileId,
    domains: scores.length,
    plans: drafts.length,
    heldForReview: held,
  });

  return {
    scores,
    overall: overallIndex(scores),
    plansCreated: drafts.length,
    plansHeldForReview: held,
  };
}

/**
 * The newest score per domain, for display.
 *
 * Ordered by the canonical DOMAINS order rather than by score, so the passport
 * doesn't reshuffle between visits.
 */
export async function latestScores(profileId: string): Promise<
  { domain: Domain; score: number; band: string; explanation: string; computedAt: Date }[]
> {
  const rows = await prisma.healthspanScore.findMany({
    where: { profileId },
    orderBy: { computedAt: "desc" },
    select: { domain: true, score: true, band: true, explanation: true, computedAt: true },
  });

  const newest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!newest.has(r.domain)) newest.set(r.domain, r);

  return DOMAINS.flatMap((d) => {
    const r = newest.get(d);
    return r ? [{ ...r, domain: d }] : [];
  });
}

/** Score history for one domain, oldest first — for a trend view. */
export async function scoreHistory(
  profileId: string,
  domain: Domain,
  limit = 50,
): Promise<{ score: number; band: string; computedAt: Date }[]> {
  const rows = await prisma.healthspanScore.findMany({
    where: { profileId, domain },
    orderBy: { computedAt: "asc" },
    select: { score: true, band: true, computedAt: true },
    take: limit,
  });
  return rows;
}
