import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { recordConsent } from "@/lib/accounts";
import { CONSENT_VERSION } from "@/lib/intake";

export const runtime = "nodejs";

const Body = z.object({ action: z.enum(["GRANTED", "WITHDRAWN"]) });

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const profile = await prisma.memberProfile.findFirst({
    where: { userId: user.id, tenantId: user.tenantId },
    select: { id: true, consent: true, consentVersion: true, consentUpdatedAt: true },
  });
  if (!profile) return NextResponse.json({ error: "No member profile." }, { status: 404 });

  const history = await prisma.consentRecord.findMany({
    where: { profileId: profile.id },
    select: { action: true, version: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    consent: profile.consent,
    version: profile.consentVersion,
    updatedAt: profile.consentUpdatedAt,
    currentVersion: CONSENT_VERSION,
    // True when consent was given against an older text and must be renewed.
    reconsentRequired: profile.consent === "GRANTED" && profile.consentVersion !== CONSENT_VERSION,
    history,
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (user.role !== "MEMBER") {
    return NextResponse.json({ error: "Only a member can change their own consent." }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid consent action." }, { status: 400 });

  const profile = await prisma.memberProfile.findFirst({
    where: { userId: user.id, tenantId: user.tenantId },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "No member profile." }, { status: 404 });

  const result = await recordConsent({
    profileId: profile.id,
    tenantId: user.tenantId,
    action: parsed.data.action,
    userId: user.id,
  });

  return NextResponse.json({
    ok: true,
    ...result,
    message:
      parsed.data.action === "GRANTED"
        ? "Consent recorded. Your anonymised results may now contribute to aggregate reporting."
        : "Consent withdrawn. You have been removed from all aggregate reporting.",
  });
}
