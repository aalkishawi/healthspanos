import { requirePortal } from "@/lib/session";
import { enterpriseMetrics } from "@/lib/analytics/read";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function AnalyticsPage() {
  const user = await requirePortal("enterprise");
  // Read through the k-anonymised layer — never prisma directly. It is the one
  // place suppression is enforced, and it hides the cohort SIZE as well as the
  // value (printing "n=3" for a hidden group is itself a disclosure).
  const metrics = await enterpriseMetrics(user.tenantId);

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
              {metrics.map((m, i) => (
                <tr key={`${m.period}-${m.metric}-${i}`} className="border-b border-border last:border-0">
                  <td className="p-4">{m.period}</td>
                  <td className="p-4 capitalize">{m.metric.replace(/_/g, " ")}</td>
                  <td className="p-4">
                    {m.suppressed ? (
                      <Badge tone="neutral">suppressed</Badge>
                    ) : m.metric.includes("rate") || m.metric.includes("share") ? (
                      `${Math.round((m.value ?? 0) * 100)}%`
                    ) : (
                      (m.value ?? 0).toFixed(1)
                    )}
                  </td>
                  {/* Size withheld alongside the value: revealing "n=3" for a
                      hidden cohort identifies how small the group is. */}
                  <td className="p-4 text-fg-muted">
                    {m.suppressed ? "—" : `n=${m.cohortSize}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </>
  );
}
