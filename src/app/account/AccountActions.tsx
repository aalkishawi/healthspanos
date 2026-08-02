"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, FormMessage, TextInput } from "@/components/ui/Field";

export function ExportPanel() {
  return (
    <Card>
      <CardHeader
        title="Export your data"
        subtitle="Everything Numik holds about you, as a JSON file."
      />
      <CardBody className="space-y-3">
        <p className="text-sm text-fg-muted">
          Includes your account, intake answers, every computed index with its reasoning, your
          action plans, your consent history, your assistant questions, and the log of who accessed
          your record.
        </p>
        <a href="/api/account/export" download>
          <Button variant="secondary">Download my data</Button>
        </a>
        <p className="text-xs text-fg-muted">
          The file contains personal health information. Store it somewhere you would keep a medical
          record.
        </p>
      </CardBody>
    </Card>
  );
}

export function DeletePanel() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: f.get("password"), confirm: f.get("confirm") }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not delete the account.");
      return;
    }
    // The session is gone; a full navigation avoids rendering against a user
    // that no longer exists.
    window.location.href = "/?deleted=1";
  }

  return (
    <Card className="border-[color:var(--danger)]">
      <CardHeader
        title="Delete your account"
        subtitle="Permanent. Your health data is removed and cannot be recovered."
      />
      <CardBody className="space-y-3">
        <p className="text-sm text-fg-muted">
          This deletes your profile, intake answers, indices, action plans, consent records and
          assistant history, and removes you from all future aggregate reporting.
        </p>
        <p className="text-sm text-fg-muted">
          A record that a deletion happened is retained, with your identity removed. It contains no
          name, email or health information — keeping it is what lets us prove the deletion took
          place.
        </p>

        {!open ? (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            I want to delete my account
          </Button>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3 border-t border-border pt-4">
            <Field label="Your password" htmlFor="password">
              <TextInput id="password" name="password" type="password" required autoComplete="current-password" />
            </Field>
            <Field label="Type DELETE to confirm" htmlFor="confirm">
              <TextInput id="confirm" name="confirm" required pattern="DELETE" placeholder="DELETE" />
            </Field>
            {error && <FormMessage tone="error">{error}</FormMessage>}
            <div className="flex gap-3">
              <Button type="submit" disabled={busy}>
                {busy ? "Deleting…" : "Permanently delete"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
