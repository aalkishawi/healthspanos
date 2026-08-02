# Numik HealthspanOS — Production Build Plan

**Purpose:** turn the current *foundation* (a working multi-tenant skeleton with synthetic seed data) into a **real, marketable product** where real users sign up, enter real data, and get real AI‑backed answers.

**How to use this document with Claude Code:** do **not** paste the whole thing and say "build it." Feed it **one phase at a time**. Each phase below is scoped to be independently buildable, testable, and shippable. Finish, test, and commit a phase before starting the next. Phase order is deliberate — later phases depend on earlier ones.

---

## Founder context (read first)

The current app already has, and these are solid — **do not rebuild them**:
- Next.js 15 App Router + TypeScript + Tailwind, deployable to Vercel.
- JWT-cookie auth (`src/lib/auth.ts`), RBAC + portal routing (`src/lib/rbac.ts`), tenant isolation (`src/lib/tenant.ts`), edge middleware guard (`src/middleware.ts`).
- Five portals (public, member, enterprise, reviewer, admin) rendering through one `PortalShell`.
- A real-data-ready Prisma schema (`prisma/schema.prisma`) with an audit-log model.

What is **skeleton / mock and must become real** (this is the actual work):
1. **All data is synthetic seed data** (`prisma/seed.ts`) — one fake member, hardcoded scores, 3 fake papers.
2. **No way for a real user to exist** — there is no signup, no onboarding, no data intake. Everything is seeded.
3. **The AI is a stub** — `src/lib/ai/gateway.ts` returns `"Live model integration pending."` even with a key.
4. **Health scores are hardcoded numbers**, not computed from anything.
5. **Enterprise analytics are seeded**, not aggregated from real cohorts.
6. **No billing, no email, no production database** (dev uses SQLite).

**Compliance reality — not optional.** This product stores personal health information and makes longevity/health claims. Before real users enter real health data you need: a privacy/security posture (HIPAA and/or GDPR depending on market), a Privacy Policy + Terms, a Data Processing Agreement for enterprise customers, and legal review of how health claims and the "non-diagnostic" positioning are worded. This is a real workstream (Phase 7), not a checkbox. Get a lawyer with health-tech experience involved early. *(This document is engineering guidance, not legal advice.)*

**Go-to-market note:** you said "both" B2B and B2C. The data model already supports both. I recommend **leading with one** for your first customers to focus the onboarding and billing work — but build so the other isn't blocked. Phases below flag where the two diverge.

---

## Phase 0 — Production infrastructure

Goal: the app runs on real, durable infrastructure instead of a local SQLite file.

Claude Code tasks:
1. **Switch the database to Postgres.** In `prisma/schema.prisma` change `provider = "sqlite"` to `"postgresql"`. Provision a managed Postgres (Neon or Supabase are the fastest). Put the connection string in `DATABASE_URL`.
2. **Move from `db push` to real migrations.** Introduce `prisma migrate dev` / `prisma migrate deploy`. Commit the `prisma/migrations/` folder. Update `package.json` scripts and `vercel.json` build command accordingly (build should run `prisma generate && prisma migrate deploy && next build`).
3. **Secrets.** Generate a strong `AUTH_SECRET` (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`). Never commit real secrets — keep `.env.example` as the template only. Set all env vars in the host (Vercel project settings).
4. **Security hardening.** Add security headers (CSP, HSTS, X-Frame-Options) via `next.config.mjs` or middleware. Add rate limiting on `/api/auth/*` and `/api/assistant` (e.g. Upstash Ratelimit). Confirm the session cookie is `httpOnly`, `secure`, `sameSite=lax`.
5. **Observability.** Add error tracking (Sentry) and structured logging. Add uptime monitoring against the existing `/api/health` route.
6. **CI/CD.** GitHub Actions running `npm run typecheck`, `npm test`, `npm run build` on every PR; deploy on merge to main.

Acceptance: app deploys to a public HTTPS URL on Postgres; migrations run in CI; health check green; secrets only in host env.

---

## Phase 1 — Real accounts, onboarding & data intake (highest priority)

This is the single biggest gap. Today no real user can exist. Until this works, nothing else matters.

Claude Code tasks:
1. **Email provider.** Wire a transactional email service (Resend or Postmark). Needed for verification and password reset.
2. **Signup flows** (build the one for your lead buyer first):
   - *B2C member self-signup:* create a `User` (role `MEMBER`) under a personal/free tenant, or a shared consumer tenant — decide the tenancy model and document it. Email verification required before login.
   - *B2B enterprise signup:* an employer admin creates an `ENTERPRISE` tenant, then invites members by email; invited members set their own password and land in that tenant.
3. **Password reset** (request → emailed token → set new password), reusing the existing `bcrypt` + `jose` stack.
4. **Member onboarding / intake flow.** Replace seeded `MemberProfile.intake` JSON with a real multi-step form that captures goals, questionnaires, sleep, activity, and lifestyle inputs, writing to the real profile. This is what feeds the score engine in Phase 2.
5. **Consent capture.** Turn the `consent` field into a real, timestamped, revocable consent UI (record consent version + date; revocation removes the member from aggregate cohorts, honoring the privacy promise in the passport page).
6. **Retire synthetic data for real tenants.** Keep the seed for local dev only; ensure production starts empty and is populated by real signups. Mark any demo tenants with the existing `isDemo` flag and never mix them into real analytics.

Acceptance: a brand-new person can sign up, verify email, complete onboarding, and see a passport built from *their own* inputs — with zero seeded data involved.

---

## Phase 2 — Real health-score engine

Goal: scores are computed and explainable, not hardcoded.

Claude Code tasks:
1. **Scoring service** (`src/lib/scoring/`): given a member's intake (and later lab/wearable data), compute each domain score (metabolic, cardiovascular, sleep, cognitive, activity) with **transparent, documented, non-diagnostic rules**. Persist results as `HealthspanScore` rows with a generated plain-language `explanation` derived from the actual inputs.
2. **Recompute triggers:** scores recompute when intake changes; keep history (the schema already timestamps `computedAt`).
3. **Action plan generation:** derive `ActionPlan`s from scores/goals. Route any medical or high-risk plan through the human-review gate — set `requiresReview = true` and make it actually block activation until a reviewer approves (ties into the reviewer portal, which already has the review API).
4. **Non-diagnostic guardrails:** every score/plan surfaces the "non-diagnostic, not medical advice" framing already present in the UI.

Acceptance: two members with different intake get different, explainable scores; a high-risk plan cannot activate without reviewer approval.

---

## Phase 3 — Real AI + evidence engine (you said this must be real at launch)

This is the hardest and most regulated part. Budget accordingly.

Claude Code tasks:
1. **Wire the gateway to real providers.** Implement the deferred live path in `src/lib/ai/gateway.ts` — dispatch to the provider SDK by `model.provider` (Anthropic / OpenAI / Google) using the configured key, with structured output. Keep the demo fallback for local dev without keys.
2. **Build the evidence base.** Populate `EvidenceItem` from a real research source (e.g. PubMed API) rather than the 3 fake `example.org` entries. Store source, grade, status, summary, and a real URL.
3. **Retrieval-augmented answers.** Add embeddings + vector search (pgvector on the Postgres DB is the low-friction choice) so the assistant answers are **grounded in the evidence corpus with real citations**, not free-form model output.
4. **Citation verification + safety.** Verify that cited sources actually support the claim; enforce non-diagnostic guardrails; route uncertain/medical queries to the human-review workflow. Never let the assistant give individualized medical advice.
5. **Cost controls.** Per-tenant usage metering and rate limits on model calls (also feeds billing in Phase 5).

Acceptance: a member asks a real longevity question and gets a grounded, citation-backed answer where the citations are real, verifiable papers from the evidence base — with the demo badge gone.

---

## Phase 4 — Real enterprise analytics

Goal: the employer portal shows real, privacy-protected aggregates.

Claude Code tasks:
1. Compute `AggregateMetric` rows from **real member cohorts** within the tenant (participation, average healthspan, risk shares, etc.).
2. **Enforce k-anonymity:** suppress any cohort below `K_ANONYMITY_MIN`. Verify no query path can expose an individual member's identifiable data to an employer — this is the core privacy promise and a selling point.
3. Refresh aggregates on a schedule (cron / scheduled job).

Acceptance: employer sees only aggregates; a cohort under the threshold is suppressed; there is no code path from the enterprise portal to identifiable PHI.

---

## Phase 5 — Billing & monetization

Claude Code tasks:
1. **Stripe integration.** B2C: member subscriptions (map to the plans the member portal references). B2B: enterprise contracts / per-seat billing. Handle webhooks for subscription lifecycle.
2. **Plan gating:** gate features by plan/entitlement; enforce server-side, not just UI.
3. **Billing admin:** surface subscription status in the platform admin portal.

Acceptance: a user can subscribe, pay, and have access gated by their plan; webhooks keep entitlements in sync.

---

## Phase 6 — Public marketing site

Goal: something you can actually point prospects at.

Claude Code tasks:
1. Replace the skeleton homepage (`src/app/page.tsx`) with a real landing page: value proposition, the five-portal story, social proof placeholders, and clear CTAs (member signup / "book a demo" for enterprise).
2. Pricing page, about, contact, and the legal pages from Phase 7.
3. SEO basics (metadata, sitemap, OpenGraph) and analytics.

Acceptance: a cold visitor understands the product and can sign up or request a demo.

---

## Phase 7 — Compliance, security & trust (do before real health data goes in)

Not a phase to skip. Work in parallel with a health-tech lawyer.

Claude Code tasks (engineering side):
1. **Audit logging** on every access to health data (the `AuditLog` model exists — make it comprehensive).
2. **Encryption at rest** for sensitive fields; TLS everywhere (host-provided).
3. **GDPR/data-subject rights:** data export and account/data deletion flows.
4. **Access reviews:** re-verify tenant isolation and RBAC can't be bypassed (extend the existing Vitest tests in `tests/`).
5. **Backups + disaster recovery** on the Postgres DB.
6. **Pen test / security review** before launch.

Founder side (not Claude Code): Privacy Policy, Terms of Service, DPA for enterprise customers, HIPAA posture (BAAs if applicable in the US), and legal sign-off on health-claim wording.

---

## Suggested sequencing

Ship in this order, deploying after each: **Phase 0 → 1 → 2 → 3 → (4 or 5 depending on your lead buyer) → 6 → 7 woven throughout.** Phase 7's engineering pieces should be built *alongside* Phases 1–3, not bolted on at the end, because they touch how data is stored.

**Realistic expectation:** Phases 0–1 are a few focused weeks and get you a real, usable product with real signups. Phase 3 (real AI + evidence + RAG + safety) is the largest single effort and the main driver of your timeline. "Both buyers + real AI at launch" is the maximal scope — if you want to be in-market sooner, the highest-leverage cut is to lead with one buyer type and let the AI ship as grounded-retrieval first, with fancier reasoning following.
