// Member intake — the questionnaire that replaces the seeded placeholder JSON.
//
// This is the single source of truth for what onboarding collects. The Zod
// schema validates the API payload, the step definitions drive the UI, and
// Phase 2's scoring engine reads the same shape — so the form and the score
// cannot drift apart.
//
// PHI: every value here is personal health information. It is written to
// MemberProfile.intake (jsonb) and must never be logged (see the redaction list
// in src/lib/logger.ts) nor exposed to an enterprise tenant.
//
// NON-DIAGNOSTIC: these are lifestyle and self-reported wellness inputs. There
// are deliberately no diagnostic questions (symptoms, medications, conditions)
// — collecting them would push the product across the line CLAUDE.md draws.
import { z } from "zod";

export const CONSENT_VERSION = "2026-08-01";

export const GOALS = [
  "improve sleep",
  "metabolic health",
  "cardiovascular fitness",
  "cognitive sharpness",
  "strength & mobility",
  "stress resilience",
  "healthy weight",
  "longevity planning",
] as const;

export const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active", "very active"] as const;
export const STRESS_LEVELS = ["low", "moderate", "high", "very high"] as const;
export const DIET_PATTERNS = ["mixed", "mediterranean", "plant-forward", "vegetarian", "vegan", "low-carb", "other"] as const;
export const SMOKING = ["never", "former", "occasional", "regular"] as const;
export const ALCOHOL = ["none", "occasional", "moderate", "frequent"] as const;

// ── Payload ─────────────────────────────────────────────────────────────────
// Ranges are bounded to physically plausible values: an out-of-range number is
// far more likely to be a typo or a probe than a real answer, and Phase 2 would
// otherwise compute a score from nonsense.

export const IntakeSchema = z.object({
  goals: z.array(z.enum(GOALS)).min(1, "Pick at least one goal.").max(GOALS.length),

  sleep: z.object({
    averageHours: z.number().min(0).max(24),
    // 1 (poor) - 5 (excellent), self-reported.
    quality: z.number().int().min(1).max(5),
    wakesDuringNight: z.boolean(),
  }),

  activity: z.object({
    level: z.enum(ACTIVITY_LEVELS),
    // Structured exercise sessions in a typical week.
    sessionsPerWeek: z.number().int().min(0).max(21),
    averageDailySteps: z.number().int().min(0).max(60_000),
  }),

  lifestyle: z.object({
    diet: z.enum(DIET_PATTERNS),
    smoking: z.enum(SMOKING),
    alcohol: z.enum(ALCOHOL),
    stress: z.enum(STRESS_LEVELS),
  }),

  about: z.object({
    // Optional: not required to produce a score, and some members reasonably
    // decline. Year only — a full date of birth is more identifying than the
    // scoring engine needs.
    birthYear: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
    sex: z.enum(["female", "male", "intersex", "prefer not to say"]).optional(),
  }),
});

export type Intake = z.infer<typeof IntakeSchema>;

// ── Step definitions (drive the multi-step UI) ──────────────────────────────

export const INTAKE_STEPS = [
  { key: "goals", title: "Your goals", blurb: "What do you want your healthspan work to focus on?" },
  { key: "sleep", title: "Sleep", blurb: "Sleep is the strongest single lever in most healthspan programmes." },
  { key: "activity", title: "Activity", blurb: "Movement, both structured and incidental." },
  { key: "lifestyle", title: "Lifestyle", blurb: "Daily patterns that compound over years." },
  { key: "about", title: "About you", blurb: "Optional context that sharpens your results." },
] as const;

export type IntakeStepKey = (typeof INTAKE_STEPS)[number]["key"];

/** Which steps are answered — powers the progress indicator and resume. */
export function completedSteps(partial: unknown): IntakeStepKey[] {
  if (!partial || typeof partial !== "object") return [];
  const p = partial as Record<string, unknown>;
  const done: IntakeStepKey[] = [];
  if (Array.isArray(p.goals) && p.goals.length > 0) done.push("goals");
  for (const k of ["sleep", "activity", "lifestyle", "about"] as const) {
    if (p[k] && typeof p[k] === "object") done.push(k);
  }
  return done;
}

/**
 * Is this intake complete enough to build a passport from?
 *
 * `about` is excluded on purpose — it is optional, and requiring it would block
 * members who decline to give age or sex.
 */
export function isIntakeComplete(intake: unknown): boolean {
  return IntakeSchema.safeParse(intake).success;
}

/**
 * Human-readable summary rows for the passport, derived from the member's OWN
 * answers. Returns [] for an empty intake rather than inventing defaults — the
 * passport shows "finish onboarding" instead of a fabricated profile.
 */
export function summarizeIntake(intake: unknown): { label: string; value: string }[] {
  const parsed = IntakeSchema.safeParse(intake);
  if (!parsed.success) return [];
  const i = parsed.data;
  const rows = [
    { label: "Focus areas", value: i.goals.join(", ") },
    { label: "Average sleep", value: `${i.sleep.averageHours} h/night` },
    { label: "Sleep quality", value: `${i.sleep.quality}/5${i.sleep.wakesDuringNight ? " · wakes during the night" : ""}` },
    { label: "Activity level", value: i.activity.level },
    { label: "Exercise sessions", value: `${i.activity.sessionsPerWeek}/week` },
    { label: "Typical daily steps", value: i.activity.averageDailySteps.toLocaleString() },
    { label: "Diet pattern", value: i.lifestyle.diet },
    { label: "Stress", value: i.lifestyle.stress },
    { label: "Smoking", value: i.lifestyle.smoking },
    { label: "Alcohol", value: i.lifestyle.alcohol },
  ];
  if (i.about.birthYear) {
    rows.push({ label: "Age", value: `${new Date().getFullYear() - i.about.birthYear}` });
  }
  return rows;
}
