import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site/Chrome";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact · Numik HealthspanOS",
  description: "Talk to us about enterprise healthspan programmes, data processing, or security.",
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const { topic } = await searchParams;
  const isDemo = topic === "demo";

  return (
    <div className="min-h-screen bg-surface text-fg">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold">{isDemo ? "Book a demo" : "Get in touch"}</h1>
        <p className="mt-3 text-lg text-fg-muted">
          {isDemo
            ? "See how workforce healthspan reporting works without any identifiable data leaving your people."
            : "Enterprise programmes, data processing agreements, or security questions."}
        </p>

        <div className="mt-8">
          <ContactForm defaultTopic={isDemo ? "demo" : "general"} />
        </div>

        <Card className="mt-8">
          <CardHeader title="Security disclosures" />
          <CardBody className="text-sm text-fg-muted">
            Please report vulnerabilities to <strong>security@numik.example</strong> rather than
            through this form or in public, and we will respond.
          </CardBody>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
