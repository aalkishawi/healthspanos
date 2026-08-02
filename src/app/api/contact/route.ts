import { NextResponse } from "next/server";
import { z } from "zod";
import { EmailSchema, NameSchema } from "@/lib/accounts";
import { emailConfigured, sendContactEnquiry } from "@/lib/email";
import { checkRateLimit, clientKey, tooManyRequests } from "@/lib/ratelimit";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

const Body = z.object({
  name: NameSchema,
  email: EmailSchema,
  organisation: z.string().trim().max(160).optional().or(z.literal("")),
  topic: z.enum(["demo", "enterprise", "dpa", "general"]),
  message: z.string().trim().min(10, "Tell us a little more.").max(4000),
});

export async function POST(req: Request) {
  // Public and unauthenticated, so it is a spam target. Reuses the auth policy
  // rather than inventing a second one.
  const rl = await checkRateLimit("auth", clientKey(req, "contact"));
  if (!rl.success) return tooManyRequests(rl);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Check the form and try again." },
      { status: 400 },
    );
  }

  const sent = await sendContactEnquiry(parsed.data);

  // The enquiry itself is not logged: someone may describe their organisation's
  // health programme in it, and this is not a channel that should retain that.
  log.info("contact.enquiry", { topic: parsed.data.topic, delivered: sent.delivered });

  return NextResponse.json({
    ok: true,
    delivered: sent.delivered,
    message: sent.delivered
      ? "Thanks — we have your message and will reply shortly."
      : emailConfigured()
        ? "We could not deliver that just now. Please email us directly instead."
        : "Email is not configured on this deployment, so your message was logged to the server rather than sent. Please email us directly.",
  });
}
