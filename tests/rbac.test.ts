import { describe, it, expect } from "vitest";
import { canAccessPortal, homeForRole, portalForPath } from "@/lib/rbac";

describe("portal routing", () => {
  it("maps each role to its home portal", () => {
    expect(homeForRole("MEMBER")).toBe("/member");
    expect(homeForRole("ENTERPRISE_ADMIN")).toBe("/enterprise");
    expect(homeForRole("REVIEWER")).toBe("/reviewer");
    expect(homeForRole("PLATFORM_ADMIN")).toBe("/admin");
    expect(homeForRole("PUBLIC")).toBe("/");
  });

  it("detects the portal for a protected path", () => {
    expect(portalForPath("/member")).toBe("member");
    expect(portalForPath("/member/passport")).toBe("member");
    expect(portalForPath("/admin/tenants")).toBe("admin");
    expect(portalForPath("/")).toBeNull();
    expect(portalForPath("/login")).toBeNull();
  });
});

describe("access control", () => {
  it("keeps roles inside their own portal", () => {
    expect(canAccessPortal("MEMBER", "member")).toBe(true);
    expect(canAccessPortal("MEMBER", "enterprise")).toBe(false);
    expect(canAccessPortal("ENTERPRISE_ADMIN", "enterprise")).toBe(true);
    expect(canAccessPortal("ENTERPRISE_ADMIN", "admin")).toBe(false);
    expect(canAccessPortal("REVIEWER", "reviewer")).toBe(true);
    expect(canAccessPortal("REVIEWER", "member")).toBe(false);
  });

  it("lets PLATFORM_ADMIN act as a superuser across portals", () => {
    for (const portal of ["member", "enterprise", "reviewer", "admin"] as const) {
      expect(canAccessPortal("PLATFORM_ADMIN", portal)).toBe(true);
    }
  });
});
