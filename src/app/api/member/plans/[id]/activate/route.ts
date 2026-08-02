import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { canActivate } from "@/lib/scoring";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

// Activate an action plan. THE SAFETY GATE LIVES HERE, server-side: a plan that
// requires review cannot become ACTIVE until a reviewer has APPROVED it. The UI
// also hides the button, but that is a convenience — this is the enforcement.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (user.role !== "MEMBER") {
    return NextResponse.json({ error: "Only a member can activate their own plan." }, { status: 403 });
  }
  const { id } = await params;

  // Ownership AND tenant scoping: a plan id from another member is a 404, not
  // a 403, so this endpoint cannot be used to discover which ids exist.
  const plan = await prisma.actionPlan.findFirst({
    where: { id, profile: { userId: user.id, tenantId: user.tenantId } },
    select: { id: true, status: true, requiresReview: true, profileId: true },
  });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const gate = canActivate(plan);
  if (!gate.allowed) {
    log.warn("plan.activation_blocked", { userId: user.id, planId: id, status: plan.status });
    return NextResponse.json({ error: gate.reason, code: "ACTIVATION_BLOCKED" }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.actionPlan.update({ where: { id }, data: { status: "ACTIVE" } }),
    prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        action: "plan.activated",
        entity: `action_plan:${id}`,
      },
    }),
  ]);

  log.info("plan.activated", { userId: user.id, planId: id });
  return NextResponse.json({ ok: true, status: "ACTIVE" });
}
