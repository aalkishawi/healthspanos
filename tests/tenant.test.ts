import { describe, it, expect } from "vitest";
import { tenantScope, isCohortReportable, K_ANONYMITY_MIN } from "@/lib/tenant";
import type { SessionUser } from "@/lib/rbac";

const user = (role: SessionUser["role"]): SessionUser => ({
  id: "u1",
  email: "u@x.io",
  fullName: "U",
  role,
  tenantId: "t-acme",
  locale: "en",
});

describe("tenant isolation", () => {
  it("scopes every non-admin read to the caller's tenant", () => {
    expect(tenantScope(user("ENTERPRISE_ADMIN"))).toEqual({ tenantId: "t-acme" });
    expect(tenantScope(user("MEMBER"))).toEqual({ tenantId: "t-acme" });
  });

  it("only lets a platform admin opt into cross-tenant reads", () => {
    expect(tenantScope(user("PLATFORM_ADMIN"), true)).toEqual({});
    // even an admin is tenant-scoped unless they explicitly opt in
    expect(tenantScope(user("PLATFORM_ADMIN"))).toEqual({ tenantId: "t-acme" });
  });
});

describe("k-anonymity", () => {
  it("suppresses cohorts below the threshold", () => {
    expect(isCohortReportable(K_ANONYMITY_MIN)).toBe(true);
    expect(isCohortReportable(K_ANONYMITY_MIN - 1)).toBe(false);
    expect(isCohortReportable(0)).toBe(false);
  });
});
