import Link from "next/link";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FREE_ASSISTANT_QUESTIONS_PER_MONTH } from "@/lib/billing/entitlements";
import { SiteHeader, SiteFooter } from "@/components/site/Chrome";

export const metadata: Metadata = {
  title: "Pricing · Numik HealthspanOS",
  description:
    "Free to start. Member Pro for unlimited research questions and score history. Enterprise seats for privacy-protected workforce healthspan programmes.",
};

// Tiers mirror src/lib/billing/entitlements.ts. Kept in the same order and
// wording so what a visitor is sold is what the server actually grants —
// marketing copy that drifts from the entitlement table is how people end up
// paying for a feature they do not get.
const TIERS = [
  {
    name: "Free",
    price: "£0",
    cadence: "forever",
    blurb: "Enough to build a passport and see whether the research holds up.",
    features: [
      "Healthspan Passport from your own intake",
      "Explainable domain indices with the reasoning shown",
      "Personalised, non-diagnostic action plans",
      `${FREE_ASSISTANT_QUESTIONS_PER_MONTH} research assistant questions a month`,
    ],
    cta: { href: "/signup", label: "Create a free account" },
    highlight: false,
  },
  {
    name: "Member Pro",
    price: "£9",
    cadence: "per month",
    blurb: "For people actually running a healthspan programme on themselves.",
    features: [
      "Everything in Free",
      "Unlimited research assistant questions",
      "Score history and trends over time",
      "Priority on new domains as they ship",
    ],
    cta: { href: "/signup", label: "Start free, upgrade later" },
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "per seat, per month",
    blurb: "Workforce healthspan with a privacy boundary you can point at.",
    features: [
      "Everything in Member Pro for every member",
      "Aggregate workforce analytics — never identifiable data",
      "k-anonymity enforced server-side, not by policy",
      "Member invitations and seat management",
      "Clinical review workflow for high-risk guidance",
    ],
    cta: { href: "/contact?topic=demo", label: "Book a demo" },
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-surface text-fg">
      <SiteHeader />

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="text-4xl font-bold">Pricing</h1>
        <p className="mt-3 max-w-2xl text-lg text-fg-muted">
          Start free. Your health data is yours on every tier, and employers never see identifiable
          information on any of them.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {TIERS.map((t) => (
            <Card key={t.name} className={t.highlight ? "border-accent" : undefined}>
              <CardHeader
                title={t.name}
                subtitle={t.blurb}
                action={t.highlight ? <Badge tone="accent">Most popular</Badge> : undefined}
              />
              <CardBody className="space-y-5">
                <div>
                  <span className="text-3xl font-semibold">{t.price}</span>{" "}
                  <span className="text-sm text-fg-muted">{t.cadence}</span>
                </div>
                <ul className="space-y-2 text-sm text-fg-muted">
                  {t.features.map((f) => (
                    <li key={f}>✔ {f}</li>
                  ))}
                </ul>
                <ButtonLink href={t.cta.href} variant={t.highlight ? "primary" : "secondary"} className="w-full">
                  {t.cta.label}
                </ButtonLink>
              </CardBody>
            </Card>
          ))}
        </div>

        <Card className="mt-10">
          <CardHeader title="What every tier includes" />
          <CardBody className="grid gap-3 text-sm text-fg-muted sm:grid-cols-2">
            <p>✔ Your data is private to you. Employers see aggregates only, and only with your consent.</p>
            <p>✔ Consent is revocable in one click, and removes you from all aggregate reporting immediately.</p>
            <p>✔ Every research answer is grounded in reviewed literature with checkable citations.</p>
            <p>✔ Non-diagnostic throughout. Numik informs; it does not diagnose or treat.</p>
          </CardBody>
        </Card>

        <p className="mt-8 text-sm text-fg-muted">
          Questions about enterprise pricing or data processing?{" "}
          <Link href="/contact" className="text-accent underline-offset-2 hover:underline">
            Get in touch
          </Link>
          .
        </p>
      </section>

      <SiteFooter />
    </div>
  );
}
