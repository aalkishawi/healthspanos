// Healthspan domain scoring — the rules themselves.
//
// DESIGN CONTRACT
// ---------------
// 1. PURE. No database, no clock, no randomness. Same intake in, same scores
//    out, forever. That is what makes a score reproducible when a member asks
//    "why did this change?" — the answer is always "because your inputs did".
//
// 2. EVERY POINT IS TRACEABLE. A score is not a formula that emits a number; it
//    is a base plus a list of named Contributions, each carrying the input that
//    caused it. The explanation is GENERATED from that list, so an explanation
//    can never drift from the arithmetic that produced the score.
//
// 3. NON-DIAGNOSTIC, AND THE RULES ARE SHAPED TO STAY THAT WAY. These are
//    lifestyle-pattern indices built from self-reported habits. They are not
//    clinical risk scores, they do not estimate disease probability, and no
//    input here is a symptom, medication or diagnosis. Wording is deliberately
//    about *habits* ("your reported sleep is below the 7-9h range"), never
//    about the person's health status ("you are at risk of...").
//
// 4. THE THRESHOLDS ARE PRODUCT DEFAULTS, NOT CLINICAL GUIDANCE. They are
//    directional, chosen to reflect broadly uncontroversial public-health
//    orientation (more movement is better than less; 7-9h sleep is the common
//    adult recommendation; smoking is negative). They are NOT derived from a
//    validated instrument and must not be presented as one. Phase 3's evidence
//    base is where citations belong; Phase 7 is where a clinician reviews this
//    file. Until then the UI says non-diagnostic on every surface.
import type { Intake } from "@/lib/intake";

export const DOMAINS = ["sleep", "activity", "metabolic", "cardiovascular", "cognitive"] as const;
export type Domain = (typeof DOMAINS)[number];

export type Band = "low" | "moderate" | "optimal";

/** One named, signed adjustment traceable to a specific answer. */
export type Contribution = {
  /** Short label for the UI. */
  label: string;
  /** Signed points applied to the domain base. */
  points: number;
  /** The member's actual answer that caused it — quoted back to them. */
  because: string;
};

export type DomainScore = {
  domain: Domain;
  score: number; // 0-100
  band: Band;
  contributions: Contribution[];
  explanation: string;
};

// Every domain starts here and moves on evidence from the member's answers. A
// neutral base means a score reflects reported habits, not an assumption about
// someone we know nothing about.
const BASE = 60;

export const BAND_THRESHOLDS = { optimal: 75, moderate: 45 } as const;

export function bandFor(score: number): Band {
  if (score >= BAND_THRESHOLDS.optimal) return "optimal";
  if (score >= BAND_THRESHOLDS.moderate) return "moderate";
  return "low";
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function assemble(domain: Domain, contributions: Contribution[]): DomainScore {
  const score = clamp(BASE + contributions.reduce((sum, c) => sum + c.points, 0));
  return {
    domain,
    score,
    band: bandFor(score),
    contributions,
    explanation: explain(domain, score, bandFor(score), contributions),
  };
}

/**
 * Plain-language rationale, generated from the contributions that actually
 * applied. Never a canned string: if the arithmetic changes, this changes.
 */
function explain(domain: Domain, score: number, band: Band, contributions: Contribution[]): string {
  const label = DOMAIN_LABELS[domain];
  if (contributions.length === 0) {
    return `Your ${label} index is ${score} (${band}). Nothing you reported moved it from the neutral starting point.`;
  }
  const helped = contributions.filter((c) => c.points > 0);
  const hurt = contributions.filter((c) => c.points < 0);

  const parts: string[] = [`Your ${label} index is ${score} (${band}).`];
  if (helped.length) {
    parts.push(`Working in your favour: ${helped.map((c) => c.because).join("; ")}.`);
  }
  if (hurt.length) {
    parts.push(`Holding it back: ${hurt.map((c) => c.because).join("; ")}.`);
  }
  parts.push("This is a lifestyle indicator based on what you reported — not a diagnosis or a medical assessment.");
  return parts.join(" ");
}

export const DOMAIN_LABELS: Record<Domain, string> = {
  sleep: "sleep",
  activity: "activity",
  metabolic: "metabolic habits",
  cardiovascular: "cardiovascular habits",
  cognitive: "cognitive habits",
};

// ── Sleep ───────────────────────────────────────────────────────────────────

export function scoreSleep(i: Intake): DomainScore {
  const c: Contribution[] = [];
  const h = i.sleep.averageHours;

  if (h >= 7 && h <= 9) {
    c.push({ label: "Duration", points: 18, because: `you average ${h} hours, inside the commonly recommended 7-9 hour range` });
  } else if (h >= 6 && h < 7) {
    c.push({ label: "Duration", points: -8, because: `you average ${h} hours, a little under the 7-9 hour range` });
  } else if (h > 9 && h <= 10) {
    c.push({ label: "Duration", points: -4, because: `you average ${h} hours, a little over the 7-9 hour range` });
  } else {
    c.push({ label: "Duration", points: -18, because: `you average ${h} hours, well outside the 7-9 hour range` });
  }

  // 3/5 is neutral; each step either side moves 7 points.
  const q = i.sleep.quality;
  if (q !== 3) {
    c.push({
      label: "Quality",
      points: (q - 3) * 7,
      because: `you rated your sleep quality ${q} out of 5`,
    });
  }

  if (i.sleep.wakesDuringNight) {
    c.push({ label: "Continuity", points: -10, because: "you usually wake during the night" });
  }

  return assemble("sleep", c);
}

// ── Activity ────────────────────────────────────────────────────────────────

const ACTIVITY_POINTS: Record<Intake["activity"]["level"], number> = {
  sedentary: -20,
  light: -8,
  moderate: 6,
  active: 14,
  "very active": 18,
};

export function scoreActivity(i: Intake): DomainScore {
  const c: Contribution[] = [];
  const a = i.activity;

  c.push({
    label: "Overall level",
    points: ACTIVITY_POINTS[a.level],
    because: `you describe yourself as ${a.level}`,
  });

  if (a.sessionsPerWeek >= 5) {
    c.push({ label: "Structured exercise", points: 16, because: `you train ${a.sessionsPerWeek} times a week` });
  } else if (a.sessionsPerWeek >= 3) {
    c.push({ label: "Structured exercise", points: 10, because: `you train ${a.sessionsPerWeek} times a week` });
  } else if (a.sessionsPerWeek >= 1) {
    c.push({ label: "Structured exercise", points: 2, because: `you train ${a.sessionsPerWeek} time(s) a week` });
  } else {
    c.push({ label: "Structured exercise", points: -12, because: "you reported no structured exercise sessions" });
  }

  const s = a.averageDailySteps;
  if (s >= 10_000) c.push({ label: "Daily steps", points: 14, because: `you average about ${s.toLocaleString()} steps a day` });
  else if (s >= 7_500) c.push({ label: "Daily steps", points: 9, because: `you average about ${s.toLocaleString()} steps a day` });
  else if (s >= 5_000) c.push({ label: "Daily steps", points: 2, because: `you average about ${s.toLocaleString()} steps a day` });
  else c.push({ label: "Daily steps", points: -12, because: `you average about ${s.toLocaleString()} steps a day, below roughly 5,000` });

  return assemble("activity", c);
}

// ── Metabolic ───────────────────────────────────────────────────────────────
// Diet pattern, alcohol, movement and sleep debt — the reported habits most
// commonly discussed in relation to metabolic health. No labs, no BMI, no
// clinical markers: none of that is collected, and inferring it would be
// exactly the diagnostic overreach this product refuses.

const DIET_POINTS: Record<Intake["lifestyle"]["diet"], number> = {
  mediterranean: 16,
  "plant-forward": 12,
  vegetarian: 8,
  vegan: 8,
  "low-carb": 6,
  mixed: 0,
  other: 0,
};

const ALCOHOL_POINTS: Record<Intake["lifestyle"]["alcohol"], number> = {
  none: 8,
  occasional: 2,
  moderate: -6,
  frequent: -18,
};

export function scoreMetabolic(i: Intake): DomainScore {
  const c: Contribution[] = [];

  const dietPts = DIET_POINTS[i.lifestyle.diet];
  if (dietPts !== 0) {
    c.push({ label: "Diet pattern", points: dietPts, because: `you follow a ${i.lifestyle.diet} diet` });
  }

  c.push({
    label: "Alcohol",
    points: ALCOHOL_POINTS[i.lifestyle.alcohol],
    because: `you report ${i.lifestyle.alcohol} alcohol intake`,
  });

  if (i.activity.averageDailySteps >= 7_500) {
    c.push({ label: "Daily movement", points: 8, because: "your daily step count supports metabolic health" });
  } else if (i.activity.averageDailySteps < 5_000) {
    c.push({ label: "Daily movement", points: -10, because: "your daily step count is on the low side" });
  }

  // Short sleep is one of the better-established lifestyle associations with
  // metabolic markers, so it carries across domains rather than staying siloed.
  if (i.sleep.averageHours < 6) {
    c.push({ label: "Sleep debt", points: -10, because: `averaging ${i.sleep.averageHours} hours of sleep works against metabolic recovery` });
  }

  return assemble("metabolic", c);
}

// ── Cardiovascular ──────────────────────────────────────────────────────────

const SMOKING_POINTS: Record<Intake["lifestyle"]["smoking"], number> = {
  never: 10,
  former: 2,
  occasional: -18,
  regular: -32,
};

export function scoreCardiovascular(i: Intake): DomainScore {
  const c: Contribution[] = [];

  c.push({
    label: "Smoking",
    points: SMOKING_POINTS[i.lifestyle.smoking],
    because:
      i.lifestyle.smoking === "never"
        ? "you have never smoked"
        : `you report ${i.lifestyle.smoking} smoking`,
  });

  if (i.activity.sessionsPerWeek >= 3) {
    c.push({ label: "Aerobic training", points: 14, because: `you train ${i.activity.sessionsPerWeek} times a week` });
  } else if (i.activity.sessionsPerWeek === 0) {
    c.push({ label: "Aerobic training", points: -10, because: "you reported no structured exercise" });
  }

  if (i.activity.averageDailySteps >= 7_500) {
    c.push({ label: "Daily movement", points: 8, because: `about ${i.activity.averageDailySteps.toLocaleString()} steps a day` });
  }

  const dietPts = DIET_POINTS[i.lifestyle.diet];
  if (dietPts > 0) {
    c.push({ label: "Diet pattern", points: Math.round(dietPts / 2), because: `a ${i.lifestyle.diet} diet` });
  }

  return assemble("cardiovascular", c);
}

// ── Cognitive ───────────────────────────────────────────────────────────────

const STRESS_POINTS: Record<Intake["lifestyle"]["stress"], number> = {
  low: 12,
  moderate: 0,
  high: -14,
  "very high": -24,
};

export function scoreCognitive(i: Intake): DomainScore {
  const c: Contribution[] = [];

  c.push({
    label: "Stress",
    points: STRESS_POINTS[i.lifestyle.stress],
    because: `you describe your typical stress as ${i.lifestyle.stress}`,
  });

  if (i.sleep.quality >= 4) {
    c.push({ label: "Sleep quality", points: 12, because: `you rated sleep quality ${i.sleep.quality} out of 5` });
  } else if (i.sleep.quality <= 2) {
    c.push({ label: "Sleep quality", points: -14, because: `you rated sleep quality ${i.sleep.quality} out of 5` });
  }

  if (i.activity.sessionsPerWeek >= 3) {
    c.push({ label: "Exercise", points: 8, because: "regular exercise supports cognitive habits" });
  }

  if (i.lifestyle.alcohol === "frequent") {
    c.push({ label: "Alcohol", points: -12, because: "you report frequent alcohol intake" });
  }

  return assemble("cognitive", c);
}

// ── All domains ─────────────────────────────────────────────────────────────

const SCORERS: Record<Domain, (i: Intake) => DomainScore> = {
  sleep: scoreSleep,
  activity: scoreActivity,
  metabolic: scoreMetabolic,
  cardiovascular: scoreCardiovascular,
  cognitive: scoreCognitive,
};

/** Score every domain. Order is stable so UI and tests can rely on it. */
export function scoreAll(intake: Intake): DomainScore[] {
  return DOMAINS.map((d) => SCORERS[d](intake));
}

/**
 * A single headline figure, the mean of the domains.
 *
 * Deliberately NOT called a "healthspan score" or presented as an age: both
 * imply a clinical estimate this cannot support. It is an average of five
 * lifestyle indices and is labelled as such.
 */
export function overallIndex(scores: DomainScore[]): number {
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((s, d) => s + d.score, 0) / scores.length);
}
