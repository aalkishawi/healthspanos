"use client";
// Consent control. Withdrawal is immediate and self-service — a consent you
// cannot revoke without emailing support is not meaningful consent.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";

export function ConsentPanel({
  initialConsent, initialVersion, currentVersion, updatedAt,
}: {
  initialConsent: string;
  initialVersion: string | null;
  currentVersion: string;
  updatedAt: string | null;
}) {
  const router = useRouter();
  const [consent, setConsent] = useState(initialConsent);
  const [version, setVersion] = useState(initialVersion);
  const [when, setWhen] = useState(updatedAt);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const granted = consent === "GRANTED";
  const stale = granted && version !== currentVersion;

  async function change(action: "GRANTED" | "WITHDRAWN") {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/member/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(data.error ?? "Could not update consent.");
    setConsent(data.consent);
    setVersion(data.version);
    setWhen(data.at);
    setMsg(data.message);
    // The consent badge next to "Your inputs" is server-rendered from the same
    // profile row. Without this the panel says GRANTED while the badge still
    // says PENDING until the next reload — two truths on one screen about the
    // member's own privacy setting, which is exactly where doubt is expensive.
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Aggregate reporting consent</h2>
          <p className="mt-1 max-w-prose text-sm text-fg-muted">
            With consent, your results contribute to anonymised, aggregated workforce reporting.
            Your employer never sees your individual data, and cohorts below the minimum size are
            suppressed entirely. You can withdraw at any time, which removes you from all aggregates.
          </p>
        </div>
        <Badge tone={granted ? "success" : "neutral"}>{granted ? "Granted" : "Not granted"}</Badge>
      </div>

      {when && (
        <p className="mt-3 text-xs text-fg-muted">
          Last updated {new Date(when).toLocaleString()}
          {version ? ` · version ${version}` : ""}
        </p>
      )}

      {stale && (
        <div className="mt-3">
          <FormMessage tone="info">
            Our consent terms changed (version {currentVersion}). Re-confirm to keep contributing.
          </FormMessage>
        </div>
      )}

      {msg && <div className="mt-3"><FormMessage tone="success">{msg}</FormMessage></div>}

      <div className="mt-4 flex gap-3">
        {granted && !stale ? (
          <Button variant="secondary" onClick={() => change("WITHDRAWN")} disabled={busy}>
            {busy ? "…" : "Withdraw consent"}
          </Button>
        ) : (
          <Button onClick={() => change("GRANTED")} disabled={busy}>
            {busy ? "…" : stale ? `Re-confirm consent (${currentVersion})` : "Give consent"}
          </Button>
        )}
      </div>
    </div>
  );
}
