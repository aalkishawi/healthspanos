// Access review (Phase 7 task 4): re-verify that tenant isolation and RBAC
// cannot be bypassed, and that the Phase 7 controls behave.
//
// These are the assertions that should fail loudly if someone later "simplifies"
// a guard. Each one states the property, not the implementation.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { K_ANONYMITY_MIN, isCohortReportable, tenantScope } from "@/lib/tenant";
import { canAccessPortal, homeForRole, type Role } from "@/lib/rbac";
import { decrypt, decryptJson, encrypt, encryptJson, isEncrypted } from "@/lib/security/encryption";
import { sanitize } from "@/lib/analytics/read";
import { planAllows } from "@/lib/billing/entitlements";

const member = { id: "u1", email: "m@x.test", fullName: "M", role: "MEMBER" as Role, tenantId: "t-alpha", locale: "en" };
const admin = { ...member, id: "u2", role: "PLATFORM_ADMIN" as Role, tenantId: "t-platform" };

describe("tenant isolation", () => {
  it("scopes every ordinary query to the caller's own tenant", () => {
    expect(tenantScope(member)).toEqual({ tenantId: "t-alpha" });
  });

  it("does not let a member escape their tenant by asking nicely", () => {
    // allowCrossTenant is honoured only for PLATFORM_ADMIN.
    expect(tenantScope(member, true)).toEqual({ tenantId: "t-alpha" });
  });

  it("allows a platform admin to opt into cross-tenant reads, explicitly", () => {
    expect(tenantScope(admin, true)).toEqual({});
    // …but not by default, so an un-flagged admin query stays scoped.
    expect(tenantScope(admin)).toEqual({ tenantId: "t-platform" });
  });

  it.each(["MEMBER", "ENTERPRISE_ADMIN", "REVIEWER"] as Role[])(
    "%s can never read cross-tenant",
    (role) => {
      expect(tenantScope({ ...member, role }, true)).toEqual({ tenantId: "t-alpha" });
    },
  );
});

describe("portal RBAC", () => {
  it("keeps each role in its own portal", () => {
    expect(canAccessPortal("MEMBER", "member")).toBe(true);
    expect(canAccessPortal("MEMBER", "enterprise")).toBe(false);
    expect(canAccessPortal("MEMBER", "admin")).toBe(false);
    expect(canAccessPortal("MEMBER", "reviewer")).toBe(false);
  });

  it("does not let an employer admin into a member portal", () => {
    // The employer must never see the individual view, by construction.
    expect(canAccessPortal("ENTERPRISE_ADMIN", "member")).toBe(false);
  });

  it("does not let a reviewer wander into employer analytics", () => {
    expect(canAccessPortal("REVIEWER", "enterprise")).toBe(false);
  });

  it("sends every role somewhere it is allowed", () => {
    for (const role of ["MEMBER", "ENTERPRISE_ADMIN", "REVIEWER", "PLATFORM_ADMIN"] as Role[]) {
      const home = homeForRole(role).replace("/", "");
      expect(canAccessPortal(role, home as never), `${role} -> ${home}`).toBe(true);
    }
  });
});

describe("k-anonymity cannot be bypassed", () => {
  it("suppresses below the threshold regardless of the metric", () => {
    for (const metric of ["avg_healthspan_index", "participation_rate", "low_band_share_sleep"]) {
      const s = sanitize({ metric, period: "2026-Q3", value: 99, cohortSize: 2 });
      expect(s.value).toBeNull();
      expect(s.cohortSize).toBeNull();
    }
  });

  it("keeps the threshold and the helper in agreement", () => {
    for (let n = 0; n < 20; n++) {
      expect(sanitize({ metric: "m", period: "p", value: 1, cohortSize: n }).suppressed).toBe(
        !isCohortReportable(n),
      );
    }
    expect(K_ANONYMITY_MIN).toBeGreaterThanOrEqual(5);
  });
});

describe("entitlements cannot be bypassed by status", () => {
  it("does not grant employer analytics to a consumer plan at any status", () => {
    for (const status of ["ACTIVE", "TRIALING", "PAST_DUE", "CANCELED", "NONE"]) {
      expect(planAllows("MEMBER_PRO", status, "enterprise_analytics")).toBe(false);
    }
  });

  it("does not grant paid features to FREE at any status", () => {
    for (const status of ["ACTIVE", "TRIALING", "PAST_DUE"]) {
      expect(planAllows("FREE", status, "unlimited_assistant")).toBe(false);
    }
  });
});

// ── Field encryption ────────────────────────────────────────────────────────

describe("field encryption", () => {
  const KEY = Buffer.alloc(32, 7).toString("base64");

  function withKey<T>(fn: () => T): T {
    const prev = process.env.FIELD_ENCRYPTION_KEY;
    process.env.FIELD_ENCRYPTION_KEY = KEY;
    try {
      return fn();
    } finally {
      if (prev === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
      else process.env.FIELD_ENCRYPTION_KEY = prev;
    }
  }

  it("round-trips", () => {
    withKey(() => {
      const plain = "sleep 6.5h, high stress";
      const ct = encrypt(plain);
      expect(ct).not.toContain("sleep");
      expect(decrypt(ct)).toBe(plain);
    });
  });

  it("produces different ciphertext each time — no deterministic leak", () => {
    withKey(() => {
      // Identical plaintext must not produce identical ciphertext, or an
      // observer could tell which members gave the same answers.
      expect(encrypt("same")).not.toBe(encrypt("same"));
    });
  });

  it("REFUSES tampered ciphertext rather than returning wrong plaintext", () => {
    withKey(() => {
      const ct = encrypt("original value here");
      const tampered = ct.slice(0, -6) + "AAAAAA";
      expect(() => decrypt(tampered)).toThrow();
    });
  });

  it("refuses a wrong key", () => {
    const ct = withKey(() => encrypt("secret"));
    const other = Buffer.alloc(32, 9).toString("base64");
    const prev = process.env.FIELD_ENCRYPTION_KEY;
    process.env.FIELD_ENCRYPTION_KEY = other;
    try {
      expect(() => decrypt(ct)).toThrow();
    } finally {
      if (prev === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
      else process.env.FIELD_ENCRYPTION_KEY = prev;
    }
  });

  it("rejects a key of the wrong length instead of silently weakening", () => {
    const prev = process.env.FIELD_ENCRYPTION_KEY;
    process.env.FIELD_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
    try {
      expect(() => encrypt("x")).toThrow(/32 bytes/);
    } finally {
      if (prev === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
      else process.env.FIELD_ENCRYPTION_KEY = prev;
    }
  });

  it("reads pre-rollout plaintext unchanged — dual read", () => {
    // This is what makes enabling encryption a config change, not a migration.
    withKey(() => {
      const legacy = { goals: ["improve sleep"] };
      expect(decryptJson(legacy)).toEqual(legacy);
    });
  });

  it("is a no-op when no key is configured", () => {
    const prev = process.env.FIELD_ENCRYPTION_KEY;
    delete process.env.FIELD_ENCRYPTION_KEY;
    try {
      const v = { goals: ["metabolic health"] };
      expect(encryptJson(v)).toEqual(v);
      expect(decryptJson(v)).toEqual(v);
    } finally {
      if (prev !== undefined) process.env.FIELD_ENCRYPTION_KEY = prev;
    }
  });

  it("hides health content in the stored envelope", () => {
    withKey(() => {
      const intake = { goals: ["improve sleep"], lifestyle: { smoking: "regular" } };
      const stored = encryptJson(intake) as { __enc: string };
      const asJson = JSON.stringify(stored);
      expect(asJson).not.toContain("smoking");
      expect(asJson).not.toContain("regular");
      expect(isEncrypted(stored.__enc)).toBe(true);
      expect(decryptJson(stored)).toEqual(intake);
    });
  });
});

// ── Deletion must not destroy its own evidence ──────────────────────────────

describe("account deletion retains a provable audit trail", () => {
  // A structural guard rather than a behavioural one: these tests run without a
  // database, and the property at risk is a *schema cascade*, not a code path.
  // It is here because this exact regression already happened once — deleting
  // the personal tenant cascaded AuditLog.tenantId and took the retained trail
  // to zero rows, destroying the only proof the deletion occurred. Verified
  // against a live database at the time of the fix; this keeps it from
  // returning silently.
  const src = readFileSync(new URL("../src/lib/security/datasubject.ts", import.meta.url), "utf8");

  it("does not delete the tenant, because that cascades the audit log", () => {
    expect(src).not.toMatch(/tx\.tenant\.delete/);
  });

  it("tombstones the personal tenant instead", () => {
    expect(src).toMatch(/tx\.tenant\.update/);
    expect(src).toMatch(/status:\s*"SUSPENDED"/);
  });

  it("severs the user reference before deleting, rather than trusting SetNull", () => {
    const severs = src.indexOf("auditLog.updateMany");
    const deletes = src.indexOf("user.delete");
    expect(severs).toBeGreaterThan(-1);
    expect(deletes).toBeGreaterThan(severs);
  });

  it("writes an explicit, durable record that the deletion happened", () => {
    expect(src).toMatch(/gdpr\.account_deleted/);
  });

  it("deletes assistant history outright — it is health content, not metadata", () => {
    expect(src).toMatch(/assistantQuery\.deleteMany/);
  });
});
