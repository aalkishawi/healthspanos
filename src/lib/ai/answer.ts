// Retrieval-augmented answering: safety → budget → retrieve → generate →
// verify → persist.
//
// The order is the design. Safety runs before any spend; retrieval runs before
// generation so the model can only speak from what we handed it; verification
// runs after generation because a model's own claim that it cited correctly is
// worth nothing.
//
// The system never invents. If the corpus has nothing relevant, the answer is
// "we don't have evidence for that" — which is a real answer, and far better
// than a fluent guess about someone's health.
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { chat, ProviderError, type Provider } from "./providers";
import { classify, NON_DIAGNOSTIC_FOOTER, outputLooksPrescriptive } from "./safety";
import { verifyCitations, stripRejectedMarkers, type ModelCitation, type VerifiedCitation } from "./verify";
import { corpusReady, retrieve } from "@/lib/evidence/retrieval";
import { checkBudget, recordUsage } from "./usage";

export type AnswerOutcome = "ANSWERED" | "NO_EVIDENCE" | "ESCALATED" | "BLOCKED";

export type AssistantResult = {
  answer: string;
  citations: VerifiedCitation[];
  outcome: AnswerOutcome;
  model: string;
  demo: boolean;
  /** How many citations the model produced that failed verification. */
  rejectedCitations: number;
  notice?: string;
};

const SYSTEM = `You are the Numik HealthspanOS research assistant.

You answer general questions about longevity, preventive health and healthy ageing, using ONLY the numbered research excerpts provided in the user message.

Hard rules:
- Use ONLY the provided excerpts. If they do not support an answer, say so plainly. Never use knowledge from outside them.
- Never give individual medical advice, diagnose, interpret someone's symptoms or test results, or recommend starting, stopping or changing any medication or dose.
- Speak in general terms about what the research shows, not about what the reader personally should do.
- Cite with the exact marker of the excerpt you used, e.g. [E1]. Place it directly after the claim it supports.
- Every citation MUST be accompanied by a verbatim quote copied EXACTLY from that excerpt. Do not paraphrase the quote — it is checked character by character against the source, and a citation whose quote does not appear will be discarded.
- Be concise: at most 200 words.

Respond with JSON only, in exactly this shape:
{"answer": "prose with [E1] style markers", "citations": [{"marker": "E1", "quote": "exact sentence copied from excerpt E1"}], "sufficient": true}

Set "sufficient" to false when the excerpts do not let you answer the question properly.`;

function buildUserPrompt(question: string, sources: { marker: string; title: string; journal: string | null; abstract: string }[]): string {
  const excerpts = sources
    .map((s) => `[${s.marker}] ${s.title}${s.journal ? ` (${s.journal})` : ""}\n${s.abstract}`)
    .join("\n\n");
  return `QUESTION: ${question}\n\nRESEARCH EXCERPTS:\n\n${excerpts}`;
}

/** Model preference, first configured wins. */
function pickModel(): { provider: Provider; model: string } | null {
  if (process.env.ANTHROPIC_API_KEY) return { provider: "Anthropic", model: "claude-sonnet-4" };
  if (process.env.OPENAI_API_KEY) return { provider: "OpenAI", model: "gpt-4o" };
  if (process.env.GEMINI_API_KEY) return { provider: "Google", model: "gemini-2.5-pro" };
  return null;
}

function parseModelJson(text: string): { answer: string; citations: ModelCitation[]; sufficient: boolean } | null {
  try {
    // Models occasionally wrap JSON in a fenced block despite json mode.
    const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const o = JSON.parse(cleaned);
    if (typeof o?.answer !== "string") return null;
    const citations = Array.isArray(o.citations)
      ? o.citations
          .filter((c: unknown) => typeof (c as ModelCitation)?.marker === "string" && typeof (c as ModelCitation)?.quote === "string")
          .map((c: ModelCitation) => ({ marker: c.marker, quote: c.quote }))
      : [];
    return { answer: o.answer, citations, sufficient: o.sufficient !== false };
  } catch {
    return null;
  }
}

export async function answerQuestion(input: {
  question: string;
  tenantId: string;
  userId: string;
}): Promise<AssistantResult> {
  const { question, tenantId, userId } = input;

  // 1. Safety, before anything is spent.
  const verdict = classify(question);
  if (verdict.action !== "answer") {
    const outcome: AnswerOutcome = verdict.action === "escalate" ? "ESCALATED" : "BLOCKED";
    await persist({ tenantId, userId, question, outcome, answer: verdict.message, citedIds: [], rejected: 0, model: null });
    log.info("assistant.gated", { outcome, reason: verdict.reason, userId });
    return {
      answer: verdict.message,
      citations: [],
      outcome,
      model: "safety-guard",
      demo: false,
      rejectedCitations: 0,
      notice: outcome === "ESCALATED" ? "Routed to clinical review." : undefined,
    };
  }

  // 2. Is a live path even available? Honest about which piece is missing.
  const picked = pickModel();
  if (!picked) return demoResult(question, "No AI provider key is configured.");

  const corpus = await corpusReady();
  if (!corpus.ready) {
    return demoResult(question, "The evidence corpus has not been ingested yet, so there is nothing to ground an answer in.");
  }

  // 3. Budget.
  const budget = await checkBudget(tenantId);
  if (!budget.withinBudget) {
    log.warn("assistant.budget_exhausted", { tenantId, spentUsd: budget.spentUsd });
    return {
      answer: `This workspace has reached its monthly AI usage limit of $${budget.budgetUsd.toFixed(2)}. It resets at the start of next month.`,
      citations: [], outcome: "BLOCKED", model: "budget-guard", demo: false, rejectedCitations: 0,
    };
  }

  // 4. Retrieve.
  const found = await retrieve(question, 6);
  if (found.length === 0) {
    await persist({ tenantId, userId, question, outcome: "NO_EVIDENCE", answer: null, citedIds: [], rejected: 0, model: null });
    return {
      answer:
        "I could not find anything in our reviewed evidence base that speaks to that question, so I am not going to guess. " +
        NON_DIAGNOSTIC_FOOTER,
      citations: [], outcome: "NO_EVIDENCE", model: picked.model, demo: false, rejectedCitations: 0,
    };
  }

  const sources = found.map((f, i) => ({ ...f, marker: `E${i + 1}` }));
  const sourceMap = new Map(sources.map((s) => [s.marker, s]));

  // 5. Generate.
  let raw;
  try {
    raw = await chat(picked.provider, picked.model, {
      system: SYSTEM,
      user: buildUserPrompt(question, sources),
      temperature: 0,
      maxTokens: 900,
    });
  } catch (err) {
    log.error("assistant.provider_failed", err, { provider: picked.provider });
    const retryable = err instanceof ProviderError && err.retryable;
    return {
      answer: retryable
        ? "The assistant is temporarily unavailable. Please try again in a moment."
        : "The assistant could not answer that right now.",
      citations: [], outcome: "BLOCKED", model: picked.model, demo: false, rejectedCitations: 0,
    };
  }

  await recordUsage({
    tenantId, userId, provider: picked.provider, model: picked.model,
    purpose: "answer", promptTokens: raw.promptTokens, completionTokens: raw.completionTokens,
  });

  const parsed = parseModelJson(raw.text);
  if (!parsed) {
    log.error("assistant.unparseable_response", new Error("model did not return valid JSON"), { model: picked.model });
    return {
      answer: "The assistant returned a malformed response. Please try again.",
      citations: [], outcome: "BLOCKED", model: picked.model, demo: false, rejectedCitations: 0,
    };
  }

  // 6. Verify citations against what the model was actually shown.
  const { verified, rejected } = verifyCitations(parsed.citations, sourceMap);

  // A grounded answer with nothing verifiable behind it is exactly the failure
  // mode this phase exists to prevent — withhold rather than present it.
  if (!parsed.sufficient || verified.length === 0) {
    await persist({ tenantId, userId, question, outcome: "NO_EVIDENCE", answer: null, citedIds: [], rejected: rejected.length, model: picked.model });
    if (rejected.length > 0) {
      log.warn("assistant.all_citations_rejected", { rejected: rejected.length, model: picked.model });
    }
    return {
      answer:
        "I could not support an answer to that from our evidence base without overstating what the research shows. " +
        NON_DIAGNOSTIC_FOOTER,
      citations: [], outcome: "NO_EVIDENCE", model: picked.model, demo: false, rejectedCitations: rejected.length,
    };
  }

  // 7. Output guardrail — the prompt is a request, not a guarantee.
  if (outputLooksPrescriptive(parsed.answer)) {
    log.warn("assistant.prescriptive_output_withheld", { model: picked.model, userId });
    await persist({ tenantId, userId, question, outcome: "ESCALATED", answer: null, citedIds: [], rejected: rejected.length, model: picked.model });
    return {
      answer:
        "That question needs a clinician rather than a research summary. It has been routed to our clinical review team.",
      citations: [], outcome: "ESCALATED", model: picked.model, demo: false, rejectedCitations: rejected.length,
      notice: "Routed to clinical review.",
    };
  }

  const keep = new Set(
    verified.map((v) => sources.find((s) => s.id === v.evidenceId)!.marker.toUpperCase()),
  );
  const answer = `${stripRejectedMarkers(parsed.answer, keep)}\n\n${NON_DIAGNOSTIC_FOOTER}`;

  await persist({
    tenantId, userId, question, outcome: "ANSWERED", answer,
    citedIds: verified.map((v) => v.evidenceId), rejected: rejected.length, model: picked.model,
  });

  if (rejected.length > 0) {
    log.warn("assistant.citations_rejected", { rejected: rejected.length, kept: verified.length, model: picked.model });
  }

  return {
    answer,
    citations: verified,
    outcome: "ANSWERED",
    model: picked.model,
    demo: false,
    rejectedCitations: rejected.length,
  };
}

function demoResult(question: string, why: string): AssistantResult {
  return {
    // demo: TRUE. The bug this replaces returned demo:false alongside a
    // placeholder, which would have let the UI drop the badge and present a
    // stub as a real citation-backed health answer.
    demo: true,
    answer:
      `Demo mode — no live answer was generated. ${why} ` +
      `Your question was: "${question}". With a provider key and an ingested corpus, Numik returns a ` +
      `grounded, citation-backed, non-diagnostic response.`,
    citations: [],
    outcome: "NO_EVIDENCE",
    model: "demo",
    rejectedCitations: 0,
    notice: why,
  };
}

async function persist(a: {
  tenantId: string; userId: string; question: string;
  outcome: AnswerOutcome; answer: string | null; citedIds: string[]; rejected: number; model: string | null;
}): Promise<void> {
  try {
    await prisma.assistantQuery.create({
      data: {
        tenantId: a.tenantId, userId: a.userId, question: a.question,
        outcome: a.outcome, answer: a.answer, citedIds: a.citedIds,
        rejectedCitations: a.rejected, model: a.model,
      },
    });
  } catch (err) {
    // The audit trail failing must not cost the member their answer.
    log.error("assistant.audit_write_failed", err, { outcome: a.outcome });
  }
}
