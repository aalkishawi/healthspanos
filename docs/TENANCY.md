# Tenancy model

Decided in Phase 1 (accounts & onboarding). This governs where a user's data
lives and therefore who can ever see it.

## The rule

**One tenant = one privacy boundary.** Every tenant-scoped query passes through
`tenantScope()` in `src/lib/tenant.ts`, so the tenant is not an organisational
label — it is the mechanism that keeps one person's health data away from
another's.

## B2C self-signup → a personal tenant per member

A member who signs up on their own gets their **own** `Tenant` with
`type = INDIVIDUAL`, named after them, containing exactly one user.

### Why not one shared "consumer" tenant

That was the obvious alternative and it is wrong here:

1. **It disarms the only structural isolation we have.** With every consumer in
   one tenant, `tenantScope()` returns the same `tenantId` for all of them.
   A single missing `where` clause stops being a bug in one member's view and
   becomes a cross-member PHI leak. With personal tenants the same bug leaks
   nothing, because the scope already excludes everyone else.
2. **It corrupts aggregate analytics.** Enterprise metrics aggregate per tenant.
   A shared consumer tenant would look like a 10,000-person "employer" cohort
   made of unrelated strangers, and would pass the k-anonymity check while
   describing nothing real.
3. **It makes the B2C → B2B path a data-untangling exercise.** When a consumer's
   employer later buys HealthspanOS, moving them means extracting their rows
   from a shared pool. With a personal tenant it is a `tenantId` reassignment.

### What it costs

One `Tenant` row per member. That is the entire cost — tenants are cheap, and
the row is created inside the same transaction as the user, so a partial signup
cannot leave an orphan.

## B2B enterprise signup → one tenant per organisation

An enterprise admin creates a `Tenant` with `type = ENTERPRISE` and invites
members by email. Invited members join **that** tenant; they never get a
personal one. The employer sees only k-anonymised aggregates
(`K_ANONYMITY_MIN`), never identifiable member data — enforced at the query
layer, not by UI omission.

## Consequences to preserve

- `INDIVIDUAL` tenants must never appear in enterprise analytics. They are a
  different `type` precisely so that filter is expressible.
- A member's consent withdrawal removes them from aggregate cohorts
  (`MemberProfile.consent != GRANTED`), independent of tenancy.
- Demo/synthetic tenants carry `isDemo = true` and are excluded from real
  analytics. Production starts empty; `prisma/seed.ts` is local-dev only.

## If this is ever revisited

The pressure to switch to a shared consumer tenant will come from per-tenant
cost or reporting convenience. Neither is a good enough reason on its own — the
isolation property above is load-bearing for a product holding health data.
Changing it means replacing `tenantScope()` with row-level ownership checks
everywhere, which is a larger and riskier change than it appears.
