// Account rules that protect members: password policy, cohort eligibility, and
// the non-disclosure guarantees signup/reset depend on.
//
// These are the pure, dependency-free parts of src/lib/accounts.ts. The
// database-backed flows are exercised end-to-end against a real Postgres in CI.
import { describe, expect, it } from "vitest";
import {
  EmailSchema, NEUTRAL_ACK, NameSchema, PasswordSchema, countsTowardCohort, hashPassword,
  verifyPassword,
} from "@/lib/accounts";
import { CONSENT_VERSION } from "@/lib/intake";

describe("password policy", () => {
  it("accepts a long passphrase", () => {
    expect(PasswordSchema.safeParse("correct horse battery staple").success).toBe(true);
  });

  it("rejects anything under 10 characters", () => {
    expect(PasswordSchema.safeParse("Sh0rt!").success).toBe(false);
  });

  it("rejects the passwords that get guessed first", () => {
    for (const p of ["password123", "12345678", "changeme", "healthspan"]) {
      expect(PasswordSchema.safeParse(p).success, p).toBe(false);
    }
  });

  it("rejects low-variety strings that pass a length check", () => {
    // "aaaaaaaaaaaa" is 12 chars and worthless.
    expect(PasswordSchema.safeParse("aaaaaaaaaaaa").success).toBe(false);
  });

  it("does not impose composition rules that push people to 'Password1!'", () => {
    // No required symbol/digit/uppercase — length and variety carry the policy.
    expect(PasswordSchema.safeParse("the quiet mountain road").success).toBe(true);
  });

  it("caps length so a huge input can't be used to burn bcrypt CPU", () => {
    expect(PasswordSchema.safeParse("x".repeat(5000)).success).toBe(false);
  });
});

describe("password hashing", () => {
  it("round-trips and never stores the plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toContain("correct");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong horse battery staple", hash)).toBe(false);
  });

  it("salts — the same password hashes differently every time", async () => {
    const a = await hashPassword("correct horse battery staple");
    const b = await hashPassword("correct horse battery staple");
    expect(a).not.toBe(b);
  });
});

describe("email normalisation", () => {
  it("lowercases and trims, so casing can't create a duplicate account", () => {
    expect(EmailSchema.parse("  Member@Example.COM ")).toBe("member@example.com");
  });

  it("rejects malformed addresses", () => {
    for (const e of ["nope", "a@", "@b.com", ""]) {
      expect(EmailSchema.safeParse(e).success, e).toBe(false);
    }
  });
});

describe("name validation", () => {
  it("trims and requires something", () => {
    expect(NameSchema.parse("  Ada Lovelace ")).toBe("Ada Lovelace");
    expect(NameSchema.safeParse("   ").success).toBe(false);
  });
});

describe("account enumeration", () => {
  it("uses one acknowledgement that reveals nothing either way", () => {
    // Signup, resend and forgot-password all return this, hit or miss. For a
    // health product, confirming someone has an account is itself a disclosure.
    expect(NEUTRAL_ACK.message).toMatch(/if that address/i);
    expect(NEUTRAL_ACK.message).not.toMatch(/exists|not found|already registered|unknown/i);
  });
});

describe("aggregate cohort eligibility", () => {
  const eligible = {
    consent: "GRANTED",
    consentVersion: CONSENT_VERSION,
    onboardingCompletedAt: new Date(),
  };

  it("includes a consenting, onboarded member", () => {
    expect(countsTowardCohort(eligible)).toBe(true);
  });

  it("excludes a member who withdrew consent — the revocation promise", () => {
    expect(countsTowardCohort({ ...eligible, consent: "WITHDRAWN" })).toBe(false);
  });

  it("excludes a member who never consented", () => {
    expect(countsTowardCohort({ ...eligible, consent: "PENDING" })).toBe(false);
  });

  it("excludes consent given against an older version of the terms", () => {
    // Re-consent is required when the text changes; an old agreement must not
    // silently authorise new processing.
    expect(countsTowardCohort({ ...eligible, consentVersion: "2020-01-01" })).toBe(false);
  });

  it("excludes a member who hasn't finished onboarding", () => {
    // No inputs means nothing real to aggregate.
    expect(countsTowardCohort({ ...eligible, onboardingCompletedAt: null })).toBe(false);
  });
});
