import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site/Chrome";
import { LegalNotice, LegalPage } from "@/components/site/Legal";
import { K_ANONYMITY_MIN } from "@/lib/tenant";
import { CONSENT_VERSION } from "@/lib/intake";

export const metadata: Metadata = {
  title: "Privacy policy · Numik HealthspanOS",
  description: "What Numik HealthspanOS collects, why, who can see it, and how to remove it.",
};

// IMPORTANT: this page describes what the SYSTEM ACTUALLY DOES, verified
// against the implementation. It is deliberately NOT drafted as binding legal
// prose — that requires a health-tech lawyer (PRODUCTION_BUILD_PLAN Phase 7).
// Writing convincing-looking policy text without review would be worse than
// having none: it reads as a commitment nobody checked.
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface text-fg">
      <SiteHeader />
      <LegalPage title="Privacy policy" updated={CONSENT_VERSION}>
        <LegalNotice />

        <h2>What we collect</h2>
        <p>
          <strong>Account data:</strong> your name, email address and a hashed password. Passwords
          are stored as bcrypt hashes and are never recoverable, including by us.
        </p>
        <p>
          <strong>Health intake:</strong> the answers you give during onboarding — goals, sleep,
          activity, lifestyle patterns, and optionally your year of birth and sex. We deliberately do
          not collect symptoms, diagnoses, medications or test results.
        </p>
        <p>
          <strong>Derived indices:</strong> the domain scores computed from your intake, along with
          the reasoning behind each one.
        </p>
        <p>
          <strong>Research questions:</strong> questions you ask the research assistant, retained so
          that clinical and regulatory review can reconstruct what was asked and answered.
        </p>

        <h2>Who can see it</h2>
        <p>
          <strong>You can.</strong> Your passport, indices and plans are visible to you.
        </p>
        <p>
          <strong>Your employer cannot see anything identifiable.</strong> If you joined through an
          employer, they see aggregate statistics only, and only for groups of at least{" "}
          {K_ANONYMITY_MIN} people. Below that threshold the figure and the group size are both
          withheld — a group of three is close enough to a name to matter. This is enforced in the
          code path that serves those pages, not by policy alone.
        </p>
        <p>
          <strong>Only with your consent.</strong> You are excluded from all aggregate reporting
          unless you have actively granted consent, and withdrawing it removes you immediately.
        </p>
        <p>
          <strong>Clinical reviewers</strong> see action plans flagged as high-risk, so a person
          checks them before they reach you. They see the plan, not your identity.
        </p>

        <h2>Consent</h2>
        <p>
          Consent is versioned (currently <code>{CONSENT_VERSION}</code>) and recorded as an
          append-only history: withdrawing writes a new record rather than erasing the old one, so
          what you agreed to and when remains auditable. If the terms change, your previous consent
          does not silently carry over — you are asked again.
        </p>
        <p>
          You can withdraw at any time from your passport page. It takes effect on the next
          aggregate computation, and no historical aggregate retains your individual contribution in
          identifiable form.
        </p>

        <h2>Your rights</h2>
        <p>
          You can export everything we hold about you, and you can delete your account and its data.
          Both are available from your account settings.
        </p>

        <h2>What we do not do</h2>
        <ul>
          <li>We do not sell your data.</li>
          <li>We do not use your health data to train models.</li>
          <li>We do not include your data in another organisation&rsquo;s analytics.</li>
          <li>We do not put health information in emails.</li>
          <li>We do not log your intake answers or your questions to our application logs.</li>
        </ul>

        <h2>Sub-processors</h2>
        <p>
          We use third parties for hosting, database, transactional email, error tracking and AI
          model inference. Error reports are configured to strip request bodies, headers and
          cookies, and session recording is disabled outright because it would capture health data
          on screen.
        </p>
      </LegalPage>
      <SiteFooter />
    </div>
  );
}
