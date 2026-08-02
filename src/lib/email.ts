// Transactional email via Resend.
//
// Without RESEND_API_KEY the app does NOT pretend to have sent anything: it
// logs the full link at warn level and returns `{ delivered: false, reason }`,
// so local dev works (copy the link from the terminal) while every caller can
// still tell that no mail left the building. CLAUDE.md rule 3 — no stub that
// returns a canned success.
//
// PHI RULE: these templates carry a name and a link. Never put health data,
// scores, or intake answers in an email — it leaves our control the moment it
// is sent.
import { Resend } from "resend";
import { log } from "./logger";

const FROM = process.env.EMAIL_FROM || "Numik HealthspanOS <onboarding@resend.dev>";

export type SendResult =
  | { delivered: true; id: string }
  | { delivered: false; reason: "not-configured" | "send-failed"; detail?: string };

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Absolute base URL for links in emails.
 *
 * APP_BASE_URL is checked FIRST and is not a NEXT_PUBLIC_ variable on purpose.
 * Next inlines every `process.env.NEXT_PUBLIC_*` reference at BUILD time, even
 * in server code — so NEXT_PUBLIC_APP_URL is frozen to whatever was set when
 * the bundle was compiled and cannot be corrected at runtime. A build promoted
 * between environments would keep emailing links to the old host, silently.
 * APP_BASE_URL is read from the live process, so it can.
 *
 * VERCEL_URL is the per-deployment hostname and is also runtime-readable, which
 * makes preview deployments send links to themselves rather than to production.
 */
export function appBaseUrl(): string {
  const runtime = process.env.APP_BASE_URL?.trim();
  if (runtime) return runtime.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const buildTime = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (buildTime) return buildTime.replace(/\/$/, "");
  return "http://localhost:3000";
}

let client: Resend | null = null;
function resend(): Resend {
  if (!client) client = new Resend(process.env.RESEND_API_KEY!);
  return client;
}

async function send(to: string, subject: string, html: string, text: string, kind: string): Promise<SendResult> {
  if (!emailConfigured()) {
    // Visible, actionable, and honest about not having sent anything.
    log.warn("email.not_configured", { kind, note: "RESEND_API_KEY unset — link logged below, no email sent" });
    // eslint-disable-next-line no-console
    console.warn(`\n  [dev email] ${kind} for ${to}\n  ${text.match(/https?:\/\/\S+/)?.[0] ?? "(no link)"}\n`);
    return { delivered: false, reason: "not-configured" };
  }
  try {
    const res = await resend().emails.send({ from: FROM, to, subject, html, text });
    if (res.error) {
      log.error("email.send_failed", res.error, { kind });
      return { delivered: false, reason: "send-failed", detail: res.error.message };
    }
    log.info("email.sent", { kind, id: res.data?.id });
    return { delivered: true, id: res.data?.id ?? "" };
  } catch (err) {
    log.error("email.send_threw", err, { kind });
    return { delivered: false, reason: "send-failed" };
  }
}

// ── Templates ───────────────────────────────────────────────────────────────
// Plain, single-purpose, one link each. No tracking pixels: this is health-
// adjacent correspondence, not marketing.

function layout(heading: string, body: string, cta: { href: string; label: string }): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f7fb;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#14121f">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
    <p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#7c5cff">Numik HealthspanOS</p>
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${heading}</h1>
    <div style="font-size:15px;line-height:1.6;color:#3d3a52">${body}</div>
    <p style="margin:28px 0 0">
      <a href="${cta.href}" style="display:inline-block;background:#7c5cff;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">${cta.label}</a>
    </p>
    <p style="margin:24px 0 0;font-size:13px;color:#6b6880">If the button doesn't work, paste this into your browser:<br>
      <span style="word-break:break-all;color:#7c5cff">${cta.href}</span></p>
  </div>
  <p style="max-width:520px;margin:16px auto 0;font-size:12px;color:#8b8898">Numik HealthspanOS · non-diagnostic wellness intelligence. This email was sent because someone used this address to sign up or requested a change. If that wasn't you, you can ignore it.</p>
</body></html>`;
}

export function verificationUrl(token: string): string {
  return `${appBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
}

export function resetUrl(token: string): string {
  return `${appBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}

export function inviteUrl(token: string): string {
  return `${appBaseUrl()}/accept-invite?token=${encodeURIComponent(token)}`;
}

export function sendVerificationEmail(to: string, name: string, token: string): Promise<SendResult> {
  const href = verificationUrl(token);
  return send(
    to,
    "Confirm your Numik HealthspanOS address",
    layout(
      `Confirm your email`,
      `<p>Hi ${escapeHtml(name)},</p><p>Confirm this address to activate your Numik HealthspanOS account. The link expires in 24 hours.</p>`,
      { href, label: "Confirm email" },
    ),
    `Hi ${name},\n\nConfirm your email to activate your Numik HealthspanOS account (expires in 24 hours):\n${href}\n`,
    "verification",
  );
}

export function sendPasswordResetEmail(to: string, name: string, token: string): Promise<SendResult> {
  const href = resetUrl(token);
  return send(
    to,
    "Reset your Numik HealthspanOS password",
    layout(
      `Reset your password`,
      `<p>Hi ${escapeHtml(name)},</p><p>Use the link below to set a new password. It expires in 1 hour and can be used once. If you didn't request this, nothing has changed and you can ignore this email.</p>`,
      { href, label: "Set a new password" },
    ),
    `Hi ${name},\n\nSet a new password (expires in 1 hour, single use):\n${href}\n\nIf you didn't request this, ignore this email — nothing has changed.\n`,
    "password-reset",
  );
}

export function sendInvitationEmail(to: string, orgName: string, inviterName: string, token: string): Promise<SendResult> {
  const href = inviteUrl(token);
  return send(
    to,
    `${orgName} invited you to Numik HealthspanOS`,
    layout(
      `You've been invited`,
      `<p>${escapeHtml(inviterName)} invited you to join <strong>${escapeHtml(orgName)}</strong> on Numik HealthspanOS.</p>
       <p>You'll set your own password. Your employer sees only anonymised, aggregated results — never your individual health data.</p>
       <p>This invitation expires in 7 days.</p>`,
      { href, label: "Accept invitation" },
    ),
    `${inviterName} invited you to join ${orgName} on Numik HealthspanOS.\n\nAccept (expires in 7 days):\n${href}\n\nYour employer sees only anonymised aggregates, never your individual health data.\n`,
    "invitation",
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
