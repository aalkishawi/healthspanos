import Link from "next/link";
import { getDictionary } from "@/lib/i18n";
import type { SessionUser } from "@/lib/rbac";
import { Badge } from "@/components/ui/Badge";
import { SignOutButton } from "@/components/SignOutButton";
import { PortalNav } from "@/components/PortalNav";
import { prisma } from "@/lib/db";

export interface NavItem {
  href: string;
  label: string;
}

// Shared authenticated-portal shell: brand + portal name, side nav, sign out.
// Every role's portal (section 6) renders through this one component so the
// navigation contract is consistent and de-duplicated.
export async function PortalShell({
  user,
  portalName,
  accentLabel,
  nav,
  children,
}: {
  user: SessionUser;
  portalName: string;
  accentLabel: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const t = getDictionary(user.locale as "en" | "ar");

  // The demo banner used to render unconditionally, so a real member looking at
  // their own real health data was told it was "synthetic data only". That is
  // worse than cosmetic — it tells someone their genuine record is fake. Show it
  // only for tenants actually flagged isDemo.
  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { isDemo: true },
  });
  const isDemo = tenant?.isDemo ?? false;

  return (
    <div className="min-h-screen bg-surface text-fg lg:grid lg:grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <aside className="border-b border-border bg-surface-2 lg:border-b-0 lg:border-e">
        <div className="flex items-center gap-2 p-5">
          <div className="grid h-8 w-8 place-items-center rounded bg-accent text-sm font-bold text-white">N</div>
          <div className="leading-tight">
            <Link href="/" className="text-sm font-semibold">
              {t.brand}
            </Link>
            <p className="text-xs text-fg-muted">{portalName}</p>
          </div>
        </div>
        <PortalNav nav={nav} label={portalName} />
      </aside>

      {/* Main column */}
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border bg-surface-2 px-6 py-3">
          <Badge tone="accent">{accentLabel}</Badge>
          <div className="flex items-center gap-4">
            <div className="text-end">
              <p className="text-sm font-medium leading-none">{user.fullName}</p>
              <p className="text-xs text-fg-muted">{user.email}</p>
            </div>
            <SignOutButton label={t.common.signOut} />
          </div>
        </header>
        <main className="flex-1 p-6">
          <div className="mx-auto max-w-6xl space-y-6">{children}</div>
        </main>
        {isDemo && (
          <footer className="border-t border-border px-6 py-3 text-center text-xs text-fg-muted">
            {t.common.demoBanner}
          </footer>
        )}
      </div>
    </div>
  );
}
