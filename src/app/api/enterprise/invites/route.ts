import { NextResponse } from "next/server";
import { z } from "zod";
import { EmailSchema, inviteMember } from "@/lib/accounts";
import { sendInvitationEmail } from "@/lib/email";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

const Body = z.object({ email: EmailSchema });

export async function POST(req: Request) {
  // Authorization is server-side and role-checked here, never inferred from the
  // client (CLAUDE.md rule 4).
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (user.role !== "ENTERPRISE_ADMIN" && user.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "Only an enterprise admin can invite members." }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  // The invite is bound to the ADMIN'S OWN tenant from their session — never a
  // tenantId supplied by the client, which would let an admin invite users into
  // someone else's organisation.
  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { name: true },
  });
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const result = await inviteMember({
    tenantId: user.tenantId,
    email: parsed.data.email,
    invitedById: user.id,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: "That address already has a HealthspanOS account." },
      { status: 409 },
    );
  }

  const sent = await sendInvitationEmail(parsed.data.email, tenant.name, user.fullName, result.rawToken);
  log.info("invitation.issued", { tenantId: user.tenantId, delivered: sent.delivered });
  return NextResponse.json({
    ok: true,
    delivered: sent.delivered,
    message: sent.delivered
      ? "Invitation sent."
      : "Invitation created, but email is not configured — the link was logged to the server console.",
  });
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (user.role !== "ENTERPRISE_ADMIN" && user.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const invites = await prisma.invitation.findMany({
    where: { tenantId: user.tenantId },
    select: { email: true, createdAt: true, expiresAt: true, acceptedAt: true, revokedAt: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ invites });
}
