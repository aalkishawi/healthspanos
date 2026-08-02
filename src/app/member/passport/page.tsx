import Link from "next/link";
import { requirePortal } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CONSENT_VERSION, summarizeIntake } from "@/lib/intake";
import { latestScores } from "@/lib/scoring";
import { ScoreCard } from "@/components/ScoreCard";
import { ConsentPanel } from "../ConsentPanel";

export const metadata = { title: "Healthspan Passport · Numik HealthspanOS" };

export default async function PassportPage() {
  const user = await requirePortal("member");
  // Scoped by tenant as well as user — the session's tenant is the privacy
  // boundary, and a lookup by userId alone would not express that.
  const profile = await prisma.memberProfile.findFirst({
    where: { userId: user.id, tenantId: user.tenantId },
    select: {
      id: true,
      intake: true, consent: true, consentVersion: true, consentUpdatedAt: true,
      onboardingCompletedAt: true,
    },
  });
  const profileId = profile?.id;

  const rows = summarizeIntake(profile?.intake);
  const onboarded = Boolean(profile?.onboardingCompletedAt) && rows.length > 0;

  // Scores are only fetched once onboarding is complete — there is nothing real
  // to compute from a partial intake, and a placeholder score would be
  // indistinguishable from a computed one.
  const scores = onboarded && profileId ? await latestScores(profileId) : [];
  const overall = scores.length
    ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
    : 0;

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Healthspan Passport</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Built from your own inputs — goals, sleep, activity and lifestyle.
        </p>
      </div>

      {/* No intake yet: prompt to finish. Deliberately NOT a placeholder
          profile — showing invented numbers here would be indistinguishable
          from a real result, which is the failure CLAUDE.md rule 2 forbids. */}
      {!onboarded ? (
        <Card>
          <CardHeader
            title="Your passport is empty"
            subtitle="Complete the five-step intake and your passport is built from your answers."
          />
          <CardBody>
            <p className="max-w-prose text-sm text-fg-muted">
              We don&rsquo;t show sample scores here. Until you complete onboarding there is nothing
              real to show, and a placeholder would be indistinguishable from your actual results.
            </p>
            <div className="mt-4">
              <Link href="/member/onboarding">
                <Button size="lg">Start onboarding</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Your inputs"
            subtitle={`Completed ${profile!.onboardingCompletedAt!.toLocaleDateString()}`}
            action={
              <Badge tone={profile?.consent === "GRANTED" ? "success" : "warning"}>
                Consent: {profile?.consent ?? "PENDING"}
              </Badge>
            }
          />
          <CardBody>
            <dl className="grid gap-4 sm:grid-cols-2">
              {rows.map((r) => (
                <div key={r.label} className="rounded border border-border bg-surface p-3">
                  <dt className="text-xs uppercase tracking-wide text-fg-muted">{r.label}</dt>
                  <dd className="mt-1 font-medium capitalize">{r.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex items-center gap-3">
              <Link href="/member/onboarding">
                <Button variant="secondary" size="sm">Update my answers</Button>
              </Link>
              <p className="text-xs text-fg-muted">
                Changing your answers recomputes your indices below and keeps the previous values as
                history.
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {scores.length > 0 && (
        <Card>
          <CardHeader
            title="Your healthspan indices"
            subtitle="Computed from your own answers. Every number shows the reasoning behind it."
            action={<Badge tone="info">Overall {overall}</Badge>}
          />
          <CardBody>
            <div className="grid gap-4 md:grid-cols-2">
              {scores.map((s) => (
                <ScoreCard
                  key={s.domain}
                  domain={s.domain}
                  score={s.score}
                  band={s.band}
                  explanation={s.explanation}
                  computedAt={s.computedAt}
                />
              ))}
            </div>
            <p className="mt-4 text-xs text-fg-muted">
              These are lifestyle indicators derived from what you reported. They are non-diagnostic,
              are not a medical assessment, and do not estimate disease risk.
            </p>
          </CardBody>
        </Card>
      )}

      <ConsentPanel
        initialConsent={profile?.consent ?? "PENDING"}
        initialVersion={profile?.consentVersion ?? null}
        currentVersion={CONSENT_VERSION}
        updatedAt={profile?.consentUpdatedAt ? profile.consentUpdatedAt.toISOString() : null}
      />

      <Card>
        <CardHeader title="Privacy" subtitle="Who can see this data" />
        <CardBody className="space-y-2 text-sm text-fg-muted">
          <p>• Your employer only ever receives privacy-protected aggregate analytics — never your identifiable health details.</p>
          <p>• Identifiable data is released to a clinical workflow only where a legally valid requirement explicitly applies.</p>
          <p>• You can withdraw consent at any time, which removes you from all aggregate cohorts.</p>
          <p>• Numik HealthspanOS is non-diagnostic. Nothing here is medical advice.</p>
        </CardBody>
      </Card>
    </>
  );
}
