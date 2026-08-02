"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "./PortalShell";

// Client nav — highlights the active item via the real pathname.
export function PortalNav({ nav, label }: { nav: NavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav className="px-3 pb-4" aria-label={label}>
      <ul className="space-y-1">
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  "block rounded px-3 py-2 text-sm transition-colors " +
                  (active ? "bg-[var(--accent-soft)] text-fg" : "text-fg-muted hover:bg-surface-3 hover:text-fg")
                }
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
