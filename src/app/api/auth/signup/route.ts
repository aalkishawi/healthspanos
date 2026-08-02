import { NextResponse } from "next/server";
import { z } from "zod";
import { EmailSchema, NameSchema, NEUTRAL_ACK, PasswordSchema, signupMember } from "@/lib/accounts";
import { sendVerificationEmail } from "@/lib/email";
import { log } from "@/lib/logger";

// bcrypt needs Node, not edge. Rate limited by src/middleware.ts (/api/auth/*).
export const runtime = "nodejs";

const Body = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  fullName: NameSchema,
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Check the form and try again." },
      { status: 400 },
    );
  }

  const result = await signupMember(parsed.data);

  // Identical response whether or not the address was already registered.
  // Returning "email taken" here would turn signup into a membership oracle —
  // for a health product, confirming someone is a member is itself a leak.
  if (result.created) {
    await sendVerificationEmail(parsed.data.email, result.fullName, result.rawToken);
  } else {
    log.info("account.signup_duplicate_suppressed", {});
  }
  return NextResponse.json(NEUTRAL_ACK, { status: 202 });
}
