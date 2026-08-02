import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log, sentryEnabled } from "@/lib/logger";
import { limiterBackend } from "@/lib/ratelimit";

// Liveness + readiness probe. Target for uptime monitoring.
//
// 200 = serving traffic correctly. 503 = do not route traffic here.
// The DB check is a real round-trip, not a process-alive check: a container
// that is running but cannot reach Postgres is not healthy, and a monitor that
// only pings the process would report green straight through a database outage.
export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // a cached health check is a lie

export async function GET() {
  const startedAt = Date.now();
  let dbUp = false;
  let dbLatencyMs: number | null = null;

  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
    dbUp = true;
  } catch (err) {
    log.error("health.db_unreachable", err);
  }

  const body = {
    status: dbUp ? "ok" : "degraded",
    ts: new Date().toISOString(),
    checks: {
      db: { up: dbUp, latencyMs: dbLatencyMs },
      // Surfaced so a deploy that is missing its observability config is
      // visible from outside, instead of discovered when something breaks and
      // no alert arrives.
      sentry: { configured: sentryEnabled() },
      rateLimiter: { backend: limiterBackend() },
    },
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    uptimeCheckMs: Date.now() - startedAt,
  };

  return NextResponse.json(body, { status: dbUp ? 200 : 503 });
}
