// Audit logging for health-data ACCESS, not just modification.
//
// The write paths already log. This adds the reads, because "who looked at this
// member's health record, and when" is the question an audit actually asks —
// and the one nobody can answer retrospectively unless it was recorded at the
// time.
//
// PHI RULE: an audit entry records WHO, WHAT KIND, and WHEN. Never the content.
// An audit log full of health data is a second copy of the thing it exists to
// protect.
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

export type HealthResource =
  | "member_profile"
  | "healthspan_scores"
  | "action_plans"
  | "assistant_history"
  | "consent_history"
  | "data_export";

export type AccessReason =
  /** The member reading their own record — the overwhelming majority. */
  | "self"
  /** A clinical reviewer acting on a flagged item. */
  | "clinical_review"
  /** A platform admin. Rare, and the entries worth reviewing. */
  | "platform_admin"
  /** Aggregate computation, which touches many members at once. */
  | "aggregation";

/**
 * Record one access to health data.
 *
 * Best-effort and never throws: a failed audit write must not deny a member
 * their own passport. It logs at error level so the gap is visible rather than
 * silent.
 */
export async function auditHealthAccess(input: {
  tenantId: string;
  userId: string | null;
  resource: HealthResource;
  reason: AccessReason;
  /** Whose record, when not the caller's own. Ids only, never names. */
  subjectId?: string;
  /** How many records — useful for spotting bulk reads. Never the content. */
  count?: number;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        action: `access.${input.resource}`,
        entity: input.subjectId ? `${input.resource}:${input.subjectId}` : input.resource,
        meta: {
          reason: input.reason,
          ...(typeof input.count === "number" ? { count: input.count } : {}),
        },
      },
    });
  } catch (err) {
    log.error("audit.write_failed", err, { resource: input.resource, reason: input.reason });
  }
}

/**
 * The access trail for one member, newest first.
 *
 * Powers the member's own "who has looked at my data" view — the transparency
 * half of the audit. A log only the operator can read is a compliance artefact;
 * one the subject can read is a trust feature.
 */
export async function accessHistoryFor(
  tenantId: string,
  subjectUserId: string,
  limit = 100,
): Promise<{ action: string; entity: string; reason: string; at: Date; byYou: boolean }[]> {
  const rows = await prisma.auditLog.findMany({
    where: { tenantId, action: { startsWith: "access." } },
    select: { action: true, entity: true, meta: true, createdAt: true, userId: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    action: r.action.replace("access.", "").replace(/_/g, " "),
    entity: r.entity,
    reason: String((r.meta as { reason?: string } | null)?.reason ?? "unknown"),
    at: r.createdAt,
    byYou: r.userId === subjectUserId,
  }));
}
