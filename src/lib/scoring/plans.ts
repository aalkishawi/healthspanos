// Action plans derived from a member's scores and their stated goals.
//
// THE SAFETY GATE IS THE POINT OF THIS FILE.
//
// Most plans are ordinary lifestyle suggestions and can activate immediately.
// A minority touch patterns where generic advice is not appropriate without a
// human looking first — those are marked `requiresReview` and CANNOT be
// activated until a reviewer approves them. `canActivate()` below is the single
// place that rule lives, so no caller can route around it.
//
// What makes a plan high-risk here is a *reported pattern*, never an inferred
// diagnosis. We do not decide someone has a condition; we notice that
// boilerplate advice could be wrong for what they told us, and route it to a
// person.
import type { Intake } from "@/lib/intake";
import type { Domain, DomainScore } from "./rules";

export type PlanDraft = {
  title: string;
  summary: string;
  domain: Domain;
  requiresReview: boolean;
  /** Why review is needed. Empty when it isn't. Shown to the reviewer. */
  reviewReason: string;
};

// Below this a domain is weak enough to warrant a plan at all.
const SUGGEST_BELOW = 70;
// Below this the pattern is pronounced enough that generic advice needs a human.
const REVIEW_BELOW = 35;

const NON_DIAGNOSTIC =
  "This is general lifestyle guidance, not medical advice, and it is not a diagnosis.";

/**
 * Should this plan be held for human review?
 *
 * Pure and exported so the gate is directly testable and so the reasons are
 * enumerable rather than buried in branching.
 */
export function reviewReasonFor(domain: Domain, score: number, intake: Intake): string {
  // A very low index means the generic advice may be inadequate for what the
  // member described, whatever the domain.
  if (score < REVIEW_BELOW) {
    return `The ${domain} index is ${score}, low enough that standard lifestyle guidance may not be appropriate without a clinician's view.`;
  }
  // Smoking cessation is the clearest case: useful advice here is clinical,
  // and a generic "cut down" plan is both unhelpful and potentially harmful.
  if (domain === "cardiovascular" && ["regular", "occasional"].includes(intake.lifestyle.smoking)) {
    return "The member reports current smoking. Cessation guidance should be reviewed by a clinician rather than auto-generated.";
  }
  // Very high stress plus badly disrupted sleep is a pattern where "sleep
  // hygiene tips" can be the wrong response.
  if (
    intake.lifestyle.stress === "very high" &&
    (intake.sleep.averageHours < 6 || intake.sleep.quality <= 2)
  ) {
    return "The member reports very high stress alongside disrupted sleep. Generic sleep guidance may not address what is going on.";
  }
  return "";
}

const TEMPLATES: Record<Domain, (i: Intake, s: DomainScore) => { title: string; summary: string }> = {
  sleep: (i) => ({
    title: "Build a more consistent sleep window",
    summary:
      `You reported averaging ${i.sleep.averageHours} hours with quality ${i.sleep.quality}/5` +
      `${i.sleep.wakesDuringNight ? " and waking during the night" : ""}. ` +
      "Aim for a fixed wake time seven days a week, daylight within an hour of waking, and a wind-down " +
      `period without screens. ${NON_DIAGNOSTIC}`,
  }),
  activity: (i) => ({
    title: "Add movement in small, repeatable increments",
    summary:
      `You reported ${i.activity.sessionsPerWeek} structured session(s) a week and about ` +
      `${i.activity.averageDailySteps.toLocaleString()} steps a day. Add one short walk after your ` +
      `largest meal and one extra session a week before increasing intensity. ${NON_DIAGNOSTIC}`,
  }),
  metabolic: (i) => ({
    title: "Steady your daily energy pattern",
    summary:
      `Based on your ${i.lifestyle.diet} diet, ${i.lifestyle.alcohol} alcohol intake and current ` +
      "activity, focus on protein and fibre at each meal, and keep eating windows consistent day to " +
      `day. ${NON_DIAGNOSTIC}`,
  }),
  cardiovascular: (i) => ({
    title: "Grow your aerobic base",
    summary:
      `You reported ${i.activity.sessionsPerWeek} session(s) a week and ${i.lifestyle.smoking} smoking. ` +
      "Build toward 150 minutes a week of moderate activity you can hold a conversation through, " +
      `adding no more than 10% a week. ${NON_DIAGNOSTIC}`,
  }),
  cognitive: (i) => ({
    title: "Protect recovery and attention",
    summary:
      `You described ${i.lifestyle.stress} stress and sleep quality of ${i.sleep.quality}/5. ` +
      "Anchor one daily period without input — a walk without headphones counts — and keep a " +
      `consistent wind-down. ${NON_DIAGNOSTIC}`,
  }),
};

/**
 * Derive plans for the domains that need attention.
 *
 * Goals matter twice: a domain the member explicitly asked about is included
 * even when its score is decent, because they said it mattered to them.
 */
export function derivePlans(intake: Intake, scores: DomainScore[]): PlanDraft[] {
  const wanted = new Set(goalsToDomains(intake.goals));

  return scores
    .filter((s) => s.score < SUGGEST_BELOW || wanted.has(s.domain))
    .sort((a, b) => a.score - b.score) // weakest first — most useful at the top
    .map((s) => {
      const { title, summary } = TEMPLATES[s.domain](intake, s);
      const reviewReason = reviewReasonFor(s.domain, s.score, intake);
      return {
        title,
        summary,
        domain: s.domain,
        requiresReview: reviewReason !== "",
        reviewReason,
      };
    });
}

/** Map the member's chosen goals onto the domains that serve them. */
export function goalsToDomains(goals: Intake["goals"]): Domain[] {
  const map: Record<string, Domain> = {
    "improve sleep": "sleep",
    "metabolic health": "metabolic",
    "cardiovascular fitness": "cardiovascular",
    "cognitive sharpness": "cognitive",
    "strength & mobility": "activity",
    "stress resilience": "cognitive",
    "healthy weight": "metabolic",
    "longevity planning": "metabolic",
  };
  return [...new Set(goals.map((g) => map[g]).filter(Boolean) as Domain[])];
}

// ── The activation gate ─────────────────────────────────────────────────────

export type PlanState = { requiresReview: boolean; status: string };

/**
 * May this plan become ACTIVE?
 *
 * The whole safety promise reduces to this function: a plan that requires
 * review must have been APPROVED by a reviewer first. Everything else — the
 * API route, the UI button — defers to it, so there is exactly one place to
 * audit and exactly one place a bug could live.
 */
export function canActivate(plan: PlanState): { allowed: boolean; reason: string } {
  if (plan.status === "ACTIVE") return { allowed: false, reason: "This plan is already active." };
  if (plan.status === "ARCHIVED") return { allowed: false, reason: "Archived plans cannot be activated." };
  if (plan.requiresReview && plan.status !== "APPROVED") {
    return {
      allowed: false,
      reason: "This plan involves medical or high-risk content and must be approved by a reviewer before it can be activated.",
    };
  }
  return { allowed: true, reason: "" };
}

/** The status a freshly derived plan starts in. */
export function initialStatus(requiresReview: boolean): "DRAFT" | "PENDING_SAFETY_REVIEW" {
  return requiresReview ? "PENDING_SAFETY_REVIEW" : "DRAFT";
}
