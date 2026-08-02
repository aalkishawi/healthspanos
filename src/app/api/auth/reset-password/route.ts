import { NextResponse } from "next/server";
import { z } from "zod";
import { completePasswordReset, PasswordSchema } from "@/lib/accounts";
import { INVALID_TOKEN_MESSAGE } from "@/lib/tokens";

export const runtime = "nodejs";

const Body = z.object({
  token: z.string().min(10).max(512),
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

  const result = await completePasswordReset(parsed.data.token, parsed.data.password);
  if (!result.ok) return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 });

  // No session is issued here on purpose: resetting proves mailbox control, not
  // intent to start a session on this device. The user signs in explicitly.
  return NextResponse.json({ ok: true, message: "Password updated. You can sign in now." });
}
