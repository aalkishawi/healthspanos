import { requirePortal } from "@/lib/session";
import { AI_MODELS } from "@/lib/ai/gateway";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

// Configurable multi-model gateway — admin view of the registered models.
export default async function ModelsPage() {
  await requirePortal("admin");
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">AI Model Gateway</h1>
        <p className="mt-1 text-sm text-fg-muted">Configurable multi-model routing with structured outputs. Keys set via environment.</p>
      </div>
      <Card>
        <CardHeader title="Registered models" subtitle="Latest stable families across providers" />
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-fg-muted">
              <tr>
                <th className="p-4 text-start font-medium">Provider</th>
                <th className="p-4 text-start font-medium">Model</th>
                <th className="p-4 text-start font-medium">Role</th>
                <th className="p-4 text-start font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {AI_MODELS.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="p-4">{m.provider}</td>
                  <td className="p-4 font-medium">{m.id}</td>
                  <td className="p-4 text-fg-muted">{m.role}</td>
                  <td className="p-4">
                    <Badge tone={m.configured ? "success" : "neutral"}>{m.configured ? "configured" : "demo"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </>
  );
}
