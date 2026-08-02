"use client";
// Activate an action plan. The button is hidden when the plan is gated, but the
// server enforces the rule regardless (/api/member/plans/[id]/activate) — this
// is convenience, not security.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";

export function PlanActions({
  planId, status, requiresReview,
}: {
  planId: string;
  status: string;
  requiresReview: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const gated = requiresReview && status !== "APPROVED";

  if (status === "ACTIVE") return null;
  if (status === "ARCHIVED") return null;

  if (gated) {
    return (
      <p className="text-xs text-fg-muted">
        Awaiting clinical review. This plan touches medical or high-risk content, so a reviewer
        must approve it before it can be activated.
      </p>
    );
  }

  async function activate() {
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/member/plans/${planId}/activate`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Could not activate this plan.");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Button size="sm" onClick={activate} disabled={busy}>
        {busy ? "Activating…" : "Activate this plan"}
      </Button>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </div>
  );
}
