import { requirePortal } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export default async function AuditPage() {
  await requirePortal("admin");
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true, tenant: true },
  });

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="mt-1 text-sm text-fg-muted">Most recent 100 platform events.</p>
      </div>
      <Card>
        <CardHeader title="Events" />
        <CardBody className="p-0">
          {logs.length === 0 ? (
            <p className="p-5 text-sm text-fg-muted">No events yet. Sign in and out, or record a review decision.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-fg-muted">
                <tr>
                  <th className="p-4 text-start font-medium">When</th>
                  <th className="p-4 text-start font-medium">Action</th>
                  <th className="p-4 text-start font-medium">Entity</th>
                  <th className="p-4 text-start font-medium">Actor</th>
                  <th className="p-4 text-start font-medium">Tenant</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="p-4 text-fg-muted">{l.createdAt.toISOString().replace("T", " ").slice(0, 19)}</td>
                    <td className="p-4 font-medium">{l.action}</td>
                    <td className="p-4 text-fg-muted">{l.entity}</td>
                    <td className="p-4 text-fg-muted">{l.user?.email ?? "—"}</td>
                    <td className="p-4 text-fg-muted">{l.tenant.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </>
  );
}
