# Security posture, backups and disaster recovery

Engineering-side record of what is implemented, what is configured by the
founder, and what is still open. Written to be honest rather than reassuring —
a security document that lists only the wins is a sales document.

Last updated: 2026-08-03 (end of Phase 7).

---

## Implemented in code

| Control | Where | Notes |
|---|---|---|
| Tenant isolation | `src/lib/tenant.ts` | Every scoped query goes through `tenantScope`. Only `PLATFORM_ADMIN` can opt into cross-tenant, and only explicitly. |
| Portal RBAC | `src/lib/rbac.ts`, `src/middleware.ts` | Edge guard plus a per-page `requirePortal`. |
| k-anonymity | `src/lib/analytics/read.ts` | Single read path. Suppresses the value **and** the cohort size below `K_ANONYMITY_MIN` (10). |
| Password storage | `src/lib/accounts.ts` | bcrypt, cost 12. Never recoverable. |
| Emailed credentials | `src/lib/tokens.ts` | 256-bit, single-use, expiring, stored only as SHA-256. A database leak contains no working links. |
| Session | `src/lib/auth.ts` | JWT in an httpOnly, sameSite=lax cookie; secure in production. |
| Rate limiting | `src/lib/ratelimit.ts`, `src/middleware.ts` | All of `/api/auth/*`, the assistant, and the public contact form. |
| Security headers | `next.config.mjs` | CSP, HSTS (prod only), frame-ancestors none, nosniff, COOP/CORP, no-store on `/api/*`. |
| AI safety | `src/lib/ai/safety.ts` | Deterministic classification before any model call. Emergencies signposted, individual-medical escalated. |
| Citation verification | `src/lib/ai/verify.ts` | A citation must name a retrieved paper **and** quote it verbatim; the quote is checked against the stored abstract. |
| Field encryption | `src/lib/security/encryption.ts` | AES-256-GCM on `MemberProfile.intake`. Opt-in via `FIELD_ENCRYPTION_KEY`. |
| Access audit | `src/lib/security/audit.ts` | Reads of health data are logged, not just writes. Surfaced to the member at `/account`. |
| Data-subject rights | `src/lib/security/datasubject.ts` | Self-service export and deletion, both re-authenticated. Verified end-to-end against a live database, not only by unit test. |
| Webhook authenticity | `src/lib/billing/stripe.ts` | HMAC-SHA256, constant-time, 5-minute replay window. |
| Log redaction | `src/lib/logger.ts` | Forbidden-key list; health content cannot reach application logs even if a caller passes it. |

Access-review assertions live in `tests/security.access-review.test.ts` and fail
the build if a guard is weakened.

---

## Field encryption rollout

Encryption is **off** until `FIELD_ENCRYPTION_KEY` is set, and enabling it needs
no migration:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Reads accept both shapes — rows written before the key existed are plaintext,
rows written after are encrypted envelopes. Existing rows migrate naturally the
next time a member updates their intake.

**Key loss is data loss.** There is no recovery path for encrypted intake if the
key is lost; that is the point of encryption. Store it in a password manager or
a secrets service, not only in Vercel. Rotating the key requires decrypting with
the old key and re-encrypting with the new one — there is no rotation script
yet, which is listed as open below.

---

## What deletion actually does

Worth stating precisely, because "we delete everything" is usually not true and
the difference matters in an audit.

**Removed:** the user row, the member profile and intake, every computed index
and explanation, action plans, consent records, auth tokens, and the full
assistant question-and-answer history. All of it, irrecoverably.

**Retained:** audit rows, with `userId` set to `NULL`. They record that an event
of a given type occurred at a given time in a given tenant, and carry no name,
email or health content. A deletion that erases the evidence of itself cannot be
proven to a regulator or to the member.

**Tombstoned, not deleted:** a personal (`INDIVIDUAL`) tenant is renamed to
`Deleted account (…)` and set to `SUSPENDED`. It holds no members and no data.

That last point is a **corrected defect**, recorded here rather than quietly
fixed. The original implementation deleted the personal tenant, which cascaded
`AuditLog.tenantId` and reduced the retained trail to zero rows — the code
carefully anonymised the audit log and then destroyed it one statement later.
Unit tests passed throughout; only an end-to-end run against a real database
surfaced it. `tests/security.access-review.test.ts` now guards against its
return, and it is the reason deletion is verified against a live database.

---

## Backups and disaster recovery

**Configured by the founder in Neon — not something the application can do for
itself.**

### What Neon provides
- Point-in-time restore within the retention window of your plan. On the free
  tier this is short; a paid tier is required for a meaningful RPO.
- Branching, which makes a pre-migration safety branch cheap.

### What to set up before real data
1. **Raise PITR retention** to at least 7 days. Free-tier retention is not a
   backup strategy for health records.
2. **Take a branch before every migration.** `prisma migrate deploy` runs during
   the Vercel build; a bad migration is the most likely cause of data loss here,
   and a branch makes it reversible in minutes.
3. **Test a restore.** An untested backup is a belief, not a backup. Restore to
   a branch, point a preview deployment at it, and confirm a member can sign in
   and see their passport.
4. **Store `FIELD_ENCRYPTION_KEY` separately from the database.** A backup and
   its decryption key in the same place is one breach, not two.

### Targets to agree
| | Suggested | Why |
|---|---|---|
| RPO (data loss tolerated) | ≤ 1 hour | PITR supports this; members re-entering intake is a poor failure mode. |
| RTO (time to restore) | ≤ 4 hours | Restore-to-branch plus a redeploy is well inside this. |

### Runbook sketch
1. Stop writes — put the Vercel deployment into maintenance or roll back.
2. Create a Neon branch at the last-good timestamp.
3. Point `DATABASE_URL`/`DIRECT_URL` at the branch; redeploy.
4. Verify: sign in, load a passport, check `/api/health` reports `db.up`.
5. Recompute aggregates (`npm run analytics:recompute`) — they are derived and
   safe to regenerate.

---

## Open items

Listed plainly. None of these should be treated as done.

1. **No independent penetration test.** Required before real health data at
   scale. The controls above are self-assessed.
2. **No key-rotation script** for `FIELD_ENCRYPTION_KEY`.
3. **Legal review outstanding.** `/legal/*` accurately describes system
   behaviour but has not been reviewed by a lawyer, and each page says so.
4. **No HIPAA posture.** If the US market is in scope, that means BAAs with
   Neon, Vercel, Resend, Stripe and the AI providers — and the AI providers in
   particular need checking, since member questions transit them.
5. **Scoring thresholds have had no clinical review** (`docs/KNOWN_ISSUES.md`
   item 4).
6. **Encryption covers `intake` only.** Scores and explanations are plaintext by
   design — they must be aggregated — but they are health-derived, and that
   trade-off deserves a second look before scale.
7. **No automated PHI-in-logs detector.** The logger redacts a known key list;
   a new field with an unexpected name would not be caught automatically.

---

## Founder-side (not engineering)

From `PRODUCTION_BUILD_PLAN.md` Phase 7, unchanged and still outstanding:
Privacy Policy, Terms of Service, a DPA for enterprise customers, HIPAA posture
including BAAs where applicable, and legal sign-off on how every health claim is
worded.
