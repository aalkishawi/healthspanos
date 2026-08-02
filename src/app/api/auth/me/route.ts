import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";

// Returns the current session user or 401. Used by clients to check auth state.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  return NextResponse.json({ user });
}
