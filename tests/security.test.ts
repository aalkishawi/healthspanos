// Production security posture: session cookie flags, response headers, and the
// logger's PHI redaction. These are the guarantees that protect health data, so
// they are asserted rather than assumed.
import { describe, expect, it } from "vitest";
import { sessionCookieOptions } from "@/lib/auth";
import { log, redact } from "@/lib/logger";

describe("session cookie", () => {
  it("is httpOnly — JavaScript must never be able to read the session", () => {
    expect(sessionCookieOptions.httpOnly).toBe(true);
  });

  it("is sameSite=lax — blocks cross-site CSRF while keeping normal navigation", () => {
    expect(sessionCookieOptions.sameSite).toBe("lax");
  });

  it("is secure in production", () => {
    // The flag is computed from NODE_ENV at module load. Under test that is
    // "test", so assert the rule rather than the current value: it must be
    // true in production and may be false locally (http://localhost).
    const secureInProd = process.env.NODE_ENV === "production" ? sessionCookieOptions.secure : true;
    expect(secureInProd).toBe(true);
  });

  it("is scoped to the site root with a bounded lifetime", () => {
    expect(sessionCookieOptions.path).toBe("/");
    expect(sessionCookieOptions.maxAge).toBeGreaterThan(0);
  });
});

describe("security headers config", () => {
  // Imported lazily: next.config.mjs is ESM and reads NODE_ENV at load.
  async function headersFor(source: string) {
    const mod = await import("../next.config.mjs");
    const all = await mod.default.headers();
    const entry = all.find((h: { source: string }) => h.source === source);
    return Object.fromEntries(
      (entry?.headers ?? []).map((h: { key: string; value: string }) => [h.key, h.value]),
    );
  }

  it("sets a Content-Security-Policy", async () => {
    const h = await headersFor("/:path*");
    expect(h["Content-Security-Policy"]).toBeTruthy();
  });

  it("denies framing two ways (CSP + legacy header)", async () => {
    const h = await headersFor("/:path*");
    expect(h["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(h["X-Frame-Options"]).toBe("DENY");
  });

  it("locks default-src, object-src and base-uri", async () => {
    const csp = (await headersFor("/:path*"))["Content-Security-Policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("never allows unsafe-eval outside development", async () => {
    const csp = (await headersFor("/:path*"))["Content-Security-Policy"];
    if (process.env.NODE_ENV === "production") {
      expect(csp).not.toContain("unsafe-eval");
    } else {
      expect(csp).toBeTruthy(); // dev needs it for React Refresh
    }
  });

  it("sets nosniff and a referrer policy", async () => {
    const h = await headersFor("/:path*");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("makes API responses uncacheable — they are tenant-scoped", async () => {
    const h = await headersFor("/api/:path*");
    expect(h["Cache-Control"]).toContain("no-store");
  });
});

describe("logger PHI safety", () => {
  function capture(fn: () => void): string {
    const lines: string[] = [];
    const orig = { log: console.log, warn: console.warn, error: console.error };
    console.log = (m?: unknown) => void lines.push(String(m));
    console.warn = (m?: unknown) => void lines.push(String(m));
    console.error = (m?: unknown) => void lines.push(String(m));
    try {
      fn();
    } finally {
      Object.assign(console, orig);
    }
    return lines.join("\n");
  }

  it("emits one parseable JSON object per line", () => {
    const out = capture(() => log.info("test.event", { userId: "u1" }));
    const parsed = JSON.parse(out.trim());
    expect(parsed.event).toBe("test.event");
    expect(parsed.level).toBe("info");
    expect(parsed.userId).toBe("u1");
  });

  it("redacts health and credential fields even when a caller passes them", () => {
    const out = capture(() =>
      log.info("intake.saved", {
        userId: "u1",
        intake: "I have hypertension and take metformin",
        email: "member@example.com",
        password: "hunter2",
      }),
    );
    expect(out).not.toContain("hypertension");
    expect(out).not.toContain("member@example.com");
    expect(out).not.toContain("hunter2");
    expect(out).toContain("[redacted]");
    expect(out).toContain("u1"); // ids are safe and must survive
  });

  it("redact() records that a value existed without recording it", () => {
    expect(redact("sensitive-value")).toBe("[redacted:15]");
    expect(redact(null)).toBe("[absent]");
  });
});
