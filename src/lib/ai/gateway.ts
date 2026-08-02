// Configurable multi-model AI gateway.
//
// The model registry and the public `askAssistant` shape live here; the actual
// retrieval-augmented pipeline is in ./answer.ts. Keeping this entry point
// stable meant no call site changed when the live path landed.
import { answerQuestion, type AssistantResult } from "./answer";

export type Provider = "OpenAI" | "Anthropic" | "Google";

export interface ModelSpec {
  id: string;
  provider: Provider;
  role: string; // what the platform uses it for
  envKey: "OPENAI_API_KEY" | "ANTHROPIC_API_KEY" | "GEMINI_API_KEY";
  get configured(): boolean;
}

function spec(id: string, provider: Provider, role: string, envKey: ModelSpec["envKey"]): ModelSpec {
  return {
    id,
    provider,
    role,
    envKey,
    get configured() {
      return !!process.env[envKey];
    },
  };
}

export const AI_MODELS: ModelSpec[] = [
  spec("gpt-4o", "OpenAI", "Research assistant / synthesis", "OPENAI_API_KEY"),
  spec("claude-opus-4", "Anthropic", "Evidence review / safety reasoning", "ANTHROPIC_API_KEY"),
  spec("claude-sonnet-4", "Anthropic", "Coaching / plan generation", "ANTHROPIC_API_KEY"),
  spec("gemini-2.5-pro", "Google", "Multilingual / retrieval", "GEMINI_API_KEY"),
];

export interface AssistantAnswer {
  answer: string;
  citations: { title: string; url: string | null; journal: string | null; grade: string; quote: string }[];
  model: string;
  demo: boolean;
  outcome: string;
  /** Citations the model produced that failed verification and were dropped. */
  rejectedCitations: number;
  notice?: string;
}

/**
 * Grounded, citation-backed, non-diagnostic answer.
 *
 * `demo` is now honest in every branch. The previous implementation returned
 * `demo: false` alongside the placeholder "Live model integration pending." —
 * so the moment a provider key was set, the UI would have dropped the demo
 * badge and presented a stub as a real, citation-backed health answer. Nothing
 * here reports a live answer it did not produce.
 *
 * The pipeline itself (safety → budget → retrieve → generate → verify) lives in
 * ./answer.ts; this stays the stable entry point.
 */
export async function askAssistant(
  question: string,
  ctx: { tenantId: string; userId: string },
): Promise<AssistantAnswer> {
  const result: AssistantResult = await answerQuestion({
    question,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
  });

  return {
    answer: result.answer,
    citations: result.citations.map((c) => ({
      title: c.title,
      url: c.url,
      journal: c.journal,
      grade: c.grade,
      quote: c.quote,
    })),
    model: result.model,
    demo: result.demo,
    outcome: result.outcome,
    rejectedCitations: result.rejectedCitations,
    notice: result.notice,
  };
}
