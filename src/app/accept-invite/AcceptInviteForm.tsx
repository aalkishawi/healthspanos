"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, TextInput } from "@/components/ui/Field";

export function AcceptInviteForm({ token }: { token: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!token) {
    return <FormMessage tone="error">That invitation link is invalid or has expired. Ask your administrator to send a new one.</FormMessage>;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password") ?? "");
    if (password !== String(f.get("confirm") ?? "")) {
      return setError("Those passwords don't match.");
    }
    setBusy(true);
    const res = await fetch("/api/auth/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, fullName: f.get("fullName"), password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Something went wrong.");
    setDone(true);
  }

  if (done) {
    return (
      <div className="mt-5 space-y-4">
        <FormMessage tone="success">Account created.</FormMessage>
        <Link href="/login" className="block">
          <Button size="lg" className="w-full">Sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      <Field label="Your name" htmlFor="fullName">
        <TextInput id="fullName" name="fullName" required autoComplete="name" maxLength={120} />
      </Field>
      <Field label="Choose a password" htmlFor="password" hint="At least 10 characters.">
        <TextInput id="password" name="password" type="password" required autoComplete="new-password" minLength={10} />
      </Field>
      <Field label="Confirm password" htmlFor="confirm">
        <TextInput id="confirm" name="confirm" type="password" required autoComplete="new-password" minLength={10} />
      </Field>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Creating account…" : "Accept invitation"}
      </Button>
      <p className="text-xs text-fg-muted">
        Your employer will see anonymised, aggregated results only — never your individual health
        data, and only if you give consent.
      </p>
    </form>
  );
}
