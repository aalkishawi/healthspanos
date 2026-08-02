import { requirePortal } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PlanReviewActions } from "./PlanReviewActions";

export const metadata = { title: "Plans awaiting review · Numik HealthspanOS" };

// The clinical safety queue: action plans a member cannot activate until a
// reviewer approves them. Reviewers are a global role, so this is deliberately
// NOT tenant-scoped — but it selects only title/summary, never the member's
// identity or their intake.
export default async function PlanReviewQueue() {
  await requirePortal("reviewer");

  const plans = await prisma.actionPlan.findMany({
    where: { status: "PENDING_SAFETY_REVIEW" },
    select: { id: true, title: true, summary: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Plans awaiting review</h1>
        <p className="mt-1 text-sm text-fg-muted">
          These were auto-generated from a member&rsquo;s reported patterns and flagged as medical or
          high-risk. A member cannot activate one until it is approved here.
        </p>
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardBody className="text-sm text-fg-muted">
            Nothing awaiting review.
          </CardBody>
        </Card>
      ) : (
        plans.map((p) => (
          <Card key={p.id}>
            <CardHeader
              title={p.title}
              subtitle={p.summary}
              action={<Badge tone="warning">Pending safety review</Badge>}
            />
            <CardBody>
              <p className="mb-3 text-xs text-fg-muted">
                Generated {p.createdAt.toLocaleDateString()}. Approving lets the member activate it;
                requesting changes returns it to draft.
              </p>
              <PlanReviewActions planId={p.id} />
            </CardBody>
          </Card>
        ))
      )}
    </>
  );
}
