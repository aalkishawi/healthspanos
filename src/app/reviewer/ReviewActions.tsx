"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

// Human-in-the-loop decision controls. Posts a ReviewApproval and updates status.
export function ReviewActions({ evidenceItemId }: { evidenceItemId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(decision: "APPROVE" | "FLAG" | "REJECT") {
    setBusy(decision);
    await fetch(`/api/evidence/${evidenceItemId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => decide("APPROVE")} disabled={!!busy}>
        {busy === "APPROVE" ? "…" : "Approve"}
      </Button>
      <Button size="sm" variant="secondary" onClick={() => decide("FLAG")} disabled={!!busy}>
        {busy === "FLAG" ? "…" : "Flag conflict/retraction"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => decide("REJECT")} disabled={!!busy}>
        {busy === "REJECT" ? "…" : "Reject"}
      </Button>
    </div>
  );
}
