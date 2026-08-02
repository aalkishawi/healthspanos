# Known issues

Everything found and deliberately not fixed yet, with the reason. Nothing here
is forgotten — each item names the phase it belongs to or why it was deferred.

Fixed items move to the bottom rather than disappearing, so the record of what
was wrong survives.

Last updated: 2026-08-02 (end of Phase 7).

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

### ~~5. `askAssistant()` reports `demo: false` while returning a placeholder~~ — FIXED in Phase 3
See the Fixed section.

### 5b. Live RAG path is unverified end to end — MEDIUM (needs a key)
**Where:** `src/lib/ai/answer.ts`, `src/lib/evidence/`

Everything up to the model call is verified against real data: PubMed ingestion
(10 real papers), safety gating, the honest demo path, and the audit trail. The
generate → verify → cite leg has only been exercised by unit tests, because no
provider key is configured on this machine, and embeddings additionally require
`OPENAI_API_KEY`.

**What is NOT yet demonstrated:** a live grounded answer with verified citations
against the real corpus. That is the phase's headline acceptance criterion, and
it is honestly outstanding.

**To close it:** set `OPENAI_API_KEY` (embeddings are mandatory regardless of
which provider answers), run `npm run evidence:ingest`, then ask a longevity
question in the member portal. Expect the badge to read "Grounded in evidence"
and each source to show a quote verified against its abstract.

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

### 8. Encryption key has no rotation path — MEDIUM (Phase 7, deferred)
**Where:** `src/lib/security/encryption.ts`

`FIELD_ENCRYPTION_KEY` can be set, but not changed. Rotating it means decrypting
every `MemberProfile.intake` with the old key and re-encrypting with the new one,
and there is no script for that. If the key is suspected compromised today, the
only options are manual SQL or accepting the exposure.

**Why deferred:** the envelope already carries a `v1` version tag, so a rotation
script can be added without a data migration. Not needed before the first key
exists in production, but needed before an incident.

**Fix:** a `scripts/rotate-encryption-key.ts` reading `OLD_KEY`/`NEW_KEY`,
batching over profiles in a transaction.

---

### 9. Encryption covers `intake` only — LOW (accepted trade-off, revisit at scale)
**Where:** `prisma/schema.prisma`

Scores, bands and explanations are stored in plaintext. This is deliberate —
they have to be aggregated for employer analytics, and encrypted columns cannot
be. But an explanation string is health-derived and can be quite specific.

**Mitigation in place:** k-anonymity on every aggregate read, tenant scoping, and
audit logging of bulk access. Documented in `docs/SECURITY_AND_DR.md`.

---

## Fixed

### ✅ Account deletion destroyed its own audit trail (Phase 7, fixed 2026-08-02)
`deleteUserData()` anonymised the audit rows, then deleted the personal tenant —
which cascaded `AuditLog.tenantId` and took the retained trail to zero rows. The
function carefully preserved the evidence and then destroyed it one statement
later, so a completed deletion left nothing to prove it had happened.

Found only by running export and deletion end to end against a real database;
every unit test passed before and after. Personal tenants are now tombstoned
(renamed, `SUSPENDED`) rather than deleted, and an explicit
`gdpr.account_deleted` row is written. Guarded by five structural assertions in
`tests/security.access-review.test.ts`.

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

### ✅ askAssistant() claimed demo:false while returning a placeholder (fixed in Phase 3)
The old gateway returned `{ answer: "Live model integration pending.", demo: false }`
whenever a key was configured, so setting a key would have made the UI drop the
demo badge and present a stub as a real citation-backed health answer. The
gateway now runs a real pipeline, and every non-live branch reports
`demo: true`. Verified live: with no key, a general question returns
`demo: true` and says exactly why.

### ✅ PubMed numeric HTML entities left raw (fixed in Phase 3)
Titles ingested as `APOE &#x3b5;4` instead of `APOE ε4`. Named entities were
decoded, numeric ones were not — and medical literature is full of them (ε, μ,
≥). Raw entities poison the title, the embedding, and any verification quote
drawn from the abstract. Caught by reading real ingested records, not by a test.

### ✅ Misleading breadcrumb (Phase 1, fixed 2026-08-02)
The member portal's accent label read "Healthspan Passport" on every page,
including `/member/onboarding`. It labels the portal, so it now reads "Member".
