"use client";
// Enterprise admin: invite members by email. Authorization is enforced
// server-side in /api/enterprise/invites — this component only renders it.
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, FormMessage, TextInput } from "@/components/ui/Field";

type Invite = {
  email: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
};

export function InvitePanel({ initialInvites }: { initialInvites: Invite[] }) {
  const [invites, setInvites] = useState(initialInvites);
  const [msg, setMsg] = useState<{ tone: "error" | "success" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const form = e.currentTarget;
    const email = String(new FormData(form).get("email") ?? "");
    const res = await fetch("/api/enterprise/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ tone: "error", text: data.error ?? "Could not send the invitation." });
    // `delivered: false` means the invite exists but email isn't configured —
    // surfaced rather than reported as a clean success.
    setMsg({ tone: data.delivered ? "success" : "info", text: data.message });
    const list = await fetch("/api/enterprise/invites").then((r) => r.json()).catch(() => null);
    if (list?.invites) setInvites(list.invites);
    form.reset();
  }

  function status(i: Invite): { label: string; tone: "success" | "warning" | "neutral" } {
    if (i.acceptedAt) return { label: "Joined", tone: "success" };
    if (i.revokedAt) return { label: "Revoked", tone: "neutral" };
    if (new Date(i.expiresAt) <= new Date()) return { label: "Expired", tone: "neutral" };
    return { label: "Pending", tone: "warning" };
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <h2 className="text-base font-semibold">Invite members</h2>
      <p className="mt-1 max-w-prose text-sm text-fg-muted">
        Invited people set their own password and join this workspace. You will see anonymised
        aggregates only — never an individual&rsquo;s health data.
      </p>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field label="Work email" htmlFor="inviteEmail">
            <TextInput id="inviteEmail" name="email" type="email" required placeholder="colleague@company.com" />
          </Field>
        </div>
        <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send invitation"}</Button>
      </form>

      {msg && <div className="mt-3"><FormMessage tone={msg.tone}>{msg.text}</FormMessage></div>}

      {invites.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-fg-muted">
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Sent</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => {
                const s = status(i);
                return (
                  <tr key={i.email} className="border-b border-border/60">
                    <td className="py-2">{i.email}</td>
                    <td className="py-2 text-fg-muted">{new Date(i.createdAt).toLocaleDateString()}</td>
                    <td className="py-2"><Badge tone={s.tone}>{s.label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
