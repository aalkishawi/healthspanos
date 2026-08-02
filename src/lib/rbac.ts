// Role-based access control + portal routing map.
// Single source of truth for which role owns which portal (section 6).

export type Role = "PUBLIC" | "MEMBER" | "ENTERPRISE_ADMIN" | "REVIEWER" | "PLATFORM_ADMIN";

export type Portal = "public" | "member" | "enterprise" | "reviewer" | "admin";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  tenantId: string;
  locale: string;
}

// Which portal (URL prefix) each role lands in after login.
export const HOME_FOR_ROLE: Record<Exclude<Role, "PUBLIC">, string> = {
  MEMBER: "/member",
  ENTERPRISE_ADMIN: "/enterprise",
  REVIEWER: "/reviewer",
  PLATFORM_ADMIN: "/admin",
};

// Which roles may access each portal prefix. PLATFORM_ADMIN is a superuser.
export const PORTAL_ACCESS: Record<Portal, Role[]> = {
  public: ["PUBLIC", "MEMBER", "ENTERPRISE_ADMIN", "REVIEWER", "PLATFORM_ADMIN"],
  member: ["MEMBER", "PLATFORM_ADMIN"],
  enterprise: ["ENTERPRISE_ADMIN", "PLATFORM_ADMIN"],
  reviewer: ["REVIEWER", "PLATFORM_ADMIN"],
  admin: ["PLATFORM_ADMIN"],
};

export const PROTECTED_PREFIXES: { prefix: string; portal: Portal }[] = [
  { prefix: "/member", portal: "member" },
  { prefix: "/enterprise", portal: "enterprise" },
  { prefix: "/reviewer", portal: "reviewer" },
  { prefix: "/admin", portal: "admin" },
];

export function portalForPath(pathname: string): Portal | null {
  const match = PROTECTED_PREFIXES.find((p) => pathname === p.prefix || pathname.startsWith(p.prefix + "/"));
  return match ? match.portal : null;
}

export function canAccessPortal(role: Role, portal: Portal): boolean {
  return PORTAL_ACCESS[portal].includes(role);
}

export function homeForRole(role: Role): string {
  return role === "PUBLIC" ? "/" : HOME_FOR_ROLE[role];
}
