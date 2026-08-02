import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import { createCheckoutSession } from "@/lib/billing/stripe";
import { appBaseUrl } from "@/lib/email";

export const runtime = "nodejs";

const Body = z.object({
  plan: z.enum(["MEMBER_PRO", "ENTERPRISE_SEATS"]),
  quantity: z.number().int().min(1).max(10_000).optional(),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid plan." }, { status: 400 });

  // Enterprise seats are an admin purchase; a member must not be able to buy
  // seats for their employer's tenant.
  if (parsed.data.plan === "ENTERPRISE_SEATS" && user.role !== "ENTERPRISE_ADMIN" && user.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "Only an enterprise admin can buy seats." }, { status: 403 });
  }

  // Tenant comes from the SESSION, never the request — otherwise a user could
  // pay to upgrade someone else's tenant, or worse, point a subscription at one.
  const result = await createCheckoutSession({
    tenantId: user.tenantId,
    email: user.email,
    plan: parsed.data.plan,
    quantity: parsed.data.quantity,
    baseUrl: appBaseUrl(),
  });

  if (!result.ok) return NextResponse.json({ error: result.message, reason: result.reason }, { status: 503 });
  return NextResponse.json({ url: result.url });
}
