import { NextResponse } from "next/server";
import { z } from "zod";
import { EmailSchema, NEUTRAL_ACK, reissueVerification } from "@/lib/accounts";
import { sendVerificationEmail } from "@/lib/email";

export const runtime = "nodejs";

const Body = z.object({ email: EmailSchema });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  // Even a malformed address gets the neutral acknowledgement, so probing with
  // near-miss addresses reveals nothing.
  if (!parsed.success) return NextResponse.json(NEUTRAL_ACK, { status: 202 });

  const reissued = await reissueVerification(parsed.data.email);
  if (reissued) {
    await sendVerificationEmail(parsed.data.email, reissued.fullName, reissued.rawToken);
  }
  return NextResponse.json(NEUTRAL_ACK, { status: 202 });
}
