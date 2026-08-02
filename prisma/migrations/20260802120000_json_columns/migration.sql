-- Convert stringified-JSON text columns to native jsonb.
--
-- Hand-written on purpose. Prisma's generated migration for String? -> Json?
-- is DROP COLUMN + ADD COLUMN, which silently discards every existing value.
-- Casting in place preserves the data, so this migration is safe to run against
-- an environment that already holds rows — not only against an empty database.
--
-- NULLIF guards the empty string: ''::jsonb is invalid input, whereas NULL is
-- the correct representation of "no payload".

ALTER TABLE "Tenant"
  ALTER COLUMN "branding" TYPE JSONB USING NULLIF("branding", '')::jsonb;

ALTER TABLE "MemberProfile"
  ALTER COLUMN "intake" TYPE JSONB USING NULLIF("intake", '')::jsonb;

ALTER TABLE "EvidenceItem"
  ALTER COLUMN "signals" TYPE JSONB USING NULLIF("signals", '')::jsonb;

ALTER TABLE "AuditLog"
  ALTER COLUMN "meta" TYPE JSONB USING NULLIF("meta", '')::jsonb;
