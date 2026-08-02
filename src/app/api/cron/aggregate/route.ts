import { NextResponse } from "next/server";
import { computeAllTenants, currentPeriod } from "@/lib/analytics/aggregate";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scheduled aggregate refresh. Wired via vercel.json `crons`.
 *
 * Vercel Cron calls this with a bearer token it derives from CRON_SECRET.
 * WITHOUT that secret set the endpoint refuses every request rather than
 * running open: an unauthenticated recompute is a free denial-of-wallet against
 * the database, and it lets anyone force-refresh another tenant's numbers.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    log.error("cron.secret_missing", new Error("CRON_SECRET is not configured"));
    return NextResponse.json(
      { error: "Scheduled jobs are not configured. Set CRON_SECRET." },
      { status: 503 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const period = currentPeriod();
  const results = await computeAllTenants(period);

  return NextResponse.json({
    ok: true,
    period,
    tenants: results.length,
    // Deliberately no per-tenant member counts in the response — this endpoint
    // is reachable by anyone holding the cron secret, which is an ops
    // credential, not a data-access one.
    suppressed: results.filter((r) => r.suppressedEntirely).length,
  });
}
