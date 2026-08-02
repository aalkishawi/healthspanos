"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, TextInput } from "@/components/ui/Field";

export function EnterpriseSignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/signup-enterprise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgName: f.get("orgName"),
        adminName: f.get("adminName"),
        adminEmail: f.get("adminEmail"),
        password: f.get("password"),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Something went wrong. Try again.");
    setSent(true);
  }

  if (sent) {
    return (
      <div className="mt-5 space-y-3">
        <FormMessage tone="success">Check your inbox.</FormMessage>
        <p className="text-sm text-fg-muted">
          If that address can be used, we&rsquo;ve sent a confirmation link. Once confirmed you can
          sign in and invite your people.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      <Field label="Organisation name" htmlFor="orgName">
        <TextInput id="orgName" name="orgName" required maxLength={160} autoComplete="organization" />
      </Field>
      <Field label="Your name" htmlFor="adminName">
        <TextInput id="adminName" name="adminName" required autoComplete="name" maxLength={120} />
      </Field>
      <Field label="Work email" htmlFor="adminEmail">
        <TextInput id="adminEmail" name="adminEmail" type="email" required autoComplete="email" />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 10 characters.">
        <TextInput id="password" name="password" type="password" required autoComplete="new-password" minLength={10} />
      </Field>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Creating workspace…" : "Create enterprise workspace"}
      </Button>
      <p className="text-xs text-fg-muted">
        You will see anonymised, aggregated workforce results only. Individual member health data is
        never visible to an employer.
      </p>
    </form>
  );
}
