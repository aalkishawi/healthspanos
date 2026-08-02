# Claude Code — paste-ready prompts

Feed these to Claude Code **one at a time, in order.** After each phase, Claude Code stops and reports; you verify it actually works, then paste the next one. Every prompt assumes `CLAUDE.md` and `PRODUCTION_BUILD_PLAN.md` are in the repo root (they are).

Before pasting the first one, make sure you have accounts/keys ready for at least: Neon (Postgres), and an AI provider (Anthropic or OpenAI). The others (Resend, Stripe, Sentry, Upstash) can be added at the phase that needs them.

---

## ▶ PROMPT 1 — Phase 0: Production infrastructure  (paste this first)

```
Read CLAUDE.md and PRODUCTION_BUILD_PLAN.md in full. You are doing PHASE 0 only — production infrastructure. Do not start any later phase.

Scope:
1. Switch Prisma from SQLite to PostgreSQL. Update prisma/schema.prisma provider to "postgresql". Set up prisma migrate (dev + deploy), create the initial migration, and commit prisma/migrations/. Update package.json scripts and vercel.json so the production build runs: prisma generate && prisma migrate deploy && next build. Keep local dev able to run against a local/Neon Postgres.
2. Add security headers (CSP, HSTS, X-Frame-Options, etc.) and confirm the session cookie is httpOnly + secure + sameSite=lax. Add rate limiting (Upstash) on /api/auth/* and /api/assistant.
3. Add Sentry error tracking and structured logging. Keep the existing /api/health route and make it verify DB connectivity.
4. Add a GitHub Actions CI workflow running: npm run typecheck, npm test, npm run build on every PR.
5. Update .env.example with every new variable, documented, no real values.

Constraints: follow CLAUDE.md exactly — no fake data, server-side authz, tests must pass, meet the Definition of Done. I will provide the Neon DATABASE_URL and any keys you ask for; list precisely which env vars I must set. When done, STOP and report against the Definition of Done, then tell me the next prompt to paste.
```

---

## ▶ PROMPT 2 — Phase 1: Real accounts, onboarding & data intake

```
Read CLAUDE.md and PRODUCTION_BUILD_PLAN.md. You are doing PHASE 1 only — real accounts, onboarding, and data intake. This is the highest-priority gap: today no real user can exist. Do not start any later phase.

Build:
1. Wire Resend for transactional email.
2. Signup flows: (a) B2C member self-signup with email verification; (b) B2B enterprise signup where an admin creates an ENTERPRISE tenant and invites members by email. Decide and document the tenancy model for self-signup members.
3. Password reset (request → emailed token → set new), reusing the existing bcrypt + jose stack.
4. Member onboarding/intake: a real multi-step form capturing goals, questionnaires, sleep, activity, and lifestyle inputs, writing to MemberProfile — replacing the seeded intake JSON.
5. Real, timestamped, revocable consent capture (record consent version + date; revocation removes the member from aggregate cohorts).
6. Ensure production starts empty; keep prisma/seed.ts for local dev only and mark demo tenants isDemo.

Acceptance: a brand-new person can sign up, verify email, complete onboarding, and see a passport built from THEIR OWN inputs, with zero seeded data. Add tests. Follow CLAUDE.md and the Definition of Done. STOP and report when done, and list new env vars I must set.
```

---

## ▶ PROMPT 3 — Phase 2: Real health-score engine

```
Read CLAUDE.md and PRODUCTION_BUILD_PLAN.md. PHASE 2 only — the real health-score engine. Do not start a later phase.

Build a scoring service (src/lib/scoring/) that computes each domain score (metabolic, cardiovascular, sleep, cognitive, activity) from a member's real intake using transparent, documented, non-diagnostic rules, persisting HealthspanScore rows with a generated plain-language explanation derived from the actual inputs. Recompute on intake change and keep history. Generate ActionPlans from scores/goals, and make the human-review gate real: requiresReview=true must block activation until a reviewer approves via the existing reviewer review API. Keep non-diagnostic framing everywhere.

Acceptance: two members with different intake get different, explainable scores; a high-risk plan cannot activate without reviewer approval. Add tests covering the scoring rules and the review gate. Follow CLAUDE.md + Definition of Done. STOP and report when done.
```

---

## ▶ PROMPT 4 — Phase 3: Real AI + evidence engine

```
Read CLAUDE.md and PRODUCTION_BUILD_PLAN.md. PHASE 3 only — the real AI + evidence engine (this is the core value; do it thoroughly). Do not start a later phase.

Build:
1. Implement the deferred live path in src/lib/ai/gateway.ts — dispatch to the real provider SDK by model.provider (Anthropic / OpenAI / Google) with structured output, keeping the demo fallback for local dev without keys.
2. Populate EvidenceItem from PubMed E-utilities (real source, grade, status, summary, real URL) instead of the fake example.org entries.
3. Add retrieval-augmented answers: embeddings + pgvector search so the assistant is grounded in the evidence corpus with real, verifiable citations — not free-form model output.
4. Verify citations actually support the claim; enforce non-diagnostic guardrails; route uncertain/medical queries to the human-review workflow; never give individualized medical advice.
5. Add per-tenant usage metering + rate limits on model calls.

Acceptance: a member asks a real longevity question and gets a grounded, citation-backed answer whose citations are real papers from the evidence base, with the demo badge gone. Add tests. Follow CLAUDE.md + Definition of Done. STOP and report when done, and list new env vars/keys I must set.
```

---

## ▶ PROMPT 5 — Phase 4: Real enterprise analytics

```
Read CLAUDE.md and PRODUCTION_BUILD_PLAN.md. PHASE 4 only — real enterprise analytics. Do not start a later phase.

Compute AggregateMetric rows from real member cohorts within a tenant (participation, average healthspan, risk shares). Enforce k-anonymity: suppress any cohort below K_ANONYMITY_MIN. Verify there is NO code path from the enterprise portal to identifiable member data. Refresh aggregates on a schedule. Add tests proving suppression works and that identifiable PHI can't leak to an employer. Follow CLAUDE.md + Definition of Done. STOP and report when done.
```

---

## ▶ PROMPT 6 — Phase 5: Billing & monetization

```
Read CLAUDE.md and PRODUCTION_BUILD_PLAN.md. PHASE 5 only — billing. Do not start a later phase.

Integrate Stripe: B2C member subscriptions and B2B enterprise/per-seat billing, with webhook handling for the subscription lifecycle. Gate features by plan/entitlement, enforced server-side (not just UI). Surface subscription status in the platform admin portal. Add tests for entitlement gating and webhook handling. Follow CLAUDE.md + Definition of Done. STOP and report when done, and list Stripe env vars/webhook setup I must do.
```

---

## ▶ PROMPT 7 — Phase 6: Public marketing site

```
Read CLAUDE.md and PRODUCTION_BUILD_PLAN.md. PHASE 6 only — the public marketing site. Do not start a later phase.

Replace the skeleton homepage (src/app/page.tsx) with a real landing page: value proposition, the five-portal story, CTAs (member signup / book-a-demo for enterprise). Add pricing, about, contact, and placeholders for the legal pages. Add SEO basics (metadata, sitemap, OpenGraph) and analytics. Keep the design tokens — no hardcoded hex. Follow CLAUDE.md + Definition of Done. STOP and report when done.
```

---

## ▶ PROMPT 8 — Phase 7: Compliance, security & trust

```
Read CLAUDE.md and PRODUCTION_BUILD_PLAN.md. PHASE 7 — compliance & security engineering (the legal/policy side is handled separately by me with counsel).

Make AuditLog comprehensive (log every access to health data). Add encryption at rest for sensitive fields. Build GDPR data-subject flows: data export and full account/data deletion. Extend the Vitest tests in tests/ to re-verify tenant isolation and RBAC can't be bypassed. Set up Postgres backups and document a disaster-recovery runbook. Produce a pre-launch security checklist. Follow CLAUDE.md + Definition of Done. STOP and report when done.

NOTE: Phase 7's engineering pieces should ideally have been woven into Phases 1–3. If any were skipped, flag them.
```
