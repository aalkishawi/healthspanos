import { requirePortal } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { isConfigured } from "@/lib/billing/stripe";

export const metadata = { title: "Billing · Platform admin" };

const TONE = {
  ACTIVE: "success",
  TRIALING: "info",
  PAST_DUE: "warning",
  CANCELED: "neutral",
  INCOMPLETE: "neutral",
  NONE: "neutral",
} as const;

// Platform-admin view of every tenant's subscription. Cross-tenant by design —
// this is the operator surface — but it shows billing state only. No member
// health data is reachable from here.
export default async function AdminBillingPage() {
  await requirePortal("admin");

  const subs = await prisma.subscription.findMany({
    select: {
      tenantId: true,
      plan: true,
      status: true,
      seats: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      tenant: { select: { name: true, type: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const events = await prisma.stripeEvent.findMany({
    select: { eventId: true, type: true, processedAt: true, error: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Subscription state across all tenants.{" "}
          {isConfigured()
            ? "Stripe is configured."
            : "Stripe is NOT configured — nothing can be charged on this deployment."}
        </p>
      </div>

      <Card>
        <CardHeader title="Subscriptions" subtitle={`${subs.length} tenant(s) with a billing record`} />
        <CardBody>
          {subs.length === 0 ? (
            <p className="text-sm text-fg-muted">
              No subscriptions yet — every tenant is on the free plan.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-fg-muted">
                    <th className="pb-2 font-medium">Tenant</th>
                    <th className="pb-2 font-medium">Plan</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Seats</th>
                    <th className="pb-2 font-medium">Renews</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => (
                    <tr key={s.tenantId} className="border-b border-border/60">
                      <td className="py-2">
                        {s.tenant.name}{" "}
                        <span className="text-xs text-fg-muted">({s.tenant.type})</span>
                      </td>
                      <td className="py-2">{s.plan.replace(/_/g, " ").toLowerCase()}</td>
                      <td className="py-2">
                        <Badge tone={TONE[s.status] ?? "neutral"}>{s.status}</Badge>
                        {s.cancelAtPeriodEnd && (
                          <span className="ms-2 text-xs text-fg-muted">cancels at period end</span>
                        )}
                      </td>
                      <td className="py-2">{s.seats || "—"}</td>
                      <td className="py-2 text-fg-muted">
                        {s.currentPeriodEnd?.toLocaleDateString() ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Recent Stripe events"
          subtitle="Webhook delivery log — an unprocessed or errored row means entitlements may be stale"
        />
        <CardBody>
          {events.length === 0 ? (
            <p className="text-sm text-fg-muted">No webhook events received.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {events.map((e) => (
                <li key={e.eventId} className="flex flex-wrap items-center gap-2">
                  <Badge tone={e.error ? "danger" : e.processedAt ? "success" : "warning"}>
                    {e.error ? "error" : e.processedAt ? "processed" : "pending"}
                  </Badge>
                  <span className="font-mono text-xs">{e.type}</span>
                  <span className="text-xs text-fg-muted">{e.createdAt.toLocaleString()}</span>
                  {e.error && (
                    <span className="text-xs text-[color:var(--danger)]">{e.error}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}
