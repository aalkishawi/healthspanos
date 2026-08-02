import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { IntakeSchema } from "@/lib/intake";
import { decryptJson } from "@/lib/security/encryption";
import { log } from "@/lib/logger";
import { recomputeScores } from "@/lib/scoring";
import { encryptJson } from "@/lib/security/encryption";
import { auditHealthAccess } from "@/lib/security/audit";

export const runtime = "nodejs";

/** Current intake so a half-finished onboarding can be resumed. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const profile = await prisma.memberProfile.findFirst({
    // Scoped by BOTH userId and tenantId: a session cannot read a profile
    // outside its own tenant even if the id were somehow known.
    where: { userId: user.id, tenantId: user.tenantId },
    select: { intake: true, onboardingCompletedAt: true, consent: true, consentVersion: true },
  });
  if (!profile) return NextResponse.json({ error: "No member profile." }, { status: 404 });

  return NextResponse.json({
    intake: decryptJson(profile.intake) ?? null,
    completedAt: profile.onboardingCompletedAt,
    consent: profile.consent,
    consentVersion: profile.consentVersion,
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (user.role !== "MEMBER") {
    return NextResponse.json({ error: "Only members complete onboarding." }, { status: 403 });
  }

  const parsed = IntakeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Check your answers." },
      { status: 400 },
    );
  }

  const profile = await prisma.memberProfile.findFirst({
    where: { userId: user.id, tenantId: user.tenantId },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "No member profile." }, { status: 404 });

  await prisma.$transaction([
    prisma.memberProfile.update({
      where: { id: profile.id },
      data: {
        // Encrypted at rest when FIELD_ENCRYPTION_KEY is set; stored as-is
        // otherwise, so enabling encryption is a config change not a migration.
        intake: encryptJson(parsed.data) as object,
        onboardingCompletedAt: new Date(),
        // Year-only birth data lives in `intake`; dateOfBirth stays null so we
        // don't store a more identifying value than the product needs.
        sex: parsed.data.about.sex ?? null,
      },
    }),
    prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        action: "onboarding.completed",
        entity: "member_profile",
      },
    }),
  ]);

  // Scores recompute on every intake change — that is the trigger. Done after
  // the intake write commits so a scoring failure can never lose the member's
  // answers; they would simply see "scores pending" and a retry recomputes.
  let scoring = null;
  try {
    scoring = await recomputeScores(profile.id);
  } catch (err) {
    log.error("scoring.failed_after_onboarding", err, { userId: user.id });
  }

  // Answers themselves are never logged — they are PHI.
  log.info("onboarding.completed", { userId: user.id, tenantId: user.tenantId });
  return NextResponse.json({
    ok: true,
    redirect: "/member/passport",
    scored: scoring !== null,
    plansHeldForReview: scoring?.plansHeldForReview ?? 0,
  });
}
