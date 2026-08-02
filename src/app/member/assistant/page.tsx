import { requirePortal } from "@/lib/session";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AssistantForm } from "./AssistantForm";

// AI research assistant. The member asks a question; the page posts it to the
// configurable multi-model gateway (src/lib/ai/gateway.ts via /api/assistant) and
// renders the structured, citation-backed, non-diagnostic answer. Works in demo
// mode with no keys; live model calls activate once a provider key is configured.
export default async function AssistantPage() {
  await requirePortal("member");
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Research Assistant</h1>
        <p className="mt-1 text-sm text-fg-muted">Citation-backed answers from graded evidence. Non-diagnostic.</p>
      </div>
      <Card>
        <CardHeader title="Ask about longevity &amp; preventive health" action={<Badge tone="info">Demo mode</Badge>} />
        <CardBody className="space-y-3">
          <div className="rounded border border-border bg-surface p-4 text-sm text-fg-muted">
            The assistant runs through Numik&apos;s configurable multi-model gateway with retrieval-augmented generation
            and citation verification. It responds in demo mode until a provider key is added in
            <code className="mx-1 text-fg">.env</code>; the answer shape is identical either way.
          </div>
          <AssistantForm />
        </CardBody>
      </Card>
    </>
  );
}
