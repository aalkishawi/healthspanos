// Data-subject rights: export everything we hold, and delete it.
//
// Both are self-service. A right you have to email support to exercise is a
// right in name only, and "we will respond within 30 days" is what a company
// says when the capability does not exist.
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { decryptJson } from "./encryption";
import { auditHealthAccess } from "./audit";

export type DataExport = {
  exportedAt: string;
  notice: string;
  account: Record<string, unknown>;
  profile: Record<string, unknown> | null;
  intake: unknown;
  scores: unknown[];
  actionPlans: unknown[];
  consentHistory: unknown[];
  assistantQuestions: unknown[];
  accessLog: unknown[];
};

/**
 * Everything held about one user, in portable JSON.
 *
 * Includes the ACCESS LOG deliberately: "who looked at my record" is part of
 * what a data-subject request is for, and omitting it would make the export
 * technically complete and practically useless.
 */
export async function exportUserData(userId: string): Promise<DataExport | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, fullName: true, role: true, locale: true, status: true,
      emailVerifiedAt: true, createdAt: true, tenantId: true,
      tenant: { select: { name: true, type: true } },
    },
  });
  if (!user) return null;

  const profile = await prisma.memberProfile.findUnique({
    where: { userId },
    select: {
      id: true, dateOfBirth: true, sex: true, consent: true, consentVersion: true,
      consentUpdatedAt: true, onboardingCompletedAt: true, intake: true, createdAt: true,
    },
  });

  const [scores, plans, consents, questions, access] = await Promise.all([
    profile
      ? prisma.healthspanScore.findMany({
          where: { profileId: profile.id },
          select: { domain: true, score: true, band: true, explanation: true, computedAt: true },
          orderBy: { computedAt: "desc" },
        })
      : [],
    profile
      ? prisma.actionPlan.findMany({
          where: { profileId: profile.id },
          select: { title: true, summary: true, status: true, requiresReview: true, createdAt: true },
        })
      : [],
    profile
      ? prisma.consentRecord.findMany({
          where: { profileId: profile.id },
          select: { action: true, version: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        })
      : [],
    prisma.assistantQuery.findMany({
      where: { userId },
      select: { question: true, outcome: true, answer: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: { userId },
      select: { action: true, entity: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
  ]);

  await auditHealthAccess({
    tenantId: user.tenantId,
    userId,
    resource: "data_export",
    reason: "self",
  });
  log.info("gdpr.export", { userId });

  return {
    exportedAt: new Date().toISOString(),
    notice:
      "Everything Numik HealthspanOS holds about you. Health indices are derived from your own " +
      "inputs and are non-diagnostic. This file contains personal health information — store it " +
      "somewhere you would keep a medical record.",
    account: { ...user, tenant: user.tenant },
    profile: profile ? { ...profile, intake: undefined } : null,
    // Decrypted for the member: it is their data, and an export they cannot
    // read is not portability.
    intake: profile ? decryptJson(profile.intake) : null,
    scores,
    actionPlans: plans,
    consentHistory: consents,
    assistantQuestions: questions,
    accessLog: access,
  };
}

export type DeletionResult = {
  deleted: true;
  tenantTombstoned: boolean;
  auditRetained: number;
};

/**
 * Delete a user and their health data.
 *
 * WHAT SURVIVES, AND WHY. The audit trail is retained with the user reference
 * nulled. Two reasons: the tenant-scoped record that "an export happened" or
 * "consent was withdrawn" is itself a compliance obligation, and erasing the
 * evidence that a deletion occurred would defeat the point of asking for one.
 * The retained rows carry no name, no email and no health content.
 *
 * A personal (INDIVIDUAL) tenant is ANONYMISED rather than deleted, and that is
 * a deliberate correction. Deleting it cascades `AuditLog.tenantId` and destroys
 * the retained trail — verified: the audit went to zero rows, taking with it the
 * only proof the deletion ever happened. The tenant is instead renamed to a
 * tombstone and suspended: no personal data, no members, no analytics
 * participation, but the audit chain survives.
 */
export async function deleteUserData(userId: string): Promise<DeletionResult | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, tenantId: true, tenant: { select: { type: true } } },
  });
  if (!user) return null;

  const isPersonalTenant = user.tenant.type === "INDIVIDUAL";

  const auditRetained = await prisma.$transaction(async (tx) => {
    // Sever the audit rows from the user BEFORE deleting, so the FK's
    // onDelete: SetNull is not the thing we are relying on for correctness.
    const { count } = await tx.auditLog.updateMany({
      where: { userId },
      data: { userId: null },
    });

    // Assistant history holds the member's questions — health content, so it
    // goes rather than being anonymised.
    await tx.assistantQuery.deleteMany({ where: { userId } });

    // MemberProfile, scores, plans, consent records and auth tokens all cascade
    // from the user (onDelete: Cascade in the schema).
    await tx.user.delete({ where: { id: userId } });

    if (isPersonalTenant) {
      // Tombstone, NOT delete — see the note above. Deleting cascades the audit
      // rows we just went to the trouble of anonymising and retaining.
      await tx.tenant.update({
        where: { id: user.tenantId },
        data: {
          name: `Deleted account (${user.tenantId.slice(-8)})`,
          slug: `deleted-${user.tenantId.slice(-12)}`,
          status: "SUSPENDED",
        },
      });
    }

    // A durable, explicit record that the deletion happened, independent of the
    // rows above. This is what a data-subject audit actually asks to see.
    await tx.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: null,
        action: "gdpr.account_deleted",
        entity: "user",
        meta: { personalTenantTombstoned: isPersonalTenant },
      },
    });

    return count;
  });

  log.info("gdpr.deleted", { tenantTombstoned: isPersonalTenant, auditRetained });
  return { deleted: true, tenantTombstoned: isPersonalTenant, auditRetained };
}
