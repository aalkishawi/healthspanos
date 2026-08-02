import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { homeForRole, type Role } from "@/lib/rbac";
import { log } from "@/lib/logger";

// bcrypt needs the Node.js runtime (not edge).
export const runtime = "nodejs";

// Brute-force rate limiting for this route is enforced in `src/middleware.ts`
// across all of /api/auth/*, so every auth endpoint — including the signup and
// password-reset routes Phase 1 adds — is covered by construction rather than
// by each route remembering to opt in.

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

// A real bcrypt hash of a value nobody knows. Compared against when the account
// does not exist, so a missing user costs the same ~200ms as a wrong password
// and cannot be distinguished by timing.
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEe.7Pi/tPYqBjWQhpSHwbCVsxHRCVoUFVy";

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  // Check the password FIRST, independently of status. Same error whether the
  // user is missing or the password is wrong, so login is not an enumeration
  // oracle. bcrypt.compare runs against a dummy hash for a missing user so the
  // response time doesn't distinguish the two.
  const passwordOk = user
    ? await bcrypt.compare(password, user.passwordHash)
    : await bcrypt.compare(password, DUMMY_HASH).then(() => false);
  if (!user || !passwordOk) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  // Only AFTER the password is proven do we disclose account state. At this
  // point the caller already knows the credentials, so naming the reason leaks
  // nothing and saves them guessing why a correct password "fails".
  if (user.status === "PENDING_VERIFICATION") {
    log.info("auth.login.unverified", { userId: user.id });
    return NextResponse.json(
      {
        error: "Confirm your email address before signing in. Check your inbox for the link.",
        code: "EMAIL_NOT_VERIFIED",
      },
      { status: 403 },
    );
  }
  if (user.status !== "ACTIVE") {
    log.warn("auth.login.inactive", { userId: user.id, status: user.status });
    return NextResponse.json(
      { error: "This account is not active. Contact your administrator." },
      { status: 403 },
    );
  }

  const token = await createSessionToken({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role as Role,
    tenantId: user.tenantId,
    locale: user.locale,
  });

  await prisma.auditLog.create({
    data: { tenantId: user.tenantId, userId: user.id, action: "auth.login", entity: "user" },
  });

  log.info("auth.login.success", { userId: user.id, tenantId: user.tenantId, role: user.role });

  const res = NextResponse.json(
    { ok: true, home: homeForRole(user.role as Role), role: user.role },
  );
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
