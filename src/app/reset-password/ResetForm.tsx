"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, TextInput } from "@/components/ui/Field";

export function ResetForm({ token }: { token: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!token) {
    return (
      <div className="mt-5 space-y-4">
        <FormMessage tone="error">That link is invalid or has expired. Please request a new one.</FormMessage>
        <Link href="/forgot-password" className="block">
          <Button variant="secondary" className="w-full">Request a new link</Button>
        </Link>
      </div>
    );
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
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Something went wrong.");
    setDone(true);
  }

  if (done) {
    return (
      <div className="mt-5 space-y-4">
        <FormMessage tone="success">Password updated.</FormMessage>
        <Link href="/login" className="block">
          <Button size="lg" className="w-full">Sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      <Field label="New password" htmlFor="password" hint="At least 10 characters.">
        <TextInput id="password" name="password" type="password" required autoComplete="new-password" minLength={10} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm">
        <TextInput id="confirm" name="confirm" type="password" required autoComplete="new-password" minLength={10} />
      </Field>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Updating…" : "Set new password"}
      </Button>
    </form>
  );
}
