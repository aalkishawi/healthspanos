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

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  // Constant-ish response: same error whether user missing or password wrong.
  const ok = user && user.status === "ACTIVE" && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !ok) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
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
