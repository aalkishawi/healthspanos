import Link from "next/link";
import { getDictionary } from "@/lib/i18n";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SiteFooter, SiteHeader } from "@/components/site/Chrome";

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
      <SiteHeader />

      {/* Hero */}
      <section className="numik-accent-grad">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Badge tone="accent">Longevity intelligence · Preventive health · Healthy aging</Badge>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight md:text-5xl">{t.public.heroTitle}</h1>
          <p className="mt-5 max-w-2xl text-lg text-fg-muted">{t.public.heroBody}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <ButtonLink href="/signup" size="lg">
              Create a free account
            </ButtonLink>
            <ButtonLink href="/contact?topic=demo" variant="secondary" size="lg">
              Book a demo for your organisation
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-fg-muted">
            Free to start · No card required · Your employer never sees identifiable data
          </p>
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


      {/* How it works — the value proposition a cold visitor needs */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold">How it works</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Members answer five short steps",
                body: "Goals, sleep, activity and lifestyle. No symptoms, no medications, no test results — this is not a clinical intake.",
              },
              {
                step: "02",
                title: "Numik computes explainable indices",
                body: "Five domain scores, each showing the reasoning behind the number. Nothing is a black box, and nothing is a diagnosis.",
              },
              {
                step: "03",
                title: "Employers see patterns, never people",
                body: "Aggregates for groups large enough that nobody can be identified, and only for members who consented.",
              },
            ].map((s) => (
              <div key={s.step}>
                <span className="text-sm font-semibold text-accent">{s.step}</span>
                <h3 className="mt-2 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-fg-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof — deliberately empty placeholders. Fabricating logos or
          testimonials for a product with no customers would put invented
          content on a public page. */}
      <section className="border-t border-border bg-surface-2">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-fg-muted">
            Early access partners
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="grid h-16 place-items-center rounded border border-dashed border-border text-xs text-fg-muted"
              >
                Partner logo
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-fg-muted">
            We are onboarding our first partners now.{" "}
            <a href="/contact?topic=demo" className="text-accent underline-offset-2 hover:underline">
              Talk to us
            </a>{" "}
            about being one.
          </p>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="text-3xl font-semibold">Start with your own passport</h2>
          <p className="mt-3 text-fg-muted">
            Free, no card, and you can delete everything at any time.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/signup" size="lg">Create a free account</ButtonLink>
            <ButtonLink href="/pricing" variant="secondary" size="lg">See pricing</ButtonLink>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
