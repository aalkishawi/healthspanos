import { requirePortal } from "@/lib/session";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function ProgramsPage() {
  await requirePortal("enterprise");
  const programs = [
    { name: "Sleep Reset", cohort: "All employees", status: "Active", tone: "success" as const },
    { name: "Metabolic Health Q3", cohort: "Opt-in", status: "Enrolling", tone: "info" as const },
    { name: "Executive Health", cohort: "Leadership", status: "Draft", tone: "neutral" as const },
  ];
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Healthspan Programs</h1>
        <p className="mt-1 text-sm text-fg-muted">Design and track measurable workforce healthspan initiatives.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {programs.map((p) => (
          <Card key={p.name}>
            <CardHeader title={p.name} subtitle={p.cohort} action={<Badge tone={p.tone}>{p.status}</Badge>} />
            <CardBody className="text-sm text-fg-muted">Outcome analysis uses aggregate, privacy-protected data only.</CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
