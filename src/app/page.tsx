import Link from "next/link";
import { getDictionary } from "@/lib/i18n";
import { LaunchButton } from "@/components/LaunchButton";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

// Public website (Portal 1). Marketing + the prominent Launch button + portal map.
export default function PublicHome() {
  const t = getDictionary("en");

  const portals = [
    { key: "member", href: "/login?next=/member", ...t.portals.member },
    { key: "enterprise", href: "/login?next=/enterprise", ...t.portals.enterprise },
    { key: "reviewer", href: "/login?next=/reviewer", ...t.portals.reviewer },
    { key: "admin", href: "/login?next=/admin", ...t.portals.admin },
  ];

  return (
    <div className="min-h-screen bg-surface text-fg">
      {/* Public top nav */}
      <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded bg-accent text-sm font-bold text-white">N</span>
            <span className="font-semibold">{t.brand}</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-fg-muted md:flex" aria-label="Primary">
            <a href="#portals" className="hover:text-fg">{t.nav.portals}</a>
            <a href="#evidence" className="hover:text-fg">{t.nav.evidence}</a>
            <a href="#security" className="hover:text-fg">{t.nav.security}</a>
          </nav>
          <div className="flex items-center gap-3">
            <ButtonLink href="/login" variant="secondary" size="sm">
              {t.nav.signIn}
            </ButtonLink>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="numik-accent-grad">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Badge tone="accent">Longevity intelligence · Preventive health · Healthy aging</Badge>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight md:text-5xl">{t.public.heroTitle}</h1>
          <p className="mt-5 max-w-2xl text-lg text-fg-muted">{t.public.heroBody}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <LaunchButton label={t.public.ctaPrimary} />
            <ButtonLink href="/login" variant="secondary" size="lg">
              {t.public.ctaSecondary}
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Portals (section 6 map) */}
      <section id="portals" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-semibold">Five portals, one platform</h2>
        <p className="mt-2 max-w-2xl text-fg-muted">
          Public website, Member, Enterprise, Scientific &amp; clinical review, and Numik administration — each with
          tenant-isolated access.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {portals.map((p) => (
            <Link key={p.key} href={p.href} className="group">
              <Card className="h-full transition-colors group-hover:border-accent">
                <CardBody>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="mt-2 text-sm text-fg-muted">{p.desc}</p>
                  <span className="mt-4 inline-block text-sm text-accent">Open →</span>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Evidence + security strips */}
      <section id="evidence" className="border-t border-border bg-surface-2">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold">Citation-backed by design</h2>
            <p className="mt-3 text-fg-muted">
              Continuous ingestion grades evidence quality, detects conflicting, corrected or retracted findings, and
              routes medical or high-risk content to human reviewers before it reaches members.
            </p>
          </div>
          <div id="security">
            <h2 className="text-2xl font-semibold">Privacy-protected for the workforce</h2>
            <p className="mt-3 text-fg-muted">
              Employers only ever see privacy-protected aggregate analytics. Identifiable member health data stays in the
              member&apos;s Healthspan Passport, gated by consent and tenant isolation.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-fg-muted md:flex-row">
          <p>© {new Date().getFullYear()} Numik HealthspanOS · Demo environment — synthetic data only.</p>
          <p>Non-diagnostic. For wellness and workforce healthspan programs.</p>
        </div>
      </footer>
    </div>
  );
}
