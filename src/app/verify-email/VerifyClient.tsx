"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, TextInput } from "@/components/ui/Field";

type State = "working" | "ok" | "failed";

export function VerifyClient({ token }: { token: string | null }) {
  const [state, setState] = useState<State>(token ? "working" : "failed");
  const [message, setMessage] = useState<string>(
    token ? "" : "That link is invalid or has expired. Please request a new one.",
  );
  // React 18 StrictMode double-invokes effects in dev; without this guard the
  // single-use token would be consumed twice and the second call would report
  // failure for a verification that actually succeeded.
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    (async () => {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      setState(res.ok ? "ok" : "failed");
      setMessage(data.message ?? data.error ?? "Something went wrong.");
    })();
  }, [token]);

  if (state === "working") return <p className="mt-5 text-sm text-fg-muted">Confirming your address…</p>;

  if (state === "ok") {
    return (
      <div className="mt-5 space-y-4">
        <FormMessage tone="success">{message}</FormMessage>
        <Link href="/login" className="block">
          <Button size="lg" className="w-full">Sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <FormMessage tone="error">{message}</FormMessage>
      <ResendForm />
    </div>
  );
}

function ResendForm() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: f.get("email") }),
    });
    setBusy(false);
    setSent(true);
  }

  if (sent) {
    return (
      <FormMessage tone="info">
        If that address is awaiting confirmation, a new link is on its way.
      </FormMessage>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 border-t border-border pt-4">
      <Field label="Send a new link" htmlFor="email">
        <TextInput id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
      </Field>
      <Button type="submit" variant="secondary" className="w-full" disabled={busy}>
        {busy ? "Sending…" : "Resend confirmation"}
      </Button>
    </form>
  );
}
