"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, Select, TextInput } from "@/components/ui/Field";

// Posts to /api/contact, which emails the team through the existing Resend
// integration. With no email key configured the API says so plainly rather than
// showing a success message for a message that went nowhere.
export function ContactForm({ defaultTopic }: { defaultTopic: string }) {
  const [state, setState] = useState<{ tone: "error" | "success" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState(null);
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: f.get("name"),
        email: f.get("email"),
        organisation: f.get("organisation"),
        topic: f.get("topic"),
        message: f.get("message"),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setState({ tone: "error", text: data.error ?? "Could not send that. Please try again." });
      return;
    }
    setState({ tone: data.delivered ? "success" : "info", text: data.message });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-border bg-surface p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="name">
          <TextInput id="name" name="name" required maxLength={120} autoComplete="name" />
        </Field>
        <Field label="Work email" htmlFor="email">
          <TextInput id="email" name="email" type="email" required autoComplete="email" />
        </Field>
      </div>
      <Field label="Organisation" htmlFor="organisation" hint="Optional">
        <TextInput id="organisation" name="organisation" maxLength={160} autoComplete="organization" />
      </Field>
      <Field label="What is this about?" htmlFor="topic">
        <Select id="topic" name="topic" defaultValue={defaultTopic}>
          <option value="demo">Book a demo</option>
          <option value="enterprise">Enterprise pricing</option>
          <option value="dpa">Data processing / compliance</option>
          <option value="general">Something else</option>
        </Select>
      </Field>
      <Field label="Message" htmlFor="message">
        <textarea
          id="message"
          name="message"
          required
          minLength={10}
          maxLength={4000}
          rows={5}
          className="w-full rounded border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </Field>
      {state && <FormMessage tone={state.tone}>{state.text}</FormMessage>}
      <Button type="submit" size="lg" disabled={busy}>
        {busy ? "Sending…" : "Send"}
      </Button>
      <p className="text-xs text-fg-muted">
        Please don&rsquo;t include health information in this form — it isn&rsquo;t the right
        channel for it.
      </p>
    </form>
  );
}
