import { requirePortal } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function FlaggedPage() {
  await requirePortal("reviewer");
  const items = await prisma.evidenceItem.findMany({
    where: { status: { in: ["FLAGGED", "REJECTED"] } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Flagged &amp; retracted</h1>
        <p className="mt-1 text-sm text-fg-muted">Conflicting, corrected or retracted findings held back from members.</p>
      </div>
      {items.length === 0 ? (
        <Card><CardBody className="text-sm text-fg-muted">Nothing flagged.</CardBody></Card>
      ) : (
        items.map((it) => (
          <Card key={it.id}>
            <CardHeader title={it.title} subtitle={it.source} action={<Badge tone="danger">{it.status}</Badge>} />
            <CardBody className="text-sm text-fg-muted">{it.summary}</CardBody>
          </Card>
        ))
      )}
    </>
  );
}
