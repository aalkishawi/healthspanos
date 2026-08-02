import { NextResponse } from "next/server";
import { z } from "zod";
import { beginPasswordReset, EmailSchema, NEUTRAL_ACK } from "@/lib/accounts";
import { sendPasswordResetEmail } from "@/lib/email";

export const runtime = "nodejs";

const Body = z.object({ email: EmailSchema });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json(NEUTRAL_ACK, { status: 202 });

  const started = await beginPasswordReset(parsed.data.email);
  if (started) {
    await sendPasswordResetEmail(parsed.data.email, started.fullName, started.rawToken);
  }
  // Same 202 for a known address, an unknown one, and a disabled account.
  return NextResponse.json(NEUTRAL_ACK, { status: 202 });
}
