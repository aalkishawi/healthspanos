import { requirePortal } from "@/lib/session";
import { prisma } from "@/lib/db";
import { tenantScope, isCohortReportable } from "@/lib/tenant";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function AnalyticsPage() {
  const user = await requirePortal("enterprise");
  const metrics = await prisma.aggregateMetric.findMany({
    where: tenantScope(user),
    orderBy: [{ period: "desc" }, { metric: "asc" }],
  });

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Workforce Analytics</h1>
        <p className="mt-1 text-sm text-fg-muted">De-identified, aggregate metrics across periods.</p>
      </div>
      <Card>
        <CardHeader title="All metrics" subtitle="Suppressed rows indicate cohorts below the privacy threshold." />
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-start text-fg-muted">
              <tr>
                <th className="p-4 text-start font-medium">Period</th>
                <th className="p-4 text-start font-medium">Metric</th>
                <th className="p-4 text-start font-medium">Value</th>
                <th className="p-4 text-start font-medium">Cohort</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => {
                const ok = isCohortReportable(m.cohortSize);
                return (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="p-4">{m.period}</td>
                    <td className="p-4 capitalize">{m.metric.replace(/_/g, " ")}</td>
                    <td className="p-4">{ok ? m.value : <Badge tone="neutral">suppressed</Badge>}</td>
                    <td className="p-4 text-fg-muted">n={m.cohortSize}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </>
  );
}
