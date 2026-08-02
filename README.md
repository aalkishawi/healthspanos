# Numik HealthspanOS — Foundation

A production-ready **multi-tenant enterprise SaaS skeleton** for Numik HealthspanOS: a
longevity-intelligence operating system that turns global preventive-health research into
trusted intelligence, personalized wellness actions and measurable workforce healthspan
programs.

This repository delivers the **foundation** defined by sections 2, 4, 5 and 6 of the Master
Build Instruction: responsive web frontend, backend API, database schema, tenant isolation,
authentication/authorization, the five-portal role model, English-first i18n with Arabic/RTL
scaffolding, and Numik-theme-compatible design-system integration points.

> **See [RUN.md](./RUN.md) for exact setup/run commands.**

## Stack — and why

**Next.js 15 (App Router) + TypeScript + Tailwind + Prisma.** One framework serves the
responsive frontend *and* the backend API (route handlers), deploys to Vercel with zero config
(the required launch target), and runs locally on SQLite with no external services — the
simplest stack that satisfies "multi-tenant SaaS + public HTTPS deploy + local host."

| Concern            | Choice                                                            |
| ------------------ | ---------------------------------------------------------------- |
| Frontend + API     | Next.js 15 App Router, React 19, server components               |
| Styling / theme    | Tailwind 3 driven by CSS variables (Numik design tokens)         |
| Database           | Prisma — SQLite in dev, Postgres-ready for prod                  |
| Auth               | JWT (jose) in an httpOnly cookie; bcrypt password hashing        |
| Validation         | Zod on every API request body                                    |
| Tests              | Vitest (unit) + Playwright (e2e)                                 |

## The five portals (section 6)

| # | Portal                        | Route         | Who                | What it shows |
|---|-------------------------------|---------------|--------------------|---------------|
| 1 | Public website                | `/`           | anyone             | Marketing, portal map, **Launch** button |
| 2 | Member portal                 | `/member`     | MEMBER             | Healthspan Passport, explainable scores, action plans, research assistant |
| 3 | Enterprise portal             | `/enterprise` | ENTERPRISE_ADMIN   | Privacy-protected **aggregate** workforce analytics only |
| 4 | Scientific & clinical review  | `/reviewer`   | REVIEWER           | Evidence grading, flag/retract, human approval |
| 5 | Platform administration       | `/admin`      | PLATFORM_ADMIN     | Tenants, users/roles, AI model gateway, audit log |

`PLATFORM_ADMIN` is a superuser across all portals. Access is enforced twice: in edge
`middleware.ts` (before render) and in each portal's `requirePortal()` server guard.

## Architecture highlights

- **Tenant isolation** — every tenant-scoped read/write goes through `src/lib/tenant.ts`
  (`tenantScope`), so a session's `tenantId` is always applied. Cross-tenant reads require an
  explicit `PLATFORM_ADMIN` opt-in.
- **Privacy by construction** — enterprises see only `AggregateMetric` rows, suppressed below a
  k-anonymity threshold (`K_ANONYMITY_MIN`). Identifiable PHI never leaves the member's passport.
- **Human-in-the-loop** — medical/high-risk evidence and action plans carry a review gate
  (`ReviewApproval`, `requiresReview`).
- **Configurable multi-model AI gateway** — `src/lib/ai/gateway.ts` registers the latest stable
  model families and exposes one structured-output entry point; runs in demo mode without keys.
- **i18n scaffolding** — English is the launch locale; `ar` dictionary + `dir`/RTL plumbing are
  present and type-checked (`src/lib/i18n/`) but not launch content.
- **Design tokens** — Numik violet accent + dark-first surfaces live as CSS variables
  (`globals.css`) mirrored in `src/theme/tokens.ts`. No component hardcodes a hex.
  **Integration point:** swap the token values for the canonical export from the existing
  Numik app/repo — no JSX changes needed.
- **Hybrid data model** — synthetic demo tenants (`isDemo`) on a real-data-ready schema; no live
  ingestion at launch.

## Project map

```
prisma/schema.prisma      Data model (tenants, users, passport, evidence, aggregates, audit)
prisma/seed.ts            Synthetic demo tenants + one user per role
src/middleware.ts         Edge RBAC on /member /enterprise /reviewer /admin
src/lib/                  auth, session, rbac, tenant, db, i18n, ai/gateway, utils
src/theme/tokens.ts       Numik design tokens (typed mirror of CSS vars)
src/components/           PortalShell + nav, UI primitives, LaunchButton
src/app/                  Public site, login, 4 portals, /api routes
tests/                    Vitest unit tests (rbac, tenant)
e2e/                      Playwright journeys (launch, login, RBAC)
```

## API surface

| Method | Path                          | Auth        | Purpose |
|--------|-------------------------------|-------------|---------|
| POST   | `/api/auth/login`             | public      | Sign in, set session cookie |
| POST   | `/api/auth/logout`            | public      | Clear session |
| GET    | `/api/auth/me`                | session     | Current user |
| POST   | `/api/assistant`              | session     | Structured, citation-backed answer (demo without keys) |
| POST   | `/api/evidence/[id]/review`   | REVIEWER    | Record approve/flag/reject decision |
| GET    | `/api/health`                 | public      | Liveness + DB probe |

## What this foundation intentionally defers

Live research ingestion, live AI provider calls, knowledge-graph/RAG retrieval, wearable/lab
integrations, and OAuth/SSO are scaffolded (gateway, schema, integration surfaces) but not
wired to external systems — those belong to later milestones.
