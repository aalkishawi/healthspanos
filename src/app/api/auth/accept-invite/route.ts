import { NextResponse } from "next/server";
import { z } from "zod";
import { acceptInvitation, NameSchema, PasswordSchema } from "@/lib/accounts";
import { INVALID_TOKEN_MESSAGE } from "@/lib/tokens";

export const runtime = "nodejs";

const Body = z.object({
  token: z.string().min(10).max(512),
  fullName: NameSchema,
  password: PasswordSchema,
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? INVALID_TOKEN_MESSAGE },
      { status: 400 },
    );
  }

  const result = await acceptInvitation({
    rawToken: parsed.data.token,
    fullName: parsed.data.fullName,
    password: parsed.data.password,
  });
  if (result.ok) return NextResponse.json({ ok: true, message: "Account created. You can sign in now." });
  if (result.reason === "email-taken") {
    return NextResponse.json(
      { error: "An account already exists for that address. Sign in instead." },
      { status: 409 },
    );
  }
  return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 });
}
