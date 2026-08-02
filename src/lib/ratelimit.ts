// Rate limiting for abuse-prone endpoints (auth brute-force, AI cost burn).
//
// Two backends, chosen by configuration:
//   - Upstash Redis when UPSTASH_REDIS_REST_URL/TOKEN are set. Distributed, so
//     the limit holds across every serverless instance. This is the production
//     path — Vercel runs many isolated instances and an in-process counter
//     would let an attacker multiply their budget by fanning out across them.
//   - An in-process sliding window otherwise, so `npm run dev` and CI limit for
//     real without requiring an external service.
//
// The fallback is a genuine limiter, NOT a stub that always allows. It is
// per-instance, which is weaker, and `limiterBackend()` reports which one is
// live so the health endpoint and the boot log can surface it honestly.
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms when the current window resets. */
  reset: number;
};

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export function limiterBackend(): "upstash" | "in-memory" {
  return UPSTASH_URL && UPSTASH_TOKEN ? "upstash" : "in-memory";
}

// ── Policies ────────────────────────────────────────────────────────────────
// Auth is deliberately tight: it is the brute-force surface. The assistant is
// limited primarily for model cost, secondarily for abuse.
export const POLICIES = {
  auth: { tokens: 10, windowSeconds: 60 },
  assistant: { tokens: 20, windowSeconds: 60 },
} as const;

export type PolicyName = keyof typeof POLICIES;

// ── Upstash backend ─────────────────────────────────────────────────────────
const upstashLimiters = new Map<PolicyName, Ratelimit>();

function upstashLimiter(policy: PolicyName): Ratelimit {
  let l = upstashLimiters.get(policy);
  if (!l) {
    const { tokens, windowSeconds } = POLICIES[policy];
    l = new Ratelimit({
      redis: new Redis({ url: UPSTASH_URL!, token: UPSTASH_TOKEN! }),
      limiter: Ratelimit.slidingWindow(tokens, `${windowSeconds} s`),
      prefix: `healthspan:rl:${policy}`,
      analytics: false,
    });
    upstashLimiters.set(policy, l);
  }
  return l;
}

// ── In-process fallback ─────────────────────────────────────────────────────
const hits = new Map<string, number[]>();

function memoryLimit(policy: PolicyName, key: string, now: number): RateLimitResult {
  const { tokens, windowSeconds } = POLICIES[policy];
  const windowMs = windowSeconds * 1000;
  const cutoff = now - windowMs;

  const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
  const success = recent.length < tokens;
  if (success) recent.push(now);
  hits.set(key, recent);

  // Opportunistic sweep so a long-lived process doesn't grow unbounded.
  if (hits.size > 10_000) {
    for (const [k, v] of hits) {
      if (!v.some((t) => t > cutoff)) hits.delete(k);
    }
  }

  return {
    success,
    limit: tokens,
    remaining: Math.max(0, tokens - recent.length),
    reset: (recent[0] ?? now) + windowMs,
  };
}

/** Test seam: drop in-process state between tests. */
export function __resetMemoryLimiter(): void {
  hits.clear();
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Identify the caller. Prefers the real client IP from the proxy chain; falls
 * back to a constant so a request without one is still bounded (shared bucket)
 * rather than silently unlimited.
 */
export function clientKey(req: Request, suffix = ""): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip =
    (fwd ? fwd.split(",")[0]?.trim() : "") ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return suffix ? `${ip}:${suffix}` : ip;
}

/** Consume one token. Never throws — a limiter outage must not take auth down. */
export async function checkRateLimit(
  policy: PolicyName,
  key: string,
): Promise<RateLimitResult> {
  const { tokens, windowSeconds } = POLICIES[policy];
  if (limiterBackend() === "upstash") {
    try {
      const r = await upstashLimiter(policy).limit(key);
      return { success: r.success, limit: r.limit, remaining: r.remaining, reset: r.reset };
    } catch (err) {
      // Fail OPEN on limiter failure: Upstash being unreachable must not lock
      // every user out of login. The in-process window still applies below, so
      // this degrades to weaker limiting rather than none.
      console.error(
        JSON.stringify({ level: "error", event: "ratelimit.upstash_failed", policy, err: String(err) }),
      );
    }
  }
  return memoryLimit(policy, `${policy}:${key}`, Date.now());
}

/** Standard headers so clients can back off politely. */
export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  return {
    "RateLimit-Limit": String(r.limit),
    "RateLimit-Remaining": String(r.remaining),
    "RateLimit-Reset": String(Math.max(0, Math.ceil((r.reset - Date.now()) / 1000))),
  };
}

/** 429 response body shared by every limited route. */
export function tooManyRequests(r: RateLimitResult): Response {
  const retryAfter = Math.max(1, Math.ceil((r.reset - Date.now()) / 1000));
  return new Response(
    JSON.stringify({ error: "Too many requests. Please slow down and try again shortly." }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "Retry-After": String(retryAfter),
        ...rateLimitHeaders(r),
      },
    },
  );
}
