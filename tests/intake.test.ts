// Member intake — the questionnaire that replaces the seeded placeholder.
// Validation matters twice over: it is the trust boundary for a client-supplied
// payload, and Phase 2 computes health scores from whatever gets through.
import { describe, expect, it } from "vitest";
import {
  CONSENT_VERSION, IntakeSchema, completedSteps, isIntakeComplete, summarizeIntake,
} from "@/lib/intake";

const VALID = {
  goals: ["improve sleep", "metabolic health"],
  sleep: { averageHours: 7.5, quality: 4, wakesDuringNight: false },
  activity: { level: "moderate", sessionsPerWeek: 3, averageDailySteps: 8200 },
  lifestyle: { diet: "mediterranean", smoking: "never", alcohol: "occasional", stress: "moderate" },
  about: { birthYear: 1990, sex: "female" },
};

describe("intake validation", () => {
  it("accepts a complete answer set", () => {
    expect(IntakeSchema.safeParse(VALID).success).toBe(true);
  });

  it("requires at least one goal", () => {
    const r = IntakeSchema.safeParse({ ...VALID, goals: [] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toMatch(/at least one/i);
  });

  it("rejects goals outside the offered list", () => {
    expect(IntakeSchema.safeParse({ ...VALID, goals: ["cure cancer"] }).success).toBe(false);
  });

  it("rejects physically impossible sleep", () => {
    // 25h/night is a typo or a probe, and Phase 2 would score it as real.
    expect(IntakeSchema.safeParse({ ...VALID, sleep: { ...VALID.sleep, averageHours: 25 } }).success).toBe(false);
    expect(IntakeSchema.safeParse({ ...VALID, sleep: { ...VALID.sleep, averageHours: -1 } }).success).toBe(false);
  });

  it("bounds sleep quality to the 1-5 scale shown in the UI", () => {
    expect(IntakeSchema.safeParse({ ...VALID, sleep: { ...VALID.sleep, quality: 0 } }).success).toBe(false);
    expect(IntakeSchema.safeParse({ ...VALID, sleep: { ...VALID.sleep, quality: 6 } }).success).toBe(false);
  });

  it("rejects implausible step counts and session counts", () => {
    expect(IntakeSchema.safeParse({ ...VALID, activity: { ...VALID.activity, averageDailySteps: 500_000 } }).success).toBe(false);
    expect(IntakeSchema.safeParse({ ...VALID, activity: { ...VALID.activity, sessionsPerWeek: 40 } }).success).toBe(false);
  });

  it("treats `about` as optional — declining age or sex must not block onboarding", () => {
    const r = IntakeSchema.safeParse({ ...VALID, about: {} });
    expect(r.success).toBe(true);
  });

  it("rejects a birth year in the future", () => {
    const next = new Date().getFullYear() + 1;
    expect(IntakeSchema.safeParse({ ...VALID, about: { birthYear: next } }).success).toBe(false);
  });

  it("rejects junk payloads outright", () => {
    for (const junk of [null, undefined, "", 42, [], { goals: "sleep" }]) {
      expect(IntakeSchema.safeParse(junk).success).toBe(false);
    }
  });
});

describe("completeness", () => {
  it("recognises a full intake", () => {
    expect(isIntakeComplete(VALID)).toBe(true);
  });

  it("does not accept a partial one", () => {
    expect(isIntakeComplete({ goals: ["improve sleep"] })).toBe(false);
    expect(isIntakeComplete(null)).toBe(false);
  });

  it("tracks which steps are answered, for resume", () => {
    expect(completedSteps(null)).toEqual([]);
    expect(completedSteps({ goals: ["improve sleep"] })).toEqual(["goals"]);
    expect(completedSteps(VALID)).toEqual(["goals", "sleep", "activity", "lifestyle", "about"]);
  });

  it("does not count an empty goals array as answered", () => {
    expect(completedSteps({ goals: [] })).toEqual([]);
  });
});

describe("passport summary", () => {
  it("derives rows from the member's OWN answers", () => {
    const rows = summarizeIntake(VALID);
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.value]));
    expect(byLabel["Average sleep"]).toBe("7.5 h/night");
    expect(byLabel["Typical daily steps"]).toBe((8200).toLocaleString());
    expect(byLabel["Focus areas"]).toContain("improve sleep");
  });

  it("returns nothing for an incomplete intake rather than inventing defaults", () => {
    // The passport must show "finish onboarding", never a fabricated profile.
    expect(summarizeIntake(null)).toEqual([]);
    expect(summarizeIntake({ goals: ["improve sleep"] })).toEqual([]);
  });

  it("omits age when the member declined to give a birth year", () => {
    const rows = summarizeIntake({ ...VALID, about: {} });
    expect(rows.some((r) => r.label === "Age")).toBe(false);
  });
});

describe("consent version", () => {
  it("is a dated identifier so re-consent can be required when terms change", () => {
    expect(CONSENT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
