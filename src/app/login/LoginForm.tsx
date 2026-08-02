"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function LoginForm({ next, dict }: { next?: string; dict: { email: string; password: string; submit: string } }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Invalid email or password.");
      setBusy(false);
      return;
    }
    router.push(next && next.startsWith("/") ? next : data.home);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm text-fg-muted">{dict.email}</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm text-fg-muted">{dict.password}</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      {error && <p role="alert" className="text-sm text-[color:var(--danger)]">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "…" : dict.submit}
      </Button>
    </form>
  );
}
