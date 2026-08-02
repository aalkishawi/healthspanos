import { requirePortal } from "@/lib/session";
import { prisma } from "@/lib/db";
import { tenantScope, isCohortReportable, K_ANONYMITY_MIN } from "@/lib/tenant";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Badge } from "@/components/ui/Badge";
import { InvitePanel } from "./InvitePanel";

function fmt(metric: string, value: number): string {
  if (metric.includes("rate") || metric.includes("share")) return `${Math.round(value * 100)}%`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export default async function EnterpriseOverview() {
  const user = await requirePortal("enterprise");
  // Tenant-scoped read — an enterprise admin can only ever see their own tenant.
  const metrics = await prisma.aggregateMetric.findMany({
    where: { ...tenantScope(user), period: "2026-Q3" },
    orderBy: { metric: "asc" },
  });

  // Invitations for THIS tenant only. Serialised to strings because a Server
  // Component cannot hand Date objects to a Client Component.
  const invites = (
    await prisma.invitation.findMany({
      where: { tenantId: user.tenantId },
      select: { email: true, createdAt: true, expiresAt: true, acceptedAt: true, revokedAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
  ).map((i) => ({
    email: i.email,
    createdAt: i.createdAt.toISOString(),
    expiresAt: i.expiresAt.toISOString(),
    acceptedAt: i.acceptedAt?.toISOString() ?? null,
    revokedAt: i.revokedAt?.toISOString() ?? null,
  }));

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Workforce healthspan — Q3 2026</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Privacy-protected aggregates only. Identifiable employee health data is never shown here.
        </p>
      </div>

      <Card className="border-[color:var(--info)]/40">
        <CardBody className="text-sm text-fg-muted">
          <Badge tone="info">Privacy guard</Badge>
          <span className="ms-2">
            Cohorts smaller than {K_ANONYMITY_MIN} members are suppressed to prevent re-identification (k-anonymity).
          </span>
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {metrics.map((m) => (
          <Stat
            key={m.id}
            label={m.metric.replace(/_/g, " ")}
            value={isCohortReportable(m.cohortSize) ? fmt(m.metric, m.value) : "—"}
            hint={isCohortReportable(m.cohortSize) ? `cohort n=${m.cohortSize}` : "suppressed (cohort too small)"}
          />
        ))}
      </div>

      <Card>
        <CardHeader title="What employers can and cannot see" />
        <CardBody className="space-y-2 text-sm text-fg-muted">
          <p>✔ Aggregate participation, average domain scores, and risk shares across the workforce.</p>
          <p>✔ Program-level trends over time for planning healthspan initiatives.</p>
          <p>✗ Never: names, individual scores, lab values, wearable data, or any identifiable PHI.</p>
        </CardBody>
      </Card>
      <InvitePanel initialInvites={invites} />
    </>
  );
}
