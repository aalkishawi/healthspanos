"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";

export function PlanReviewActions({ planId }: { planId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function decide(decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES") {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/plans/${planId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ tone: "error", text: data.error ?? "Could not record the decision." });
    setMsg({ tone: "success", text: data.message });
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => decide("APPROVE")} disabled={busy}>Approve</Button>
        <Button size="sm" variant="secondary" onClick={() => decide("REQUEST_CHANGES")} disabled={busy}>
          Request changes
        </Button>
        <Button size="sm" variant="ghost" onClick={() => decide("REJECT")} disabled={busy}>Reject</Button>
      </div>
      {msg && <FormMessage tone={msg.tone}>{msg.text}</FormMessage>}
    </div>
  );
}
