import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site/Chrome";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "About · Numik HealthspanOS",
  description: "Why Numik HealthspanOS exists and the principles it is built on.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-surface text-fg">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold">Why we built this</h1>
        <p className="mt-4 text-lg text-fg-muted">
          Thousands of longevity and preventive-health studies publish every week. A meaningful
          share are later corrected, contradicted or retracted. Acting on the wrong one is worse
          than acting on nothing.
        </p>
        <p className="mt-4 text-fg-muted">
          Numik HealthspanOS sits between that firehose and the people it is supposed to help. It
          reads the literature continuously, grades it by study design, notices when a paper stops
          being true, and answers questions only from what it can actually cite.
        </p>

        <h2 className="mt-12 text-2xl font-semibold">What we refuse to do</h2>
        <div className="mt-4 grid gap-4">
          <Card>
            <CardHeader title="We do not guess" />
            <CardBody className="text-sm text-fg-muted">
              If the evidence base cannot support an answer, the assistant says so. Every citation
              carries a quote checked against its source, and citations that fail are discarded
              rather than softened. A fluent guess about someone&rsquo;s health is worse than an
              honest &ldquo;we don&rsquo;t know&rdquo;.
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="We do not diagnose" />
            <CardBody className="text-sm text-fg-muted">
              Numik reports on habits, not conditions. It collects no symptoms, medications or test
              results, and questions about individual medical care are refused and routed to
              clinical review rather than answered.
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="We do not show employers your data" />
            <CardBody className="text-sm text-fg-muted">
              Employers see aggregates for groups large enough that nobody can be picked out, and
              only for members who consented. That is enforced in the code serving those pages and
              covered by tests — not promised in a policy document.
            </CardBody>
          </Card>
        </div>

        <h2 className="mt-12 text-2xl font-semibold">Where we are</h2>
        <p className="mt-3 text-fg-muted">
          Numik HealthspanOS is early. The evidence engine, scoring and privacy controls are built
          and tested. Clinical review of our scoring thresholds and legal review of our policies are
          still outstanding, and both will be complete before we accept real health data at scale.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href="/signup">Create a free account</ButtonLink>
          <ButtonLink href="/contact?topic=demo" variant="secondary">
            Book a demo
          </ButtonLink>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
