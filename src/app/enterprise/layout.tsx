import { requirePortal } from "@/lib/session";
import { PortalShell } from "@/components/PortalShell";

const NAV = [
  { href: "/enterprise", label: "Overview" },
  { href: "/enterprise/analytics", label: "Workforce Analytics" },
  { href: "/enterprise/programs", label: "Programs" },
];

export default async function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortal("enterprise");
  return (
    <PortalShell user={user} portalName="Enterprise portal" accentLabel="Aggregate analytics only" nav={NAV}>
      {children}
    </PortalShell>
  );
}
