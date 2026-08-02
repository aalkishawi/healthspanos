import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/session";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { accessHistoryFor } from "@/lib/security/audit";
import { encryptionStatus } from "@/lib/security/encryption";
import { DeletePanel, ExportPanel } from "./AccountActions";

export const metadata: Metadata = { title: "Your account" };

export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account");

  const history = await accessHistoryFor(user.tenantId, user.id, 25);
  const enc = encryptionStatus();

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Your account</h1>
        <p className="mt-1 text-sm text-fg-muted">{user.email}</p>
      </div>

      <ExportPanel />

      {/* Transparency half of the audit trail. A log only the operator can read
          is a compliance artefact; one the subject can read is a trust feature. */}
      <Card>
        <CardHeader
          title="Who accessed your record"
          subtitle="Every read of your health data, newest first."
        />
        <CardBody>
          {history.length === 0 ? (
            <p className="text-sm text-fg-muted">No access recorded yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {history.map((h, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <Badge tone={h.byYou ? "neutral" : "warning"}>{h.byYou ? "you" : h.reason}</Badge>
                  <span className="capitalize">{h.action}</span>
                  <span className="text-xs text-fg-muted">{h.at.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="How your data is protected" />
        <CardBody className="space-y-2 text-sm text-fg-muted">
          <p>
            • Your intake answers are{" "}
            {enc.configured ? (
              <>encrypted at rest with {enc.algorithm.toUpperCase()}, separately from the database&rsquo;s own encryption.</>
            ) : (
              <>stored in an encrypted database. Field-level encryption is not enabled on this deployment.</>
            )}
          </p>
          <p>• Your employer sees aggregates only, and only for groups large enough to hide you in.</p>
          <p>• Withdrawing consent removes you from all aggregate reporting.</p>
          <p>• Your questions and answers are never used to train models.</p>
        </CardBody>
      </Card>

      <DeletePanel />
    </main>
  );
}
