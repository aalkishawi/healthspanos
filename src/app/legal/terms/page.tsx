import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site/Chrome";
import { LegalNotice, LegalPage } from "@/components/site/Legal";
import { CONSENT_VERSION } from "@/lib/intake";

export const metadata: Metadata = {
  title: "Terms of service · Numik HealthspanOS",
  description: "The terms on which Numik HealthspanOS is provided, including its non-diagnostic scope.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-surface text-fg">
      <SiteHeader />
      <LegalPage title="Terms of service" updated={CONSENT_VERSION}>
        <LegalNotice />

        <h2>What Numik is</h2>
        <p>
          Numik HealthspanOS is a wellness information service. It summarises published research and
          turns your self-reported lifestyle inputs into explainable, non-diagnostic indicators.
        </p>

        <h2>What Numik is not</h2>
        <p>
          <strong>It is not a medical device, and it does not practise medicine.</strong> It does not
          diagnose, treat, cure or prevent any condition. It does not interpret your symptoms, test
          results or medications. Nothing it produces is a substitute for a qualified clinician who
          can see your full history.
        </p>
        <p>
          If you have a medical emergency, contact your local emergency services. The assistant
          detects emergency language and will refuse to answer, but it is not a monitoring service
          and cannot be relied on to notice one.
        </p>

        <h2>Acceptable use</h2>
        <ul>
          <li>Do not use Numik to make clinical decisions for yourself or anyone else.</li>
          <li>Do not attempt to extract identifiable data about other members.</li>
          <li>Do not use the research assistant to seek individual medical advice — it will decline and route the question to clinical review.</li>
        </ul>

        <h2>Your content</h2>
        <p>
          Your intake answers and questions remain yours. You can export or delete them at any time.
          Deleting your account removes your personal data and excludes you from all future
          aggregates.
        </p>

        <h2>Availability and accuracy</h2>
        <p>
          Research moves. Evidence flagged as retracted or corrected is withdrawn from the corpus and
          stops being cited, but there is always a lag between publication and our seeing it. Every
          answer shows its sources so you can check them yourself — please do.
        </p>
      </LegalPage>
      <SiteFooter />
    </div>
  );
}
