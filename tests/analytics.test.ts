// Enterprise analytics privacy. The product's central promise is that an
// employer sees group patterns and never an individual, so the k-anonymity
// rule is asserted directly rather than trusted to each page.
//
// Acceptance for Phase 4: a cohort under the threshold is suppressed, and there
// is no code path from the enterprise portal to identifiable PHI.
import { describe, expect, it } from "vitest";
import { sanitize } from "@/lib/analytics/read";
import { currentPeriod } from "@/lib/analytics/aggregate";
import { K_ANONYMITY_MIN, isCohortReportable } from "@/lib/tenant";

const row = (cohortSize: number, value = 72.5) => ({
  metric: "avg_healthspan_index",
  period: "2026-Q3",
  value,
  cohortSize,
});

describe("k-anonymity suppression", () => {
  it("reports a cohort at or above the threshold", () => {
    const s = sanitize(row(K_ANONYMITY_MIN));
    expect(s.suppressed).toBe(false);
    expect(s.value).toBe(72.5);
    expect(s.cohortSize).toBe(K_ANONYMITY_MIN);
  });

  it("suppresses one member below the threshold", () => {
    const s = sanitize(row(K_ANONYMITY_MIN - 1));
    expect(s.suppressed).toBe(true);
    expect(s.value).toBeNull();
  });

  it("HIDES THE COHORT SIZE TOO, not just the value", () => {
    // The regression this replaces: the table printed "n=3" beside a suppressed
    // value. Telling an employer a hidden group has three people in it is a
    // disclosure — with a headcount they already know, it can identify them.
    const s = sanitize(row(3));
    expect(s.value).toBeNull();
    expect(s.cohortSize).toBeNull();
  });

  it("leaks nothing at all for a single-member cohort", () => {
    const s = sanitize(row(1, 41));
    // Serialise the whole object: no field may carry the value or the size.
    const json = JSON.stringify(s);
    expect(json).not.toContain("41");
    expect(json).not.toContain('"cohortSize":1');
    expect(s.suppressed).toBe(true);
  });

  it("suppresses an empty cohort rather than reporting zero", () => {
    // "0" would read as "our workforce scores zero", which is false.
    expect(sanitize(row(0, 0)).suppressed).toBe(true);
  });

  it.each([0, 1, 2, 5, 9])("suppresses cohort of %i", (n) => {
    expect(sanitize(row(n)).suppressed).toBe(true);
  });

  it.each([10, 11, 50, 5000])("reports cohort of %i", (n) => {
    expect(sanitize(row(n)).suppressed).toBe(false);
  });

  it("agrees with the shared threshold helper", () => {
    for (let n = 0; n < 25; n++) {
      expect(sanitize(row(n)).suppressed).toBe(!isCohortReportable(n));
    }
  });

  it("keeps the metric name and period — those are not personal data", () => {
    const s = sanitize(row(2));
    expect(s.metric).toBe("avg_healthspan_index");
    expect(s.period).toBe("2026-Q3");
  });
});

describe("period labelling", () => {
  it("derives the quarter from the date", () => {
    expect(currentPeriod(new Date(Date.UTC(2026, 0, 15)))).toBe("2026-Q1");
    expect(currentPeriod(new Date(Date.UTC(2026, 3, 1)))).toBe("2026-Q2");
    expect(currentPeriod(new Date(Date.UTC(2026, 7, 2)))).toBe("2026-Q3");
    expect(currentPeriod(new Date(Date.UTC(2026, 11, 31)))).toBe("2026-Q4");
  });

  it("is stable across a quarter", () => {
    expect(currentPeriod(new Date(Date.UTC(2026, 6, 1)))).toBe(
      currentPeriod(new Date(Date.UTC(2026, 8, 30))),
    );
  });
});

describe("threshold configuration", () => {
  it("is high enough to be meaningful", () => {
    // A threshold of 2 or 3 would satisfy the letter of k-anonymity and none of
    // its intent. 10 is the documented product floor.
    expect(K_ANONYMITY_MIN).toBeGreaterThanOrEqual(5);
  });
});
