import { requirePortal } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function PassportPage() {
  const user = await requirePortal("member");
  const profile = await prisma.memberProfile.findUnique({ where: { userId: user.id } });
  // `intake` is a native jsonb column, so Prisma returns an already-parsed
  // value — no JSON.parse, and no malformed-string failure mode at read time.
  // Still guarded: the column is nullable and only an object is renderable.
  const intake =
    profile?.intake && typeof profile.intake === "object" && !Array.isArray(profile.intake)
      ? (profile.intake as Record<string, unknown>)
      : {};

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Healthspan Passport</h1>
        <p className="mt-1 text-sm text-fg-muted">Goals, questionnaires, lab, wearable, sleep, activity &amp; lifestyle inputs.</p>
      </div>

      <Card>
        <CardHeader
          title="Data sources"
          subtitle="Real-data-ready schema. This demo tenant uses synthetic data only."
          action={<Badge tone={profile?.consent === "GRANTED" ? "success" : "warning"}>Consent: {profile?.consent ?? "PENDING"}</Badge>}
        />
        <CardBody>
          <dl className="grid gap-4 sm:grid-cols-2">
            {Object.entries(intake).map(([k, v]) => (
              <div key={k} className="rounded border border-border bg-surface p-3">
                <dt className="text-xs uppercase tracking-wide text-fg-muted">{k}</dt>
                <dd className="mt-1 font-medium">{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Privacy" subtitle="Who can see this data" />
        <CardBody className="space-y-2 text-sm text-fg-muted">
          <p>• Your employer only ever receives privacy-protected aggregate analytics — never your identifiable health details.</p>
          <p>• Identifiable data is released to a clinical workflow only where a legally valid requirement explicitly applies.</p>
          <p>• You can withdraw consent at any time, which removes you from all aggregate cohorts.</p>
        </CardBody>
      </Card>
    </>
  );
}
