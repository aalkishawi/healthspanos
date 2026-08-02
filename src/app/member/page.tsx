import { requirePortal } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Stat } from "@/components/ui/Stat";

const BAND_TONE = { low: "danger", moderate: "warning", optimal: "success" } as const;

export default async function MemberOverview() {
  const user = await requirePortal("member");
  const profile = await prisma.memberProfile.findUnique({
    where: { userId: user.id },
    include: { scores: { orderBy: { computedAt: "desc" } }, actionPlans: true },
  });

  if (!profile) {
    return (
      <Card>
        <CardBody>
          <h2 className="text-lg font-semibold">Welcome, {user.fullName}</h2>
          <p className="mt-2 text-sm text-fg-muted">
            Your Healthspan Passport hasn&apos;t been created yet. Complete onboarding to generate your explainable,
            non-diagnostic healthspan scores.
          </p>
        </CardBody>
      </Card>
    );
  }

  const composite = Math.round(profile.scores.reduce((a, s) => a + s.score, 0) / (profile.scores.length || 1));
  const activePlans = profile.actionPlans.filter((p) => p.status === "ACTIVE").length;

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {user.fullName}</h1>
        <p className="mt-1 text-sm text-fg-muted">Your private Healthspan Passport. Scores are explainable and non-diagnostic.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Composite healthspan" value={composite} hint="Weighted across domains" />
        <Stat label="Active action plans" value={activePlans} hint="Safe lifestyle guidance" />
        <Stat label="Consent" value={<Badge tone={profile.consent === "GRANTED" ? "success" : "warning"}>{profile.consent}</Badge>} hint="Controls data sharing" />
      </div>

      <Card>
        <CardHeader title="Healthspan domain scores" subtitle="Each score includes a plain-language explanation." />
        <CardBody className="space-y-4">
          {profile.scores.map((s) => (
            <div key={s.id}>
              <div className="flex items-center justify-between">
                <span className="font-medium capitalize">{s.domain}</span>
                <div className="flex items-center gap-2">
                  <Badge tone={BAND_TONE[s.band as keyof typeof BAND_TONE] ?? "neutral"}>{s.band}</Badge>
                  <span className="w-8 text-end text-sm tabular-nums">{s.score}</span>
                </div>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-accent" style={{ width: `${s.score}%` }} />
              </div>
              <p className="mt-1 text-xs text-fg-muted">{s.explanation}</p>
            </div>
          ))}
        </CardBody>
      </Card>
    </>
  );
}
