import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { deleteUserData } from "@/lib/security/datasubject";
import { SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

const Body = z.object({
  // Re-authentication, because deletion is irreversible and a logged-in session
  // on a shared machine should not be enough to destroy someone's record.
  password: z.string().min(1),
  confirm: z.literal("DELETE"),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Type DELETE and enter your password to confirm.' },
      { status: 400 },
    );
  }

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!row || !(await bcrypt.compare(parsed.data.password, row.passwordHash))) {
    return NextResponse.json({ error: "That password is not correct." }, { status: 401 });
  }

  const result = await deleteUserData(user.id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Clear the session: the account it referred to no longer exists.
  const res = NextResponse.json({
    ok: true,
    message: "Your account and health data have been deleted.",
    ...result,
  });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
