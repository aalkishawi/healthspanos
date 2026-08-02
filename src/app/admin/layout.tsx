import { requirePortal } from "@/lib/session";
import { PortalShell } from "@/components/PortalShell";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/tenants", label: "Tenants" },
  { href: "/admin/users", label: "Users & Roles" },
  { href: "/admin/models", label: "AI Model Gateway" },
  { href: "/admin/audit", label: "Audit Log" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortal("admin");
  return (
    <PortalShell user={user} portalName="Platform administration" accentLabel="Numik operators" nav={NAV}>
      {children}
    </PortalShell>
  );
}
