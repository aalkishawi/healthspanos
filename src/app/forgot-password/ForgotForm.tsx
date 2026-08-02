"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, TextInput } from "@/components/ui/Field";

export function ForgotForm() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: f.get("email") }),
    });
    setBusy(false);
    setSent(true);
  }

  // Always the same confirmation, so this page cannot be used to discover which
  // addresses have accounts.
  if (sent) {
    return (
      <div className="mt-5 space-y-3">
        <FormMessage tone="success">Check your inbox.</FormMessage>
        <p className="text-sm text-fg-muted">
          If that address has an account, we&rsquo;ve sent a reset link. It expires in 1 hour and can
          be used once.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      <Field label="Email" htmlFor="email">
        <TextInput id="email" name="email" type="email" required autoComplete="email" />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
