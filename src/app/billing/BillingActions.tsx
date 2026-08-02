"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { FormMessage } from "@/components/ui/Field";

export function BillingActions({ plan, role }: { plan: string; role: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const canBuySeats = role === "ENTERPRISE_ADMIN" || role === "PLATFORM_ADMIN";

  async function go(path: string, body: unknown, label: string) {
    setError(null);
    setBusy(label);
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok || !data.url) {
      setError(data.error ?? "Could not continue to Stripe.");
      return;
    }
    // Stripe-hosted checkout: card details never touch this application.
    window.location.href = data.url;
  }

  return (
    <Card>
      <CardHeader title="Manage your subscription" />
      <CardBody className="space-y-3">
        <div className="flex flex-wrap gap-3">
          {plan === "FREE" && (
            <Button onClick={() => go("/api/billing/checkout", { plan: "MEMBER_PRO" }, "pro")} disabled={busy !== null}>
              {busy === "pro" ? "Redirecting…" : "Upgrade to Member Pro"}
            </Button>
          )}
          {canBuySeats && (
            <Button
              variant="secondary"
              onClick={() => go("/api/billing/checkout", { plan: "ENTERPRISE_SEATS", quantity: 10 }, "seats")}
              disabled={busy !== null}
            >
              {busy === "seats" ? "Redirecting…" : "Buy 10 enterprise seats"}
            </Button>
          )}
          {plan !== "FREE" && (
            <Button variant="secondary" onClick={() => go("/api/billing/portal", null, "portal")} disabled={busy !== null}>
              {busy === "portal" ? "Redirecting…" : "Manage billing"}
            </Button>
          )}
        </div>
        {error && <FormMessage tone="error">{error}</FormMessage>}
      </CardBody>
    </Card>
  );
}
