import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site/Chrome";
import { LegalNotice, LegalPage } from "@/components/site/Legal";
import { K_ANONYMITY_MIN } from "@/lib/tenant";
import { CONSENT_VERSION } from "@/lib/intake";

export const metadata: Metadata = {
  title: "Security & data · Numik HealthspanOS",
  description: "How Numik HealthspanOS protects health data: tenant isolation, k-anonymity, encryption and audit.",
};

// Describes real, implemented controls. Anything not yet built is listed under
// "Not yet in place" rather than omitted — a security page that lists only the
// wins is a marketing page.
export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-surface text-fg">
      <SiteHeader />
      <LegalPage title="Security & data" updated={CONSENT_VERSION}>
        <LegalNotice />

        <h2>Isolation</h2>
        <p>
          Every tenant is a privacy boundary. Members who sign up individually get their own tenant
          containing only themselves, so a query bug cannot spill one member&rsquo;s data into
          another&rsquo;s view — the scope already excludes everyone else. Employer tenants
          contain that employer&rsquo;s members and nobody else.
        </p>

        <h2>What employers can see</h2>
        <p>
          Aggregates only, for groups of at least {K_ANONYMITY_MIN} consenting members. Below that
          threshold both the value and the group size are withheld. This is enforced in the single
          code path that serves those pages, and asserted by tests that fail the build if a small
          cohort leaks a number.
        </p>

        <h2>Authentication</h2>
        <ul>
          <li>Passwords hashed with bcrypt; never stored or recoverable in plain text.</li>
          <li>Sessions in httpOnly, sameSite cookies, secure in production.</li>
          <li>Email verification required before first sign-in.</li>
          <li>Password reset and verification links are single-use, expiring, and stored only as hashes — a database leak contains no working links.</li>
          <li>Rate limiting on all authentication endpoints.</li>
        </ul>

        <h2>The AI assistant</h2>
        <ul>
          <li>Answers are grounded only in our reviewed evidence corpus, never free-form model output.</li>
          <li>Every citation must quote the source verbatim, and the quote is checked against the stored abstract. Citations that fail are discarded and counted.</li>
          <li>Emergency and individual-medical questions are refused before any model is called.</li>
          <li>Your questions are never used to train models.</li>
        </ul>

        <h2>Observability</h2>
        <p>
          Application logs record events and identifiers, never health content — intake answers,
          questions and explanations are redacted by the logger itself, not by convention. Error
          reports strip request bodies, headers and cookies, and session replay is disabled because
          it would capture health data on screen.
        </p>

        <h2>Not yet in place</h2>
        <p>
          Being explicit, because a security page that lists only what is done is a sales page:
        </p>
        <ul>
          <li>No independent penetration test has been carried out yet.</li>
          <li>Field-level encryption at rest is not implemented beyond what the database provides.</li>
          <li>These pages have not been reviewed by a lawyer.</li>
        </ul>
        <p>
          Found something? Please tell us at security@numik.example rather than disclosing publicly,
          and we will respond.
        </p>
      </LegalPage>
      <SiteFooter />
    </div>
  );
}
