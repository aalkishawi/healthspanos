// Emailed credentials: verification links, password resets, invitations.
// These grant account access, so their storage and lifetime rules are asserted
// rather than assumed.
import { describe, expect, it } from "vitest";
import {
  INVALID_TOKEN_MESSAGE, TOKEN_TTL_MS, createToken, hashToken, tokenHashEquals, tokenState,
} from "@/lib/tokens";

describe("token generation", () => {
  it("never returns the same token twice", () => {
    const seen = new Set(Array.from({ length: 500 }, () => createToken("PASSWORD_RESET").raw));
    expect(seen.size).toBe(500);
  });

  it("is long enough to be unguessable", () => {
    // 32 random bytes, base64url — brute force is not a threat model.
    expect(createToken("EMAIL_VERIFICATION").raw.length).toBeGreaterThanOrEqual(40);
  });

  it("is URL-safe, so it survives being put in a link", () => {
    for (let i = 0; i < 100; i++) {
      expect(createToken("INVITATION").raw).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("hashes deterministically and irreversibly", () => {
    const { raw, hash } = createToken("PASSWORD_RESET");
    expect(hashToken(raw)).toBe(hash);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // The stored value must not contain the token — that's the whole point.
    expect(hash).not.toContain(raw);
  });

  it("gives different purposes different lifetimes, shortest for reset", () => {
    // A reset link takes over an account, so it lives the least long.
    expect(TOKEN_TTL_MS.PASSWORD_RESET).toBeLessThan(TOKEN_TTL_MS.EMAIL_VERIFICATION);
    expect(TOKEN_TTL_MS.EMAIL_VERIFICATION).toBeLessThan(TOKEN_TTL_MS.INVITATION);
  });

  it("sets expiry from the purpose", () => {
    const before = Date.now();
    const { expiresAt } = createToken("PASSWORD_RESET");
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + TOKEN_TTL_MS.PASSWORD_RESET - 50);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + TOKEN_TTL_MS.PASSWORD_RESET + 50);
  });
});

describe("constant-time comparison", () => {
  it("matches equal hashes and rejects different ones", () => {
    const h = hashToken("abc");
    expect(tokenHashEquals(h, hashToken("abc"))).toBe(true);
    expect(tokenHashEquals(h, hashToken("abd"))).toBe(false);
  });

  it("does not throw on length mismatch", () => {
    expect(tokenHashEquals("short", hashToken("abc"))).toBe(false);
  });
});

describe("token state", () => {
  const future = new Date(Date.now() + 60_000);
  const past = new Date(Date.now() - 60_000);

  it("accepts an unused, unexpired token", () => {
    expect(tokenState({ expiresAt: future, usedAt: null })).toBe("valid");
  });

  it("rejects an expired token", () => {
    expect(tokenState({ expiresAt: past, usedAt: null })).toBe("expired");
  });

  it("rejects a consumed token — single use", () => {
    expect(tokenState({ expiresAt: future, usedAt: new Date() })).toBe("used");
  });

  it("treats consumed as consumed even before expiry", () => {
    expect(tokenState({ expiresAt: future, usedAt: past })).toBe("used");
  });

  it("rejects a missing token", () => {
    expect(tokenState(null)).toBe("not-found");
  });

  it("treats the exact expiry instant as expired", () => {
    const now = new Date();
    expect(tokenState({ expiresAt: now, usedAt: null }, now)).toBe("expired");
  });
});

describe("failure disclosure", () => {
  it("uses one message for every unusable token", () => {
    // The property that matters is that ONE constant covers every failure mode.
    // Distinguishing expired / already-used / never-existed would tell an
    // attacker whether a guessed token was ever real, and when a real one was
    // consumed. Saying "invalid or has expired" is fine — it names both without
    // revealing which applies. What it must not do is single one out.
    expect(INVALID_TOKEN_MESSAGE).toMatch(/invalid or has expired/i);
    expect(INVALID_TOKEN_MESSAGE).not.toMatch(/already used|not found|unknown token|no such/i);
    // Ambiguity check: the wording covers both states in one breath.
    expect(INVALID_TOKEN_MESSAGE).toMatch(/\bor\b/i);
  });
});
