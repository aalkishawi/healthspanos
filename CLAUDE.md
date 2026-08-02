# CLAUDE.md — Operating contract for building Numik HealthspanOS

You (Claude Code) are building **Numik HealthspanOS** from a working foundation into a **real, production, marketable product**. Read this file fully at the start of every session. The detailed phase-by-phase scope lives in **`PRODUCTION_BUILD_PLAN.md`** (same directory) — this file is the *rules of engagement*; that file is the *what to build*.

## Current state (do not misread it as finished)
This repo is a well-built **foundation with synthetic seed data**, not a product. Working and reusable: Next.js 15 App Router + TypeScript + Tailwind; JWT-cookie auth (`src/lib/auth.ts`); RBAC + portal map (`src/lib/rbac.ts`); tenant isolation (`src/lib/tenant.ts`); edge guard (`src/middleware.ts`); five portals through one `PortalShell`; a real-data-ready Prisma schema with an `AuditLog` model. **Skeleton/mock and must become real:** all data is seeded (`prisma/seed.ts`), there is no signup/onboarding, the AI gateway (`src/lib/ai/gateway.ts`) is a stub, health scores are hardcoded, enterprise analytics are seeded, and there is no billing/email/production DB.

## Prime directives (non-negotiable)
1. **Build phase by phase. Do not jump ahead.** Work only the phase you were asked to. When it's done, **stop and report** — do not silently start the next phase. Phases are defined in `PRODUCTION_BUILD_PLAN.md` (Phase 0 → 7).
2. **No fake data in real code paths.** Never satisfy a requirement with hardcoded, mocked, or placeholder data. If a feature needs data, build the real source of that data. The synthetic `prisma/seed.ts` is for **local dev only** and must never feed production or real-tenant analytics. Mark demo tenants with the existing `isDemo` flag.
3. **No stubs that pretend to work.** If something can't be finished, leave it clearly `TODO`-marked and say so in your report — do not return a canned success value the way the current `askAssistant()` returns `"Live model integration pending."`.
4. **Security and authorization are server-side.** Every protected read/write is authorized on the server. Every tenant-scoped query goes through `tenantScope` in `src/lib/tenant.ts` — never query tenant data without it. Never trust the client for role or tenant.
5. **This is health data.** Treat all member health inputs as sensitive. Enterprises see only k-anonymized aggregates (respect `K_ANONYMITY_MIN`), never identifiable data. Keep the "non-diagnostic, not medical advice" framing on every score, plan, and AI answer. The AI must never give individualized medical advice.
6. **Ask before destructive or irreversible actions** (dropping tables, deleting data, force-resetting the DB against a non-local database).

## Tech decisions (defaults — the founder can override; confirm if a key is missing)
- **Database:** Postgres via **Neon**. Use **`prisma migrate`** (not `db push`) in prod; commit `prisma/migrations/`.
- **Vector search:** **pgvector** on the same Postgres instance.
- **Email:** **Resend** (transactional: verification, password reset, invites).
- **Payments:** **Stripe** (B2C subscriptions + B2B seats).
- **AI providers:** keep the multi-provider gateway; wire real SDKs (Anthropic / OpenAI / Google) behind it. Default provider = whichever key is configured.
- **Evidence source:** **PubMed E-utilities** for the research/evidence base.
- **Error tracking:** **Sentry**. **Rate limiting:** **Upstash Ratelimit**. **Hosting:** **Vercel**.

## Definition of Done (every phase must meet all of these before you report complete)
- TypeScript compiles clean: `npm run typecheck` passes.
- Tests pass and **new tests were added** for new logic: `npm test`. Extend the existing Vitest suite in `tests/` (RBAC + tenant isolation patterns are there to copy).
- `npm run build` succeeds.
- No secrets committed. `.env.example` updated with any new variables (documented, no real values).
- New/changed env vars are listed in your report so the founder can set them in Vercel.
- A short written report: what changed, what files, how you tested it, what the founder must do manually (set a key, run a migration, etc.), and anything left as `TODO`.
- Changes committed with clear messages. Do not push to main without being asked; open a branch/PR if that workflow is set up.

## Coding standards
- TypeScript strict; Zod-validate **every** API request body (follow `src/app/api/assistant/route.ts` as the pattern).
- Reuse the existing UI primitives in `src/components/ui/` and the design tokens in `src/theme/tokens.ts` / `globals.css`. Do not hardcode hex colors.
- Keep server components server-side; only mark `"use client"` when interactivity requires it.
- Preserve i18n plumbing (`src/lib/i18n/`) — English is launch locale; don't break the Arabic/RTL scaffolding.
- Prefer small, reviewable commits within a phase.

## When you finish a phase
Stop. Summarize against the Definition of Done above. List the exact next-phase prompt the founder should paste (from `CLAUDE_CODE_PROMPTS.md`). Wait for go-ahead.
