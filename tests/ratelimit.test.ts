// Rate limiting — the brute-force and model-cost guard on /api/auth/* and
// /api/assistant. Exercises the in-process backend (the one CI and local dev
// use); the Upstash path is the same interface with a distributed store.
import { beforeEach, describe, expect, it } from "vitest";
import {
  POLICIES,
  __resetMemoryLimiter,
  checkRateLimit,
  clientKey,
  limiterBackend,
  rateLimitHeaders,
  tooManyRequests,
} from "@/lib/ratelimit";

function req(headers: Record<string, string> = {}): Request {
  return new Request("https://example.test/api/auth/login", { headers });
}

beforeEach(() => {
  __resetMemoryLimiter();
});

describe("client identification", () => {
  it("uses the first hop of x-forwarded-for", () => {
    // Vercel appends proxies; the client is the leftmost entry.
    expect(clientKey(req({ "x-forwarded-for": "203.0.113.9, 70.41.3.18" }))).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip", () => {
    expect(clientKey(req({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
  });

  it("buckets unidentifiable callers rather than exempting them", () => {
    // A request with no IP must still be bounded — shared bucket, not bypass.
    expect(clientKey(req())).toBe("unknown");
  });

  it("namespaces by suffix so one IP has separate budgets per surface", () => {
    const h = { "x-forwarded-for": "203.0.113.9" };
    expect(clientKey(req(h), "auth")).not.toBe(clientKey(req(h), "user:123"));
  });
});

describe("auth policy (brute-force guard)", () => {
  it("allows requests up to the limit then blocks", async () => {
    const { tokens } = POLICIES.auth;
    for (let i = 0; i < tokens; i++) {
      const r = await checkRateLimit("auth", "1.2.3.4");
      expect(r.success, `request ${i + 1} of ${tokens} should be allowed`).toBe(true);
    }
    const blocked = await checkRateLimit("auth", "1.2.3.4");
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("counts down remaining", async () => {
    const first = await checkRateLimit("auth", "5.6.7.8");
    const second = await checkRateLimit("auth", "5.6.7.8");
    expect(second.remaining).toBe(first.remaining - 1);
  });

  it("isolates callers — one attacker cannot lock everyone out", async () => {
    for (let i = 0; i < POLICIES.auth.tokens + 5; i++) {
      await checkRateLimit("auth", "attacker");
    }
    const victim = await checkRateLimit("auth", "legitimate-user");
    expect(victim.success).toBe(true);
  });

  it("isolates policies — burning the auth budget leaves the assistant usable", async () => {
    for (let i = 0; i < POLICIES.auth.tokens + 1; i++) {
      await checkRateLimit("auth", "same-key");
    }
    expect((await checkRateLimit("assistant", "same-key")).success).toBe(true);
  });
});

describe("429 response", () => {
  it("carries Retry-After and RateLimit headers", async () => {
    for (let i = 0; i < POLICIES.auth.tokens; i++) await checkRateLimit("auth", "9.9.9.9");
    const blocked = await checkRateLimit("auth", "9.9.9.9");

    const res = tooManyRequests(blocked);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(res.headers.get("RateLimit-Limit")).toBe(String(POLICIES.auth.tokens));
  });

  it("does not leak internals in the body", async () => {
    for (let i = 0; i < POLICIES.auth.tokens; i++) await checkRateLimit("auth", "8.8.8.8");
    const body = await tooManyRequests(await checkRateLimit("auth", "8.8.8.8")).json();
    expect(body.error).toMatch(/too many requests/i);
    expect(JSON.stringify(body)).not.toMatch(/redis|upstash|stack/i);
  });

  it("reports a non-negative reset even when the window has passed", () => {
    const headers = rateLimitHeaders({
      success: false, limit: 10, remaining: 0, reset: Date.now() - 60_000,
    });
    expect(Number(headers["RateLimit-Reset"])).toBeGreaterThanOrEqual(0);
  });
});

describe("backend selection", () => {
  it("reports in-memory when Upstash is unconfigured", () => {
    // Guards the honesty requirement: the health endpoint must not claim
    // distributed limiting when only the per-instance fallback is live.
    const expected = process.env.UPSTASH_REDIS_REST_URL ? "upstash" : "in-memory";
    expect(limiterBackend()).toBe(expected);
  });

  it("limits for real on the fallback — it is not a permissive stub", async () => {
    let allowed = 0;
    for (let i = 0; i < POLICIES.assistant.tokens * 2; i++) {
      if ((await checkRateLimit("assistant", "burst")).success) allowed++;
    }
    expect(allowed).toBe(POLICIES.assistant.tokens);
  });
});
