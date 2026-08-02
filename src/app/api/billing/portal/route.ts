import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { createPortalSession } from "@/lib/billing/stripe";
import { appBaseUrl } from "@/lib/email";

export const runtime = "nodejs";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const sub = await prisma.subscription.findUnique({
    where: { tenantId: user.tenantId },
    select: { stripeCustomerId: true },
  });
  if (!sub?.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account yet — subscribe first." }, { status: 404 });
  }

  const result = await createPortalSession(sub.stripeCustomerId, appBaseUrl());
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 503 });
  return NextResponse.json({ url: result.url });
}
