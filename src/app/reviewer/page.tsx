import { requirePortal } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ReviewActions } from "./ReviewActions";

const GRADE_TONE = { A: "success", B: "info", C: "warning", D: "danger", UNGRADED: "neutral" } as const;

export default async function ReviewQueue() {
  await requirePortal("reviewer");
  const items = await prisma.evidenceItem.findMany({
    where: { status: { in: ["INGESTED", "IN_REVIEW"] } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Evidence review queue</h1>
        <p className="mt-1 text-sm text-fg-muted">Grade quality and approve, flag, or reject. Medical/high-risk content is gated on human approval.</p>
      </div>

      {items.length === 0 ? (
        <Card><CardBody className="text-sm text-fg-muted">Queue is clear. 🎉</CardBody></Card>
      ) : (
        items.map((it) => (
          <Card key={it.id}>
            <CardHeader
              title={it.title}
              subtitle={`${it.source}`}
              action={
                <div className="flex items-center gap-2">
                  <Badge tone={GRADE_TONE[it.grade as keyof typeof GRADE_TONE] ?? "neutral"}>Grade {it.grade}</Badge>
                  <Badge tone="neutral">{it.status.replace(/_/g, " ")}</Badge>
                </div>
              }
            />
            <CardBody className="space-y-4">
              <p className="text-sm text-fg-muted">{it.summary}</p>
              <ReviewActions evidenceItemId={it.id} />
            </CardBody>
          </Card>
        ))
      )}
    </>
  );
}
