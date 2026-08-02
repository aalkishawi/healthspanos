// Shared public-site chrome. Every marketing page uses the same header and
// footer so navigation is consistent and a new page cannot quietly ship without
// the legal links in its footer.
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";

const NAV = [
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded bg-accent text-sm font-bold text-white">
            N
          </span>
          <span className="font-semibold">Numik HealthspanOS</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-fg-muted md:flex" aria-label="Primary">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-fg">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ButtonLink href="/login" variant="ghost" size="sm">
            Sign in
          </ButtonLink>
          <ButtonLink href="/signup" size="sm">
            Get started
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-semibold">Numik HealthspanOS</p>
          <p className="mt-2 text-sm text-fg-muted">
            The longevity intelligence operating system for the enterprise.
          </p>
        </div>
        <FooterCol
          title="Product"
          links={[
            { href: "/pricing", label: "Pricing" },
            { href: "/signup", label: "Create an account" },
            { href: "/signup/enterprise", label: "For employers" },
            { href: "/contact?topic=demo", label: "Book a demo" },
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            { href: "/about", label: "About" },
            { href: "/contact", label: "Contact" },
          ]}
        />
        <FooterCol
          title="Legal"
          links={[
            { href: "/legal/privacy", label: "Privacy policy" },
            { href: "/legal/terms", label: "Terms of service" },
            { href: "/legal/security", label: "Security & data" },
          ]}
        />
      </div>
      <div className="border-t border-border px-6 py-4">
        <p className="mx-auto max-w-6xl text-xs text-fg-muted">
          Numik HealthspanOS provides non-diagnostic wellness information derived from published
          research. It is not medical advice, does not diagnose or treat any condition, and is not a
          substitute for a qualified clinician.
        </p>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <ul className="mt-2 space-y-1.5 text-sm text-fg-muted">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="hover:text-fg">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
