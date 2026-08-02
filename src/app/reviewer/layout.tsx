import { requirePortal } from "@/lib/session";
import { PortalShell } from "@/components/PortalShell";

const NAV = [
  { href: "/reviewer", label: "Review Queue" },
  { href: "/reviewer/flagged", label: "Flagged & Retracted" },
];

export default async function ReviewerLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortal("reviewer");
  return (
    <PortalShell user={user} portalName="Scientific & clinical review" accentLabel="Human approval required" nav={NAV}>
      {children}
    </PortalShell>
  );
}
