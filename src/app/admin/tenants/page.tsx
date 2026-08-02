import { requirePortal } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function TenantsPage() {
  await requirePortal("admin");
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { users: true, memberProfiles: true } } },
  });

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Tenants</h1>
        <p className="mt-1 text-sm text-fg-muted">Every tenant is isolated. Demo tenants use synthetic data only.</p>
      </div>
      <Card>
        <CardHeader title="All tenants" />
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-fg-muted">
              <tr>
                <th className="p-4 text-start font-medium">Name</th>
                <th className="p-4 text-start font-medium">Type</th>
                <th className="p-4 text-start font-medium">Status</th>
                <th className="p-4 text-start font-medium">Users</th>
                <th className="p-4 text-start font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="p-4">
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-fg-muted">{t.slug}</div>
                  </td>
                  <td className="p-4"><Badge tone="accent">{t.type}</Badge></td>
                  <td className="p-4"><Badge tone={t.status === "ACTIVE" ? "success" : "warning"}>{t.status}</Badge></td>
                  <td className="p-4 text-fg-muted">{t._count.users}</td>
                  <td className="p-4">{t.isDemo ? <Badge tone="info">synthetic</Badge> : <Badge tone="neutral">real-ready</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </>
  );
}
