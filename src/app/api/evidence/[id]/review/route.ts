import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { hasRole } from "@/lib/session";

export const runtime = "nodejs";

const Body = z.object({
  decision: z.enum(["APPROVE", "FLAG", "REJECT", "REQUEST_CHANGES"]),
  notes: z.string().optional(),
});

const NEXT_STATUS = {
  APPROVE: "APPROVED",
  FLAG: "FLAGGED",
  REJECT: "REJECTED",
  REQUEST_CHANGES: "IN_REVIEW",
} as const;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  // Only reviewers (or platform admins) may record review decisions.
  if (!hasRole(user, "REVIEWER", "PLATFORM_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid decision." }, { status: 400 });

  const item = await prisma.evidenceItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { decision, notes } = parsed.data;
  await prisma.$transaction([
    prisma.reviewApproval.create({ data: { evidenceItemId: id, reviewerId: user!.id, decision, notes } }),
    prisma.evidenceItem.update({ where: { id }, data: { status: NEXT_STATUS[decision] } }),
    prisma.auditLog.create({
      data: { tenantId: user!.tenantId, userId: user!.id, action: `evidence.${decision.toLowerCase()}`, entity: `evidence:${id}` },
    }),
  ]);

  return NextResponse.json({ ok: true, status: NEXT_STATUS[decision] });
}
