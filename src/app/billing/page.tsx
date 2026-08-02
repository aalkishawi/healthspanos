import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  FREE_ASSISTANT_QUESTIONS_PER_MONTH,
  assistantQuotaRemaining,
  entitlementsFor,
} from "@/lib/billing/entitlements";
import { isConfigured } from "@/lib/billing/stripe";
import { BillingActions } from "./BillingActions";

export const metadata = { title: "Billing · Numik HealthspanOS" };

const STATUS_TONE = {
  ACTIVE: "success",
  TRIALING: "info",
  PAST_DUE: "warning",
  CANCELED: "neutral",
  INCOMPLETE: "neutral",
  NONE: "neutral",
} as const;

export default async function BillingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/billing");

  const ent = await entitlementsFor(user.tenantId);
  const quota = await assistantQuotaRemaining(user.tenantId);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="mt-1 text-sm text-fg-muted">Your plan and what it includes.</p>
      </div>

      <Card>
        <CardHeader
          title={`Current plan: ${ent.plan.replace(/_/g, " ").toLowerCase()}`}
          subtitle={
            ent.currentPeriodEnd
              ? `Renews ${ent.currentPeriodEnd.toLocaleDateString()}`
              : "No paid subscription"
          }
          action={
            <Badge tone={STATUS_TONE[ent.status as keyof typeof STATUS_TONE] ?? "neutral"}>
              {ent.status}
            </Badge>
          }
        />
        <CardBody className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Included</h3>
            <ul className="mt-1 space-y-1 text-sm text-fg-muted">
              {ent.entitlements.map((e) => (
                <li key={e}>• {e.replace(/_/g, " ")}</li>
              ))}
            </ul>
          </div>

          {!quota.unlimited && (
            <p className="text-sm text-fg-muted">
              Assistant questions used this month: <strong>{quota.used}</strong> of{" "}
              {FREE_ASSISTANT_QUESTIONS_PER_MONTH}.
            </p>
          )}

          {ent.plan === "ENTERPRISE_SEATS" && (
            <p className="text-sm text-fg-muted">
              Seats purchased: <strong>{ent.seats}</strong>
            </p>
          )}

          {ent.status === "PAST_DUE" && (
            <p className="text-sm text-[color:var(--warning)]">
              Your last payment failed. Access continues while the card is retried — update it to
              avoid interruption.
            </p>
          )}
        </CardBody>
      </Card>

      {isConfigured() ? (
        <BillingActions plan={ent.plan} role={user.role} />
      ) : (
        // Honest rather than a dead button. This deployment genuinely cannot
        // take a payment, and saying so beats a checkout that 503s.
        <Card>
          <CardHeader title="Billing is not enabled on this deployment" />
          <CardBody className="text-sm text-fg-muted">
            No Stripe keys are configured, so subscriptions cannot be purchased or managed here.
            Everything on the free plan continues to work normally.
          </CardBody>
        </Card>
      )}

      <p className="text-xs text-fg-muted">
        Payments are handled by Stripe. Numik never sees or stores your card details.
      </p>
    </main>
  );
}
