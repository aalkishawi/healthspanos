/**
 * LOCAL DEVELOPMENT ONLY. Seeds synthetic demo tenants and one demo user per
 * portal role so the app is explorable without signing anyone up.
 *
 * This data must NEVER reach production. Production starts empty and is filled
 * by real signups (CLAUDE.md rule 2). Every tenant created here is marked
 * `isDemo: true` so analytics can exclude it even if it somehow escapes.
 *
 * All demo passwords: Demo123!  (see RUN.md)
 */
import { PrismaClient, Role, TenantType, TenantStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CONSENT_VERSION } from "../src/lib/intake";

const prisma = new PrismaClient();
const PASSWORD = "Demo123!";

/**
 * Refuse to seed anything that isn't obviously a local database.
 *
 * Two independent signals, because either alone is easy to get wrong: a
 * production NODE_ENV, and a DATABASE_URL host that isn't localhost. The
 * override exists for CI, which runs a real throwaway Postgres in a container.
 */
function assertLocalDatabase(): void {
  if (process.env.ALLOW_SEED === "true") return;

  const url = process.env.DATABASE_URL ?? "";
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  const localHost = ["localhost", "127.0.0.1", "::1", "postgres", "db"].includes(host);

  if (process.env.NODE_ENV === "production" || !localHost) {
    console.error(
      [
        "",
        "  REFUSING TO SEED.",
        "",
        `  NODE_ENV = ${process.env.NODE_ENV ?? "(unset)"}`,
        `  database host = ${host || "(unparseable)"}`,
        "",
        "  prisma/seed.ts writes synthetic demo data and is for local development",
        "  only. Production must start empty and be populated by real signups.",
        "  If this really is a throwaway database (e.g. CI), set ALLOW_SEED=true.",
        "",
      ].join(String.fromCharCode(10)),
    );
    process.exit(1);
  }
}

async function main() {
  assertLocalDatabase();
  const hash = await bcrypt.hash(PASSWORD, 10);

  // --- Platform tenant (Numik itself) ---
  const platform = await prisma.tenant.upsert({
    where: { slug: "numik" },
    update: {},
    create: {
      slug: "numik",
      name: "Numik Platform",
      type: TenantType.PLATFORM,
      status: TenantStatus.ACTIVE,
      isDemo: true,
      branding: { accent: "#7c5cff", name: "Numik HealthspanOS" },
    },
  });

  // --- Enterprise demo tenant ---
  const acme = await prisma.tenant.upsert({
    where: { slug: "acme-health" },
    update: {},
    create: {
      slug: "acme-health",
      name: "Acme Corporation — Workforce Health",
      type: TenantType.ENTERPRISE,
      status: TenantStatus.ACTIVE,
      isDemo: true,
      branding: { accent: "#7c5cff", name: "Acme Health" },
    },
  });

  // --- Users, one per portal role ---
  const users: { email: string; fullName: string; role: Role; tenantId: string }[] = [
    { email: "admin@numik.demo", fullName: "Numik Admin", role: Role.PLATFORM_ADMIN, tenantId: platform.id },
    { email: "reviewer@numik.demo", fullName: "Dr. Sara Reviewer", role: Role.REVIEWER, tenantId: platform.id },
    { email: "employer@acme.demo", fullName: "Acme HR Lead", role: Role.ENTERPRISE_ADMIN, tenantId: acme.id },
    { email: "member@acme.demo", fullName: "Jordan Member", role: Role.MEMBER, tenantId: acme.id },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role, tenantId: u.tenantId, passwordHash: hash, emailVerifiedAt: new Date(), status: "ACTIVE" },
      create: { ...u, passwordHash: hash,
      emailVerifiedAt: new Date(), locale: "en" },
    });
  }

  // --- Member Healthspan Passport (synthetic) ---
  const member = await prisma.user.findUniqueOrThrow({ where: { email: "member@acme.demo" } });
  const profile = await prisma.memberProfile.upsert({
    where: { userId: member.id },
    update: {},
    create: {
      userId: member.id,
      tenantId: acme.id,
      sex: "prefer not to say",
      consent: "GRANTED",
      consentVersion: CONSENT_VERSION,
      consentUpdatedAt: new Date(),
      onboardingCompletedAt: new Date(),
      // Shape must satisfy IntakeSchema (src/lib/intake.ts) — the demo member is
      // meant to look like someone who finished onboarding, not a broken record.
      intake: {
        goals: ["improve sleep", "metabolic health"],
        sleep: { averageHours: 6.8, quality: 3, wakesDuringNight: true },
        activity: { level: "moderate", sessionsPerWeek: 2, averageDailySteps: 7400 },
        lifestyle: { diet: "mixed", smoking: "never", alcohol: "occasional", stress: "high" },
        about: { birthYear: 1986, sex: "prefer not to say" },
      },
    },
  });

  // Consent ledger entry so the demo member's history matches their state.
  await prisma.consentRecord.upsert({
    where: { id: `seed-consent-${profile.id}` },
    update: {},
    create: {
      id: `seed-consent-${profile.id}`,
      profileId: profile.id,
      tenantId: acme.id,
      version: CONSENT_VERSION,
      action: "GRANTED",
    },
  });

  const domains = [
    { domain: "metabolic", score: 72, band: "moderate", explanation: "Fasting glucose and waist metrics in a healthy-adjacent range; refinement possible via activity." },
    { domain: "cardiovascular", score: 81, band: "optimal", explanation: "Resting HR and BP within optimal bands; maintain aerobic base." },
    { domain: "sleep", score: 58, band: "low", explanation: "Average 6.8h with variable timing; consolidation is the top lever." },
    { domain: "cognitive", score: 76, band: "moderate", explanation: "Self-reported focus stable; supported by sleep improvements." },
    { domain: "activity", score: 69, band: "moderate", explanation: "~7.4k steps/day; a modest zone-2 volume increase would help." },
  ];
  for (const d of domains) {
    await prisma.healthspanScore.create({ data: { profileId: profile.id, ...d } });
  }

  await prisma.actionPlan.create({
    data: {
      profileId: profile.id,
      title: "Sleep consolidation — 4 week plan",
      summary: "Fixed wake time, light exposure on waking, caffeine cutoff by 14:00. Non-diagnostic lifestyle guidance.",
      status: "ACTIVE",
      requiresReview: false,
    },
  });

  // --- Enterprise aggregate metrics (privacy-protected) ---
  const metrics = [
    { metric: "participation_rate", value: 0.64, cohortSize: 240, period: "2026-Q3" },
    { metric: "avg_healthspan_score", value: 71.2, cohortSize: 240, period: "2026-Q3" },
    { metric: "sleep_risk_share", value: 0.31, cohortSize: 240, period: "2026-Q3" },
  ];
  for (const m of metrics) {
    await prisma.aggregateMetric.create({ data: { tenantId: acme.id, ...m } });
  }

  // --- Research / evidence items for the reviewer portal ---
  const evidence = [
    { title: "Time-restricted eating and metabolic markers: an RCT", source: "JAMA Internal Medicine", grade: "A" as const, status: "IN_REVIEW" as const, summary: "12-week RCT reporting modest improvements in insulin sensitivity.", url: "https://example.org/tre-rct" },
    { title: "Omega-3 supplementation and cognitive decline", source: "Lancet Neurology", grade: "B" as const, status: "INGESTED" as const, summary: "Cohort analysis suggesting association; causality unestablished.", url: "https://example.org/omega3" },
    { title: "Retraction notice: microbiome longevity claims", source: "Nature (Retraction)", grade: "UNGRADED" as const, status: "FLAGGED" as const, summary: "Original findings retracted; flagged for conflict/retraction handling.", url: "https://example.org/retraction", signals: { retracted: true } },
  ];
  for (const e of evidence) {
    await prisma.evidenceItem.create({ data: e });
  }

  console.log("Seed complete. Demo logins (password Demo123!):");
  for (const u of users) console.log(`  ${u.role.padEnd(16)} ${u.email}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
