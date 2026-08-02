"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { AssistantAnswer } from "@/lib/ai/gateway";

// Live research-assistant control. Posts the question to /api/assistant (the
// configurable multi-model gateway) and renders the structured, citation-backed,
// non-diagnostic answer. Works in demo mode with no provider keys.
export function AssistantForm() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setAnswer(null);
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "The assistant could not answer that. Please try again.");
        return;
      }
      setAnswer(data as AssistantAnswer);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="flex gap-2" aria-label="Ask the research assistant">
        <label htmlFor="assistant-question" className="sr-only">
          Ask about longevity and preventive health
        </label>
        <input
          id="assistant-question"
          name="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          minLength={3}
          maxLength={1000}
          required
          disabled={busy}
          placeholder="e.g. What does current evidence say about time-restricted eating?"
          className="w-full rounded border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-60"
        />
        <Button type="submit" disabled={busy || question.trim().length < 3}>
          {busy ? "…" : "Ask"}
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-[color:var(--danger)]">
          {error}
        </p>
      )}

      {answer && (
        <div className="space-y-3 rounded border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={answer.demo ? "info" : answer.outcome === "ANSWERED" ? "success" : "warning"}>
              {answer.demo
                ? "Demo mode"
                : answer.outcome === "ANSWERED"
                  ? "Grounded in evidence"
                  : answer.outcome === "ESCALATED"
                    ? "Routed to clinical review"
                    : answer.outcome === "NO_EVIDENCE"
                      ? "No supporting evidence"
                      : "Not answered"}
            </Badge>
            <span className="text-xs text-fg-muted">Model: {answer.model}</span>
            {answer.rejectedCitations > 0 && (
              // Surfaced rather than hidden: a citation the model could not
              // support was discarded, and the reader deserves to know the
              // answer is thinner than the model first claimed.
              <span className="text-xs text-fg-muted">
                · {answer.rejectedCitations} unverified citation
                {answer.rejectedCitations === 1 ? "" : "s"} discarded
              </span>
            )}
          </div>
          <p className="whitespace-pre-wrap text-sm text-fg">{answer.answer}</p>
          {answer.citations.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                Sources ({answer.citations.length}) — each quote verified against the paper
              </h4>
              <ul className="space-y-3">
                {answer.citations.map((c, i) => (
                  <li key={i} className="rounded border border-border bg-surface-2 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">Grade {c.grade}</Badge>
                      {c.journal && <span className="text-xs text-fg-muted">{c.journal}</span>}
                    </div>
                    {c.url ? (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block text-accent underline-offset-2 hover:underline"
                      >
                        {c.title}
                      </a>
                    ) : (
                      <span className="mt-1 block">{c.title}</span>
                    )}
                    {/* The verified span. Shown because "trust us, it says so"
                        is not verification the reader can check themselves. */}
                    <blockquote className="mt-2 border-l-2 border-accent/40 pl-3 text-xs italic text-fg-muted">
                      &ldquo;{c.quote}&rdquo;
                    </blockquote>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {answer.notice && (
            <p className="text-xs text-fg-muted">{answer.notice}</p>
          )}
        </div>
      )}
    </div>
  );
}
