import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyEmail } from "@/lib/accounts";
import { INVALID_TOKEN_MESSAGE } from "@/lib/tokens";

export const runtime = "nodejs";

const Body = z.object({ token: z.string().min(10).max(512) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 });

  const result = await verifyEmail(parsed.data.token);
  if (result.ok) return NextResponse.json({ ok: true, message: "Email confirmed. You can sign in now." });
  if (result.reason === "already-verified") {
    return NextResponse.json({ ok: true, message: "That address is already confirmed. You can sign in." });
  }
  return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 });
}
