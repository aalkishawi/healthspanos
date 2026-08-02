// Single-use, expiring credentials sent by email: verification links, password
// resets, invitations.
//
// The raw token is returned to the caller ONCE, to put in an email, and never
// stored. Only its SHA-256 goes to the database — same reasoning as
// passwordHash. A leaked database dump must not contain live reset links.
//
// SHA-256 rather than bcrypt is correct here and deliberate: these are 256 bits
// of CSPRNG output, not human-chosen passwords, so there is no dictionary to
// slow down and the lookup has to be a fast indexed equality check.
import { createHash, randomBytes, timingSafeEqual } from "crypto";

/** Lifetimes. Reset is deliberately the shortest — it takes over an account. */
export const TOKEN_TTL_MS = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000, // 24h
  PASSWORD_RESET: 60 * 60 * 1000, //  1h
  INVITATION: 7 * 24 * 60 * 60 * 1000, //  7d
} as const;

export type TokenPurpose = keyof typeof TOKEN_TTL_MS;

/** A fresh token: `raw` goes in the email, `hash` goes in the database. */
export function createToken(purpose: TokenPurpose): {
  raw: string;
  hash: string;
  expiresAt: Date;
} {
  const raw = randomBytes(32).toString("base64url"); // 256 bits
  return {
    raw,
    hash: hashToken(raw),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS[purpose]),
  };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Constant-time comparison of two token hashes.
 *
 * Lookups are by indexed `tokenHash`, which is already an equality match inside
 * Postgres; this exists for the paths that compare in application code, so a
 * timing signal can't be used to discover a valid hash byte by byte.
 */
export function tokenHashEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export type TokenState = "valid" | "expired" | "used" | "not-found";

/**
 * Validate a stored token record. Pure so the rules are testable without a
 * database: a token is usable only if it exists, has not been consumed, and has
 * not expired.
 */
export function tokenState(
  record: { expiresAt: Date; usedAt?: Date | null } | null,
  now: Date = new Date(),
): TokenState {
  if (!record) return "not-found";
  if (record.usedAt) return "used";
  if (record.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

/**
 * The single user-facing message for every unusable token.
 *
 * Deliberately identical across expired / used / not-found: distinguishing them
 * tells an attacker whether a guessed token ever existed, and tells them when a
 * real one was consumed.
 */
export const INVALID_TOKEN_MESSAGE =
  "That link is invalid or has expired. Please request a new one.";
