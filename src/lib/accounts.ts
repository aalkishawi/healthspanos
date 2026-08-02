// Account lifecycle: signup, verification, password reset, invitations, consent.
//
// Everything that creates or mutates an identity lives here so the invariants
// are in one auditable place rather than spread across route handlers.
//
// Two rules run through all of it:
//   1. Never reveal whether an email address is registered. Signup, resend and
//      forgot-password all return the same response for known and unknown
//      addresses — otherwise the endpoints become an account-enumeration oracle,
//      which for a health product leaks "this person is a HealthspanOS member".
//   2. A tenant is a privacy boundary (docs/TENANCY.md). Self-signup creates a
//      personal INDIVIDUAL tenant; invited users join the inviting tenant.
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "./db";
import { log } from "./logger";
import { createToken, hashToken, tokenState } from "./tokens";
import { CONSENT_VERSION } from "./intake";

const BCRYPT_ROUNDS = 12;

// ── Password policy ─────────────────────────────────────────────────────────
// Length over composition rules: NIST 800-63B guidance, and composition rules
// mostly produce "Password1!". The blocklist catches the handful of strings
// that pass a length check but are guessed first.
const WEAK = new Set([
  "password", "password1", "password123", "12345678", "123456789", "qwertyui",
  "letmein!", "iloveyou", "welcome1", "admin123", "changeme", "healthspan",
]);

export const PasswordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200, "That password is too long.")
  .refine((p) => !WEAK.has(p.toLowerCase()), "That password is too common — pick something less guessable.")
  .refine((p) => new Set(p).size >= 5, "Use a greater variety of characters.");

// Trim and lowercase BEFORE validating, not after. A trailing space from mobile
// autofill is not an invalid address, and normalising first also means
// "Member@x.com" and "member@x.com" can never become two accounts.
export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(254);

export const NameSchema = z.string().trim().min(1, "Your name is required.").max(120);

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** The response every enumeration-sensitive endpoint returns, hit or miss. */
export const NEUTRAL_ACK = {
  ok: true,
  message: "If that address can be used, we've sent an email. Check your inbox.",
} as const;

// ── B2C self-signup ─────────────────────────────────────────────────────────

export type SignupResult =
  | { created: true; userId: string; tenantId: string; rawToken: string; fullName: string }
  | { created: false; reason: "email-taken" };

/**
 * Create a member and their personal tenant in ONE transaction.
 *
 * Atomicity matters: a tenant with no user is an orphan nothing will ever clean
 * up, and a user with no tenant fails every tenant-scoped query — the account
 * would exist but be unusable.
 */
export async function signupMember(input: {
  email: string;
  password: string;
  fullName: string;
  locale?: string;
}): Promise<SignupResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) return { created: false, reason: "email-taken" };

  const passwordHash = await hashPassword(input.password);
  const token = createToken("EMAIL_VERIFICATION");

  try {
    const { userId, tenantId } = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug: await uniqueSlug(tx, input.fullName || input.email.split("@")[0]!),
          name: `${input.fullName} (personal)`,
          type: "INDIVIDUAL",
          status: "ACTIVE",
          isDemo: false,
        },
      });
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: input.email,
          passwordHash,
          fullName: input.fullName,
          role: "MEMBER",
          locale: input.locale ?? "en",
          // Cannot sign in until the address is confirmed.
          status: "PENDING_VERIFICATION",
        },
      });
      // The profile exists from the start with NO intake — onboarding fills it.
      // An absent profile would make every member page branch on null.
      await tx.memberProfile.create({
        data: { userId: user.id, tenantId: tenant.id, consent: "PENDING" },
      });
      await tx.authToken.create({
        data: { userId: user.id, type: "EMAIL_VERIFICATION", tokenHash: token.hash, expiresAt: token.expiresAt },
      });
      await tx.auditLog.create({
        data: { tenantId: tenant.id, userId: user.id, action: "account.signup", entity: "user" },
      });
      return { userId: user.id, tenantId: tenant.id };
    });

    log.info("account.signup", { userId, tenantId });
    return { created: true, userId, tenantId, rawToken: token.raw, fullName: input.fullName };
  } catch (err) {
    // Unique violation = someone registered the same address between the check
    // and the insert. Same answer as the check above, no special case.
    if (isUniqueViolation(err)) return { created: false, reason: "email-taken" };
    throw err;
  }
}

async function uniqueSlug(tx: { tenant: { findUnique: (a: { where: { slug: string }; select: { id: true } }) => Promise<unknown> } }, base: string): Promise<string> {
  const root =
    base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "member";
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? root : `${root}-${i}`;
    if (!(await tx.tenant.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

// ── Email verification ──────────────────────────────────────────────────────

export type VerifyResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "already-verified" };

export async function verifyEmail(rawToken: string): Promise<VerifyResult> {
  const record = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: { select: { id: true, status: true, tenantId: true } } },
  });
  if (!record || record.type !== "EMAIL_VERIFICATION") return { ok: false, reason: "invalid" };
  if (record.user.status === "ACTIVE" && record.usedAt) return { ok: false, reason: "already-verified" };
  if (tokenState(record) !== "valid") return { ok: false, reason: "invalid" };

  await prisma.$transaction([
    prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({
      where: { id: record.userId },
      data: { status: "ACTIVE", emailVerifiedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: { tenantId: record.user.tenantId, userId: record.userId, action: "account.email_verified", entity: "user" },
    }),
  ]);
  log.info("account.email_verified", { userId: record.userId });
  return { ok: true, userId: record.userId };
}

/** Issue a fresh verification token, invalidating any outstanding one. */
export async function reissueVerification(email: string): Promise<{ rawToken: string; fullName: string } | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, fullName: true, status: true },
  });
  if (!user || user.status !== "PENDING_VERIFICATION") return null;

  const token = createToken("EMAIL_VERIFICATION");
  await prisma.$transaction([
    // Burn outstanding tokens so an older email in the inbox stops working.
    prisma.authToken.updateMany({
      where: { userId: user.id, type: "EMAIL_VERIFICATION", usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.authToken.create({
      data: { userId: user.id, type: "EMAIL_VERIFICATION", tokenHash: token.hash, expiresAt: token.expiresAt },
    }),
  ]);
  return { rawToken: token.raw, fullName: user.fullName };
}

// ── Password reset ──────────────────────────────────────────────────────────

export async function beginPasswordReset(email: string): Promise<{ rawToken: string; fullName: string } | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, fullName: true, status: true },
  });
  // A disabled account must not be recoverable by its former owner.
  if (!user || user.status === "DISABLED") return null;

  const token = createToken("PASSWORD_RESET");
  await prisma.$transaction([
    prisma.authToken.updateMany({
      where: { userId: user.id, type: "PASSWORD_RESET", usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.authToken.create({
      data: { userId: user.id, type: "PASSWORD_RESET", tokenHash: token.hash, expiresAt: token.expiresAt },
    }),
  ]);
  log.info("account.reset_requested", { userId: user.id });
  return { rawToken: token.raw, fullName: user.fullName };
}

export type ResetResult = { ok: true; userId: string } | { ok: false; reason: "invalid" };

export async function completePasswordReset(rawToken: string, newPassword: string): Promise<ResetResult> {
  const record = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: { select: { id: true, tenantId: true, status: true } } },
  });
  if (!record || record.type !== "PASSWORD_RESET" || tokenState(record) !== "valid") {
    return { ok: false, reason: "invalid" };
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Any other live reset token is burned: if an attacker also requested one,
    // completing a reset must not leave their link usable.
    prisma.authToken.updateMany({
      where: { userId: record.userId, type: "PASSWORD_RESET", usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        // Completing a reset proves control of the mailbox, so it also verifies
        // an address stuck in PENDING_VERIFICATION.
        ...(record.user.status === "PENDING_VERIFICATION"
          ? { status: "ACTIVE" as const, emailVerifiedAt: new Date() }
          : {}),
      },
    }),
    prisma.auditLog.create({
      data: { tenantId: record.user.tenantId, userId: record.userId, action: "account.password_reset", entity: "user" },
    }),
  ]);
  log.info("account.password_reset", { userId: record.userId });
  return { ok: true, userId: record.userId };
}

// ── B2B: enterprise tenant + invitations ────────────────────────────────────

export async function createEnterpriseTenant(input: {
  orgName: string;
  adminEmail: string;
  adminName: string;
  password: string;
}): Promise<SignupResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.adminEmail }, select: { id: true } });
  if (existing) return { created: false, reason: "email-taken" };

  const passwordHash = await hashPassword(input.password);
  const token = createToken("EMAIL_VERIFICATION");

  try {
    const { userId, tenantId } = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug: await uniqueSlug(tx, input.orgName),
          name: input.orgName,
          type: "ENTERPRISE",
          status: "TRIAL",
          isDemo: false,
        },
      });
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: input.adminEmail,
          passwordHash,
          fullName: input.adminName,
          role: "ENTERPRISE_ADMIN",
          status: "PENDING_VERIFICATION",
        },
      });
      // No MemberProfile: an enterprise admin is not a member and must never
      // appear in their own tenant's health cohorts.
      await tx.authToken.create({
        data: { userId: user.id, type: "EMAIL_VERIFICATION", tokenHash: token.hash, expiresAt: token.expiresAt },
      });
      await tx.auditLog.create({
        data: { tenantId: tenant.id, userId: user.id, action: "tenant.created", entity: "tenant" },
      });
      return { userId: user.id, tenantId: tenant.id };
    });
    log.info("tenant.created", { tenantId, userId });
    return { created: true, userId, tenantId, rawToken: token.raw, fullName: input.adminName };
  } catch (err) {
    if (isUniqueViolation(err)) return { created: false, reason: "email-taken" };
    throw err;
  }
}

export type InviteResult =
  | { ok: true; rawToken: string; email: string }
  | { ok: false; reason: "already-a-user" };

export async function inviteMember(input: {
  tenantId: string;
  email: string;
  invitedById: string;
}): Promise<InviteResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  // Enumeration is not a concern here — the caller is an authenticated admin of
  // this tenant, and they need to know why nothing happened.
  if (existing) return { ok: false, reason: "already-a-user" };

  const token = createToken("INVITATION");
  await prisma.invitation.upsert({
    where: { tenantId_email: { tenantId: input.tenantId, email: input.email } },
    create: {
      tenantId: input.tenantId,
      email: input.email,
      role: "MEMBER",
      tokenHash: token.hash,
      invitedById: input.invitedById,
      expiresAt: token.expiresAt,
    },
    // Re-inviting replaces the outstanding invitation, so only the newest link
    // works and a forwarded old one is dead.
    update: {
      tokenHash: token.hash,
      expiresAt: token.expiresAt,
      invitedById: input.invitedById,
      acceptedAt: null,
      revokedAt: null,
    },
  });
  log.info("invitation.sent", { tenantId: input.tenantId });
  return { ok: true, rawToken: token.raw, email: input.email };
}

export type AcceptInviteResult =
  | { ok: true; userId: string; tenantId: string }
  | { ok: false; reason: "invalid" | "email-taken" };

export async function acceptInvitation(input: {
  rawToken: string;
  fullName: string;
  password: string;
}): Promise<AcceptInviteResult> {
  const invite = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(input.rawToken) },
  });
  if (!invite || invite.revokedAt || invite.acceptedAt) return { ok: false, reason: "invalid" };
  if (tokenState({ expiresAt: invite.expiresAt, usedAt: invite.acceptedAt }) !== "valid") {
    return { ok: false, reason: "invalid" };
  }
  if (await prisma.user.findUnique({ where: { email: invite.email }, select: { id: true } })) {
    return { ok: false, reason: "email-taken" };
  }

  const passwordHash = await hashPassword(input.password);
  try {
    const userId = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId: invite.tenantId,
          email: invite.email,
          passwordHash,
          fullName: input.fullName,
          role: invite.role,
          // Accepting via an emailed link already proves control of the mailbox,
          // so no second verification round-trip.
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
        },
      });
      if (invite.role === "MEMBER") {
        await tx.memberProfile.create({
          data: { userId: user.id, tenantId: invite.tenantId, consent: "PENDING" },
        });
      }
      await tx.invitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
      await tx.auditLog.create({
        data: { tenantId: invite.tenantId, userId: user.id, action: "invitation.accepted", entity: "user" },
      });
      return user.id;
    });
    log.info("invitation.accepted", { tenantId: invite.tenantId, userId });
    return { ok: true, userId, tenantId: invite.tenantId };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, reason: "email-taken" };
    throw err;
  }
}

// ── Consent ─────────────────────────────────────────────────────────────────

/**
 * Record a consent decision. Append-only: withdrawing writes a WITHDRAWN row
 * and flips the denormalised state; it never edits or deletes the GRANTED row,
 * so the history of what was agreed and when survives.
 *
 * Withdrawal takes effect for aggregates immediately, because cohort queries
 * filter on `MemberProfile.consent`.
 */
export async function recordConsent(input: {
  profileId: string;
  tenantId: string;
  action: "GRANTED" | "WITHDRAWN";
  userId: string;
}): Promise<{ consent: "GRANTED" | "WITHDRAWN"; version: string; at: Date }> {
  const at = new Date();
  await prisma.$transaction([
    prisma.consentRecord.create({
      data: {
        profileId: input.profileId,
        tenantId: input.tenantId,
        version: CONSENT_VERSION,
        action: input.action,
      },
    }),
    prisma.memberProfile.update({
      where: { id: input.profileId },
      data: {
        consent: input.action === "GRANTED" ? "GRANTED" : "WITHDRAWN",
        consentVersion: input.action === "GRANTED" ? CONSENT_VERSION : null,
        consentUpdatedAt: at,
      },
    }),
    prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        action: input.action === "GRANTED" ? "consent.granted" : "consent.withdrawn",
        entity: "member_profile",
        meta: { version: CONSENT_VERSION },
      },
    }),
  ]);
  log.info("consent.recorded", { profileId: input.profileId, action: input.action });
  return { consent: input.action, version: CONSENT_VERSION, at };
}

/**
 * Whether a profile counts toward enterprise aggregates.
 *
 * Pure and exported so the privacy promise is directly testable, and so every
 * aggregate query uses the same predicate instead of re-deriving it.
 */
export function countsTowardCohort(profile: {
  consent: string;
  consentVersion?: string | null;
  onboardingCompletedAt?: Date | null;
}): boolean {
  return (
    profile.consent === "GRANTED" &&
    profile.consentVersion === CONSENT_VERSION &&
    Boolean(profile.onboardingCompletedAt)
  );
}
