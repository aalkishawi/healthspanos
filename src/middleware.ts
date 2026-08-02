// Edge middleware: enforces portal access on every protected route BEFORE render.
// Verification is jose-only (edge-safe). This is defense-in-depth on top of the
// per-page requirePortal() server guard.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { canAccessPortal, homeForRole, portalForPath } from "@/lib/rbac";
import { checkRateLimit, clientKey, rateLimitHeaders, tooManyRequests } from "@/lib/ratelimit";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Brute-force guard for the whole auth surface. Done here rather than in each
  // route so endpoints added later (signup, password reset, invite accept) are
  // protected by construction instead of by remembering to opt in.
  //
  // Keyed on IP alone. Keying on the submitted email would let an attacker
  // rotate addresses to refresh their budget, and would leak which accounts
  // exist by behaving differently for known vs unknown emails.
  if (pathname.startsWith("/api/auth/")) {
    const rl = await checkRateLimit("auth", clientKey(req, "auth"));
    if (!rl.success) return tooManyRequests(rl);
    const res = NextResponse.next();
    for (const [k, v] of Object.entries(rateLimitHeaders(rl))) res.headers.set(k, v);
    return res;
  }

  const portal = portalForPath(pathname);
  if (!portal) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifySessionToken(token) : null;

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (!canAccessPortal(user.role, portal)) {
    const url = req.nextUrl.clone();
    url.pathname = homeForRole(user.role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/member/:path*",
    "/enterprise/:path*",
    "/reviewer/:path*",
    "/admin/:path*",
    // Rate-limited auth surface (see the guard at the top of `middleware`).
    "/api/auth/:path*",
  ],
};
