// Tenant-isolation helpers. Every tenant-scoped read/write MUST pass through here
// so a session's tenantId is always applied — the structural guard against
// cross-tenant data leakage.
import type { SessionUser } from "./rbac";

/**
 * Returns a Prisma `where` fragment scoped to the caller's tenant.
 * PLATFORM_ADMIN may optionally query across tenants (pass allowCrossTenant).
 */
export function tenantScope(user: SessionUser, allowCrossTenant = false): { tenantId?: string } {
  if (user.role === "PLATFORM_ADMIN" && allowCrossTenant) return {};
  return { tenantId: user.tenantId };
}

// k-anonymity threshold: enterprise aggregates below this cohort size are suppressed
// so no small group can be re-identified.
export const K_ANONYMITY_MIN = 10;

export function isCohortReportable(cohortSize: number): boolean {
  return cohortSize >= K_ANONYMITY_MIN;
}
