import { NextResponse } from "next/server";
import { z } from "zod";
import { createEnterpriseTenant, EmailSchema, NameSchema, NEUTRAL_ACK, PasswordSchema } from "@/lib/accounts";
import { sendVerificationEmail } from "@/lib/email";

export const runtime = "nodejs";

const Body = z.object({
  orgName: z.string().trim().min(2, "Enter your organisation's name.").max(160),
  adminEmail: EmailSchema,
  adminName: NameSchema,
  password: PasswordSchema,
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Check the form and try again." },
      { status: 400 },
    );
  }

  const result = await createEnterpriseTenant(parsed.data);
  if (result.created) {
    await sendVerificationEmail(parsed.data.adminEmail, result.fullName, result.rawToken);
  }
  // Neutral for the same reason as member signup.
  return NextResponse.json(NEUTRAL_ACK, { status: 202 });
}
