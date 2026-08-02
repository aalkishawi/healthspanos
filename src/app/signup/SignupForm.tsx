"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, TextInput } from "@/components/ui/Field";

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: f.get("fullName"),
        email: f.get("email"),
        password: f.get("password"),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Something went wrong. Try again.");
    setSent(true);
  }

  // The server answers identically for new and existing addresses, so this
  // screen must not imply the account is new — it says "check your inbox"
  // either way.
  if (sent) {
    return (
      <div className="mt-5 space-y-3">
        <FormMessage tone="success">Check your inbox.</FormMessage>
        <p className="text-sm text-fg-muted">
          If that address can be used, we&rsquo;ve sent a confirmation link. It expires in 24 hours.
          You&rsquo;ll be able to sign in once your address is confirmed.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      <Field label="Full name" htmlFor="fullName">
        <TextInput id="fullName" name="fullName" required autoComplete="name" maxLength={120} />
      </Field>
      <Field label="Email" htmlFor="email">
        <TextInput id="email" name="email" type="email" required autoComplete="email" />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 10 characters. Longer beats complicated.">
        <TextInput id="password" name="password" type="password" required autoComplete="new-password" minLength={10} />
      </Field>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-xs text-fg-muted">
        Your health data is private to you. Employers never see identifiable information — only
        anonymised aggregates, and only if you consent.
      </p>
    </form>
  );
}
