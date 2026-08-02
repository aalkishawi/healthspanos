import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser, hasRole } from "@/lib/session";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

const Body = z.object({
  decision: z.enum(["APPROVE", "REJECT", "REQUEST_CHANGES"]),
  notes: z.string().max(2000).optional(),
});

// Reviewer decision on a high-risk action plan. This is the other half of the
// gate in /api/member/plans/[id]/activate — APPROVE is what unlocks activation.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!hasRole(user, "REVIEWER", "PLATFORM_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid decision." }, { status: 400 });

  const plan = await prisma.actionPlan.findUnique({
    where: { id },
    select: { id: true, status: true, requiresReview: true, profile: { select: { tenantId: true } } },
  });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Reviewers act on plans awaiting review. Approving an already-active plan is
  // meaningless and approving an archived one would resurrect it.
  if (plan.status !== "PENDING_SAFETY_REVIEW") {
    return NextResponse.json(
      { error: `This plan is ${plan.status.toLowerCase()} and is not awaiting review.` },
      { status: 409 },
    );
  }

  const next =
    parsed.data.decision === "APPROVE"
      ? "APPROVED"
      : parsed.data.decision === "REJECT"
        ? "ARCHIVED"
        : "DRAFT";

  await prisma.$transaction([
    prisma.actionPlan.update({ where: { id }, data: { status: next } }),
    prisma.auditLog.create({
      data: {
        // Audited against the MEMBER'S tenant, not the reviewer's: the record
        // belongs with the data it concerns, which is where an audit looks.
        tenantId: plan.profile.tenantId,
        userId: user!.id,
        action: `plan.${parsed.data.decision.toLowerCase()}`,
        entity: `action_plan:${id}`,
        meta: parsed.data.notes ? { notes: parsed.data.notes.slice(0, 2000) } : undefined,
      },
    }),
  ]);

  log.info("plan.reviewed", { planId: id, decision: parsed.data.decision, reviewerId: user!.id });
  return NextResponse.json({
    ok: true,
    status: next,
    message:
      next === "APPROVED"
        ? "Approved. The member can now activate this plan."
        : next === "ARCHIVED"
          ? "Rejected and archived."
          : "Sent back as a draft for changes.",
  });
}

// Plans awaiting review, for the reviewer queue.
export async function GET() {
  const user = await getSessionUser();
  if (!hasRole(user, "REVIEWER", "PLATFORM_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const plans = await prisma.actionPlan.findMany({
    where: { status: "PENDING_SAFETY_REVIEW" },
    select: { id: true, title: true, summary: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  return NextResponse.json({ plans });
}
