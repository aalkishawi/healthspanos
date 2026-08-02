import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { exportUserData } from "@/lib/security/datasubject";

export const runtime = "nodejs";

// GDPR portability. Returns everything held about the CALLER — the session's
// own user id, never one supplied by the request, so this cannot be used to
// export someone else.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const data = await exportUserData(user.id);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="numik-healthspanos-export.json"`,
      // Contains PHI: must never sit in a shared or browser cache.
      "cache-control": "no-store, private",
    },
  });
}
