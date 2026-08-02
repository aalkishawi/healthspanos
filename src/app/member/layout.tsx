import { requirePortal } from "@/lib/session";
import { PortalShell } from "@/components/PortalShell";

const NAV = [
  { href: "/member", label: "Overview" },
  { href: "/member/passport", label: "Healthspan Passport" },
  { href: "/member/plans", label: "Action Plans" },
  { href: "/member/assistant", label: "Research Assistant" },
];

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortal("member");
  return (
    <PortalShell user={user} portalName="Member portal" accentLabel="Member" nav={NAV}>
      {children}
    </PortalShell>
  );
}
