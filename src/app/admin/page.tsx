import { requirePortal } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Stat } from "@/components/ui/Stat";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export default async function AdminOverview() {
  await requirePortal("admin");
  const [tenants, users, evidence, pendingReview] = await Promise.all([
    prisma.tenant.count(),
    prisma.user.count(),
    prisma.evidenceItem.count(),
    prisma.evidenceItem.count({ where: { status: { in: ["INGESTED", "IN_REVIEW"] } } }),
  ]);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Platform administration</h1>
        <p className="mt-1 text-sm text-fg-muted">Tenants, users, models and governance across all of Numik HealthspanOS.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Tenants" value={tenants} />
        <Stat label="Users" value={users} />
        <Stat label="Evidence items" value={evidence} />
        <Stat label="Awaiting review" value={pendingReview} hint="Human approval queue" />
      </div>
      <Card>
        <CardHeader title="Governance" subtitle="Foundation controls in place" />
        <CardBody className="grid gap-2 text-sm text-fg-muted sm:grid-cols-2">
          <p>• Multi-tenant isolation on every tenant-scoped read/write.</p>
          <p>• Role-based portal access (5 roles) enforced in middleware + server guards.</p>
          <p>• Human approval gate for medical / high-risk content.</p>
          <p>• Privacy-protected aggregate analytics with k-anonymity suppression.</p>
          <p>• Audit trail on auth and review actions.</p>
          <p>• English-first i18n with Arabic/RTL scaffolding.</p>
        </CardBody>
      </Card>
    </>
  );
}
