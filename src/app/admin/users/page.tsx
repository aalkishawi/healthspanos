import { requirePortal } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const ROLE_TONE = { PLATFORM_ADMIN: "accent", REVIEWER: "info", ENTERPRISE_ADMIN: "warning", MEMBER: "neutral" } as const;

export default async function UsersPage() {
  await requirePortal("admin");
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: { tenant: true } });

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Users &amp; Roles</h1>
        <p className="mt-1 text-sm text-fg-muted">The five-role model drives portal access across the platform.</p>
      </div>
      <Card>
        <CardHeader title="All users" />
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-fg-muted">
              <tr>
                <th className="p-4 text-start font-medium">Name</th>
                <th className="p-4 text-start font-medium">Email</th>
                <th className="p-4 text-start font-medium">Role</th>
                <th className="p-4 text-start font-medium">Tenant</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="p-4">{u.fullName}</td>
                  <td className="p-4 text-fg-muted">{u.email}</td>
                  <td className="p-4"><Badge tone={ROLE_TONE[u.role as keyof typeof ROLE_TONE] ?? "neutral"}>{u.role}</Badge></td>
                  <td className="p-4 text-fg-muted">{u.tenant.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </>
  );
}
