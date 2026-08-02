// Server-side session helpers for Server Components / route handlers.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "./auth";
import { canAccessPortal, homeForRole, type Portal, type Role, type SessionUser } from "./rbac";

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// Guard a portal page: redirect to /login if anonymous, or to own home if wrong role.
export async function requirePortal(portal: Portal): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/${portal}`);
  if (!canAccessPortal(user.role, portal)) redirect(homeForRole(user.role));
  return user;
}

export function hasRole(user: SessionUser | null, ...roles: Role[]): boolean {
  return !!user && roles.includes(user.role);
}
