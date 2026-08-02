// Health-score engine. Two acceptance criteria drive this file:
//   1. Two members with different intake get DIFFERENT, EXPLAINABLE scores.
//   2. A high-risk plan cannot activate without reviewer approval.
//
// Everything here is pure — the rules take an intake and return numbers, with
// no database, clock or randomness — so a score is reproducible and a failing
// test points at a rule rather than at infrastructure.
import { describe, expect, it } from "vitest";
import type { Intake } from "@/lib/intake";
import {
  BAND_THRESHOLDS, DOMAINS, bandFor, overallIndex, scoreAll, scoreActivity,
  scoreCardiovascular, scoreCognitive, scoreMetabolic, scoreSleep,
} from "@/lib/scoring/rules";
import { canActivate, derivePlans, goalsToDomains, initialStatus, reviewReasonFor } from "@/lib/scoring/plans";

const HEALTHY: Intake = {
  goals: ["longevity planning"],
  sleep: { averageHours: 8, quality: 5, wakesDuringNight: false },
  activity: { level: "very active", sessionsPerWeek: 5, averageDailySteps: 12000 },
  lifestyle: { diet: "mediterranean", smoking: "never", alcohol: "none", stress: "low" },
  about: {},
};

const STRUGGLING: Intake = {
  goals: ["improve sleep"],
  sleep: { averageHours: 4.5, quality: 1, wakesDuringNight: true },
  activity: { level: "sedentary", sessionsPerWeek: 0, averageDailySteps: 1800 },
  lifestyle: { diet: "other", smoking: "regular", alcohol: "frequent", stress: "very high" },
  about: {},
};

// ── Acceptance 1: different intake → different, explainable scores ──────────

describe("acceptance: two members get different scores", () => {
  it("produces materially different results for different inputs", () => {
    const a = scoreAll(HEALTHY);
    const b = scoreAll(STRUGGLING);
    for (const d of DOMAINS) {
      const ha = a.find((s) => s.domain === d)!;
      const sb = b.find((s) => s.domain === d)!;
      expect(ha.score, `${d} should differ`).not.toBe(sb.score);
      expect(ha.score, `${d}: healthy should score higher`).toBeGreaterThan(sb.score);
    }
  });

  it("separates them at the overall level too", () => {
    expect(overallIndex(scoreAll(HEALTHY))).toBeGreaterThan(overallIndex(scoreAll(STRUGGLING)) + 30);
  });

  it("scores every domain, every time", () => {
    expect(scoreAll(HEALTHY).map((s) => s.domain)).toEqual([...DOMAINS]);
  });

  it("keeps every score inside 0-100", () => {
    for (const intake of [HEALTHY, STRUGGLING]) {
      for (const s of scoreAll(intake)) {
        expect(s.score).toBeGreaterThanOrEqual(0);
        expect(s.score).toBeLessThanOrEqual(100);
      }
    }
  });

  it("is deterministic — same input, same output", () => {
    expect(scoreAll(HEALTHY)).toEqual(scoreAll(HEALTHY));
  });
});

describe("acceptance: scores are explainable", () => {
  it("quotes the member's actual answers back to them", () => {
    const sleep = scoreSleep(STRUGGLING);
    // The explanation must reference real reported values, not generic advice.
    expect(sleep.explanation).toContain("4.5");
    expect(sleep.explanation).toContain("1 out of 5");
    expect(sleep.explanation).toMatch(/wake during the night/i);
  });

  it("arithmetic matches the stated reasons — base 60 plus contributions", () => {
    for (const intake of [HEALTHY, STRUGGLING]) {
      for (const s of scoreAll(intake)) {
        const expected = Math.max(0, Math.min(100,
          Math.round(60 + s.contributions.reduce((t, c) => t + c.points, 0))));
        expect(s.score, `${s.domain} score must equal base + contributions`).toBe(expected);
      }
    }
  });

  it("labels every contribution with the input that caused it", () => {
    for (const s of scoreAll(STRUGGLING)) {
      for (const c of s.contributions) {
        expect(c.label.length, `${s.domain} contribution needs a label`).toBeGreaterThan(0);
        expect(c.because.length, `${s.domain} contribution needs a reason`).toBeGreaterThan(0);
      }
    }
  });

  it("always carries the non-diagnostic framing", () => {
    for (const s of scoreAll(HEALTHY)) {
      expect(s.explanation).toMatch(/not a diagnosis|not a medical assessment/i);
    }
  });

  it("separates what helped from what held the score back", () => {
    const e = scoreActivity(STRUGGLING).explanation;
    expect(e).toMatch(/holding it back/i);
  });
});

// ── Individual domain behaviour ─────────────────────────────────────────────

describe("domain rules", () => {
  it("rewards 7-9h sleep and penalises well outside it", () => {
    const inRange = scoreSleep({ ...HEALTHY, sleep: { averageHours: 8, quality: 3, wakesDuringNight: false } });
    const tooLittle = scoreSleep({ ...HEALTHY, sleep: { averageHours: 4, quality: 3, wakesDuringNight: false } });
    expect(inRange.score).toBeGreaterThan(tooLittle.score);
  });

  it("treats a slight shortfall more gently than a severe one", () => {
    const slight = scoreSleep({ ...HEALTHY, sleep: { averageHours: 6.5, quality: 3, wakesDuringNight: false } });
    const severe = scoreSleep({ ...HEALTHY, sleep: { averageHours: 3, quality: 3, wakesDuringNight: false } });
    expect(slight.score).toBeGreaterThan(severe.score);
  });

  it("penalises smoking most heavily in cardiovascular", () => {
    const never = scoreCardiovascular({ ...HEALTHY, lifestyle: { ...HEALTHY.lifestyle, smoking: "never" } });
    const regular = scoreCardiovascular({ ...HEALTHY, lifestyle: { ...HEALTHY.lifestyle, smoking: "regular" } });
    expect(never.score - regular.score).toBeGreaterThanOrEqual(40);
  });

  it("lets stress dominate the cognitive index", () => {
    const low = scoreCognitive({ ...HEALTHY, lifestyle: { ...HEALTHY.lifestyle, stress: "low" } });
    const veryHigh = scoreCognitive({ ...HEALTHY, lifestyle: { ...HEALTHY.lifestyle, stress: "very high" } });
    expect(low.score).toBeGreaterThan(veryHigh.score);
  });

  it("carries sleep debt into the metabolic index", () => {
    const rested = scoreMetabolic({ ...HEALTHY, sleep: { averageHours: 8, quality: 3, wakesDuringNight: false } });
    const short = scoreMetabolic({ ...HEALTHY, sleep: { averageHours: 5, quality: 3, wakesDuringNight: false } });
    expect(rested.score).toBeGreaterThan(short.score);
  });

  it("bands consistently with the thresholds", () => {
    expect(bandFor(BAND_THRESHOLDS.optimal)).toBe("optimal");
    expect(bandFor(BAND_THRESHOLDS.optimal - 1)).toBe("moderate");
    expect(bandFor(BAND_THRESHOLDS.moderate)).toBe("moderate");
    expect(bandFor(BAND_THRESHOLDS.moderate - 1)).toBe("low");
    expect(bandFor(0)).toBe("low");
    expect(bandFor(100)).toBe("optimal");
  });
});

// ── Acceptance 2: the safety gate ───────────────────────────────────────────

describe("acceptance: a high-risk plan cannot activate without approval", () => {
  it("BLOCKS activation of a review-required plan that is not approved", () => {
    for (const status of ["DRAFT", "PENDING_SAFETY_REVIEW"]) {
      const gate = canActivate({ requiresReview: true, status });
      expect(gate.allowed, `must block from ${status}`).toBe(false);
      expect(gate.reason).toMatch(/approved by a reviewer/i);
    }
  });

  it("ALLOWS it once a reviewer has approved", () => {
    expect(canActivate({ requiresReview: true, status: "APPROVED" }).allowed).toBe(true);
  });

  it("allows an ordinary plan straight from draft", () => {
    expect(canActivate({ requiresReview: false, status: "DRAFT" }).allowed).toBe(true);
  });

  it("refuses to re-activate or resurrect", () => {
    expect(canActivate({ requiresReview: false, status: "ACTIVE" }).allowed).toBe(false);
    expect(canActivate({ requiresReview: false, status: "ARCHIVED" }).allowed).toBe(false);
  });

  it("starts high-risk plans in the review queue, not as drafts", () => {
    expect(initialStatus(true)).toBe("PENDING_SAFETY_REVIEW");
    expect(initialStatus(false)).toBe("DRAFT");
  });
});

describe("what gets flagged for review", () => {
  it("flags current smoking in the cardiovascular plan", () => {
    const reason = reviewReasonFor("cardiovascular", 60, {
      ...HEALTHY, lifestyle: { ...HEALTHY.lifestyle, smoking: "regular" },
    });
    expect(reason).toMatch(/smoking/i);
  });

  it("flags a very low index whatever the domain", () => {
    expect(reviewReasonFor("sleep", 20, HEALTHY)).toMatch(/low enough/i);
  });

  it("flags very high stress combined with disrupted sleep", () => {
    const reason = reviewReasonFor("cognitive", 50, {
      ...HEALTHY,
      sleep: { averageHours: 5, quality: 2, wakesDuringNight: true },
      lifestyle: { ...HEALTHY.lifestyle, stress: "very high" },
    });
    expect(reason).toMatch(/very high stress/i);
  });

  it("does not flag an ordinary middling score", () => {
    expect(reviewReasonFor("activity", 60, HEALTHY)).toBe("");
  });

  it("gives the reviewer a reason, never a bare boolean", () => {
    for (const p of derivePlans(STRUGGLING, scoreAll(STRUGGLING))) {
      if (p.requiresReview) expect(p.reviewReason.length).toBeGreaterThan(20);
      else expect(p.reviewReason).toBe("");
    }
  });
});

// ── Plan derivation ─────────────────────────────────────────────────────────

describe("plan derivation", () => {
  it("generates plans for a struggling member and holds the risky ones", () => {
    const plans = derivePlans(STRUGGLING, scoreAll(STRUGGLING));
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.some((p) => p.requiresReview)).toBe(true);
  });

  it("orders weakest domain first", () => {
    const scores = scoreAll(STRUGGLING);
    const plans = derivePlans(STRUGGLING, scores);
    const byDomain = Object.fromEntries(scores.map((s) => [s.domain, s.score]));
    const ordered = plans.map((p) => byDomain[p.domain]!);
    expect([...ordered].sort((a, b) => a - b)).toEqual(ordered);
  });

  it("includes a domain the member asked about even when it scores well", () => {
    // Healthy member whose stated goal is sleep — they said it mattered.
    const plans = derivePlans(HEALTHY, scoreAll(HEALTHY));
    expect(plans.some((p) => p.domain === "metabolic")).toBe(true); // "longevity planning"
  });

  it("puts the member's own numbers in the plan text", () => {
    const plan = derivePlans(STRUGGLING, scoreAll(STRUGGLING)).find((p) => p.domain === "sleep");
    expect(plan?.summary).toContain("4.5");
  });

  it("carries the non-diagnostic disclaimer on every plan", () => {
    for (const p of derivePlans(STRUGGLING, scoreAll(STRUGGLING))) {
      expect(p.summary).toMatch(/not medical advice/i);
    }
  });

  it("maps goals onto the domains that serve them", () => {
    expect(goalsToDomains(["improve sleep"])).toEqual(["sleep"]);
    expect(goalsToDomains(["stress resilience", "cognitive sharpness"])).toEqual(["cognitive"]);
    expect(goalsToDomains([])).toEqual([]);
  });
});
