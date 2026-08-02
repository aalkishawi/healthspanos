# Known issues

Everything found and deliberately not fixed yet, with the reason. Nothing here
is forgotten — each item names the phase it belongs to or why it was deferred.

Fixed items move to the bottom rather than disappearing, so the record of what
was wrong survives.

Last updated: 2026-08-02 (during Phase 2).

---

## Open

### 1. New Phase 1 pages are not wired to i18n — MEDIUM
**Where:** `src/app/{signup,verify-email,forgot-password,reset-password,accept-invite}/**`,
`src/app/member/onboarding/**`, `src/components/auth/AuthShell.tsx`

Strings are hardcoded English. The Arabic dictionary (`src/lib/i18n/dictionaries/ar.ts`)
and the RTL scaffolding still work and are not broken, but these pages will not
translate. CLAUDE.md says preserve the i18n plumbing — it is preserved, just not
extended to the new surfaces.

**Why deferred:** wiring ~120 strings through the dictionary is mechanical but
large, and doing it mid-phase would have buried the actual Phase 1 logic in a
translation diff. English is the launch locale.

**Fix:** add the keys to `en.ts` / `ar.ts` and replace the literals. Best done
as one dedicated pass over all new pages at once.

---

### 2. No way to revoke an invitation — LOW
**Where:** `prisma/schema.prisma` (`Invitation.revokedAt`), `src/app/enterprise/InvitePanel.tsx`

The column exists and the UI renders a "Revoked" state, but nothing can set it.
An admin who invites the wrong address cannot withdraw the invitation.

**Mitigation in place:** re-inviting the same address replaces the token, so the
old link dies. That covers the common mistake (typo, resend) but not "I invited
someone who should not have been invited".

**Fix:** `DELETE /api/enterprise/invites` setting `revokedAt`, plus a button.

---

### 3. Expired auth tokens are never purged — LOW
**Where:** `AuthToken` table

Consumed and expired rows accumulate forever. They are inert — `tokenState()`
rejects anything used or past `expiresAt` — so this is housekeeping, not a
security hole. It will eventually be a large table of dead rows.

**Fix:** a scheduled job deleting `usedAt IS NOT NULL OR expiresAt < now()`
older than ~30 days. Wants the cron infrastructure Phase 4 introduces.

---

### 4. Scoring thresholds have had no clinical review — MEDIUM (blocks launch, not development)
**Where:** `src/lib/scoring/rules.ts`

The domain thresholds are directional product defaults reflecting broadly
uncontroversial public-health orientation. They are not derived from a validated
instrument. The file says so, and every surface carries the non-diagnostic
framing.

**Why it is not a bug:** the rules are transparent, explainable, and honest about
what they are. But shipping health-adjacent numbers to real people needs a
clinician to have read them.

**Fix:** Phase 7 (compliance), alongside the health-claims legal review the plan
already calls for. Phase 3's evidence base is where citations attach.

---

### 5. `askAssistant()` reports `demo: false` while returning a placeholder — HIGH (latent)
**Where:** `src/lib/ai/gateway.ts:61`

With **no** provider key the gateway correctly returns the demo notice with
`demo: true` — honest, and what a user sees today.

With a key **configured** it returns:
```ts
{ answer: "Live model integration pending.", citations: [], model: model.id, demo: false }
```

`demo: false` is untrue. The moment a real key is set, every surface that trusts
that flag will drop the demo badge and present a placeholder sentence as a
genuine, citation-backed answer. On a health product that is the worst failure
mode in the file. CLAUDE.md rule 3 names this exact function as the
anti-pattern.

**Why not fixed now:** the live path is explicitly Phase 3
(`PRODUCTION_BUILD_PLAN.md` line 84) and CLAUDE.md forbids jumping ahead.

**Interim safety:** do not set `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` /
`GEMINI_API_KEY` in any environment real users can reach until Phase 3 lands.
Today they are all empty, so the honest demo path is what runs.

**Fix (Phase 3):** dispatch to the provider SDK, and until that works return
`demo: true` — a placeholder must never claim to be a live answer.

---

### 6. Research Assistant is in demo mode — NOT A BUG, scheduled
**Where:** `/member/assistant`

Returns "Demo mode: connect an AI provider key…". This is the documented
foundation state (`PRODUCTION_BUILD_PLAN.md` line 20, CLAUDE.md line 6) and is
scheduled for **Phase 3**. The message is deliberately explicit rather than
fabricating an answer, which is the behaviour CLAUDE.md rule 3 asks for.

Listed here only so it is not re-reported as a defect. See item 5 for the part
that *is* a real problem.

---

### 7. `next start` holds the Prisma engine DLL on Windows — LOW (dev-only)
**Where:** local development

`npm run build` fails with `EPERM: rename query_engine-windows.dll.node` while a
server is running. Stop the server before rebuilding. Windows-only; does not
affect CI or Vercel.

---

## Fixed

### ✅ Demo banner shown to real users (Phase 1, fixed 2026-08-02)
`PortalShell` rendered "Demo environment — synthetic data only" unconditionally,
so a real member viewing their real health data was told it was fake. Now gated
on `tenant.isDemo`. Commit `5c4cfcc`.

### ✅ Email links frozen at build time (Phase 1, fixed 2026-08-02)
Next inlines `NEXT_PUBLIC_*` at build time even in server code, so
`NEXT_PUBLIC_APP_URL` could not be corrected at runtime — a build promoted
between environments kept emailing links to the old host. `appBaseUrl()` now
prefers the runtime-readable `APP_BASE_URL`, then `VERCEL_URL`. Commit `5c4cfcc`.

### ✅ Stale consent badge (Phase 1, fixed 2026-08-02)
Granting consent left the server-rendered badge reading PENDING while the panel
said GRANTED. `ConsentPanel` now calls `router.refresh()`. Commit `5c4cfcc`.

### ✅ Email validation rejected trailing whitespace (Phase 1, fixed 2026-08-02)
`EmailSchema` validated before normalising, so mobile autofill's trailing space
failed as "invalid email address". Now trims and lowercases first. Caught by a
new test.

### ✅ Misleading breadcrumb (Phase 1, fixed 2026-08-02)
The member portal's accent label read "Healthspan Passport" on every page,
including `/member/onboarding`. It labels the portal, so it now reads "Member".
