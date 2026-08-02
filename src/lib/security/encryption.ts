// Application-level encryption for the most sensitive field we store.
//
// WHAT THREAT THIS ADDRESSES. Neon already encrypts at rest at the volume
// level, which protects against someone walking off with a disk. It does NOT
// protect against a leaked database dump, an over-broad read replica, a
// misconfigured backup bucket, or a support engineer with a psql prompt. Those
// are the realistic ways health data escapes, and they all hand over plaintext
// unless the column itself is encrypted.
//
// SCOPE. Only `MemberProfile.intake` — the free-form health answers. Deliberately
// not the scores or explanations: those are needed for aggregation and search,
// and encrypting them would force decryption of every row to compute a cohort
// average, which is both slow and worse for privacy (it would mean decrypting
// everyone to serve one query).
//
// AES-256-GCM, which is authenticated: tampering with the ciphertext fails
// decryption rather than silently producing different plaintext.
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { log } from "@/lib/logger";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit nonce, the GCM standard
const TAG_BYTES = 16;
// Version prefix so the format can change later without guessing what old rows
// are. A row that does not start with this is plaintext from before rollout.
const PREFIX = "enc:v1:";

export function encryptionConfigured(): boolean {
  return Boolean(process.env.FIELD_ENCRYPTION_KEY);
}

/**
 * 32-byte key from FIELD_ENCRYPTION_KEY (base64 or hex).
 *
 * Throws rather than falling back to a fixed key. A hardcoded default would
 * mean every deployment shares one, which is indistinguishable from no
 * encryption while looking like protection.
 */
function key(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) throw new Error("FIELD_ENCRYPTION_KEY is not set.");
  const buf = raw.length === 64 ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `FIELD_ENCRYPTION_KEY must decode to 32 bytes, got ${buf.length}. ` +
        `Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
  return buf;
}

/** `enc:v1:<iv>.<tag>.<ciphertext>`, all base64. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}.${tag.toString("base64")}.${ct.toString("base64")}`;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function decrypt(value: string): string {
  if (!isEncrypted(value)) return value; // pre-rollout plaintext
  const [ivB64, tagB64, ctB64] = value.slice(PREFIX.length).split(".");
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("Malformed ciphertext.");

  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  if (Buffer.from(tagB64, "base64").length !== TAG_BYTES) throw new Error("Bad auth tag length.");
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}

// ── JSON field helpers ──────────────────────────────────────────────────────
// `intake` is a jsonb column. Encrypted, it is stored as { __enc: "enc:v1:…" }
// so the column stays valid JSON and Prisma's types are unchanged.

type EncryptedEnvelope = { __enc: string };

function isEnvelope(v: unknown): v is EncryptedEnvelope {
  return typeof v === "object" && v !== null && typeof (v as EncryptedEnvelope).__enc === "string";
}

/**
 * Encrypt a JSON value for storage.
 *
 * ROLLOUT IS OPT-IN. With no key configured this returns the value unchanged,
 * so the feature can be enabled without a migration and without breaking a
 * deployment that has not set a key yet.
 */
export function encryptJson(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (!encryptionConfigured()) return value;
  try {
    return { __enc: encrypt(JSON.stringify(value)) };
  } catch (err) {
    // Failing closed here would lose the member's answers. Log loudly and store
    // plaintext rather than dropping data — a misconfigured key is an ops
    // problem, not a reason to discard someone's onboarding.
    log.error("encryption.encrypt_failed_storing_plaintext", err);
    return value;
  }
}

/**
 * Decrypt on read, transparently.
 *
 * Handles BOTH shapes on purpose: rows written before the key existed are
 * plaintext, and rows written after are envelopes. That dual read is what makes
 * enabling encryption a config change rather than a migration with downtime.
 */
export function decryptJson(value: unknown): unknown {
  if (!isEnvelope(value)) return value; // plaintext, or nothing
  try {
    return JSON.parse(decrypt(value.__enc));
  } catch (err) {
    // A decryption failure means the key changed or the row is corrupt. Return
    // null rather than throwing so one bad row cannot take down the passport,
    // but log it as an error — this is data loss until the key is restored.
    log.error("encryption.decrypt_failed", err);
    return null;
  }
}

/** Ops visibility: how much of the corpus is actually encrypted. */
export function encryptionStatus(): { configured: boolean; algorithm: string; scope: string[] } {
  return {
    configured: encryptionConfigured(),
    algorithm: ALGORITHM,
    scope: ["MemberProfile.intake"],
  };
}
