import { requirePortal } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PlanActions } from "./PlanActions";

const STATUS_TONE = { ACTIVE: "success", APPROVED: "info", DRAFT: "neutral", PENDING_SAFETY_REVIEW: "warning", ARCHIVED: "neutral" } as const;

export default async function PlansPage() {
  const user = await requirePortal("member");
  const profile = await prisma.memberProfile.findFirst({
    where: { userId: user.id, tenantId: user.tenantId },
    include: { actionPlans: { orderBy: { updatedAt: "desc" } } },
  });
  const plans = profile?.actionPlans ?? [];

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Action Plans</h1>
        <p className="mt-1 text-sm text-fg-muted">Safe, non-diagnostic lifestyle guidance. Medical or high-risk items require human review before activation.</p>
      </div>

      {plans.length === 0 ? (
        <Card><CardBody className="text-sm text-fg-muted">No action plans yet.</CardBody></Card>
      ) : (
        plans.map((p) => (
          <Card key={p.id}>
            <CardHeader
              title={p.title}
              subtitle={p.summary}
              action={
                <div className="flex items-center gap-2">
                  {p.requiresReview && <Badge tone="warning">Needs review</Badge>}
                  <Badge tone={STATUS_TONE[p.status as keyof typeof STATUS_TONE] ?? "neutral"}>{p.status.replace(/_/g, " ")}</Badge>
                </div>
              }
            />
            <CardBody>
              <PlanActions planId={p.id} status={p.status} requiresReview={p.requiresReview} />
            </CardBody>
          </Card>
        ))
      )}
    </>
  );
}
