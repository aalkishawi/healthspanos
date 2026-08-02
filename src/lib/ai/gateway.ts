// Configurable multi-model AI gateway (scaffold).
// The foundation registers the latest stable model families across providers and
// exposes a single structured-output entry point. Live calls activate when the
// matching provider key is present; otherwise the gateway returns a demo response
// so the product is fully navigable without keys.

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
  spec("gpt-5.4", "OpenAI", "Research assistant / synthesis", "OPENAI_API_KEY"),
  spec("claude-opus-4", "Anthropic", "Evidence review / safety reasoning", "ANTHROPIC_API_KEY"),
  spec("claude-sonnet-4", "Anthropic", "Coaching / plan generation", "ANTHROPIC_API_KEY"),
  spec("gemini-2.5-pro", "Google", "Multilingual / retrieval", "GEMINI_API_KEY"),
];

export interface AssistantAnswer {
  answer: string;
  citations: { title: string; url: string }[];
  model: string;
  demo: boolean;
}

/**
 * Structured, citation-backed answer. Foundation returns a demo answer unless a
 * provider is configured; the call site treats the shape as stable regardless.
 */
export async function askAssistant(question: string): Promise<AssistantAnswer> {
  const model = AI_MODELS.find((m) => m.configured);
  if (!model) {
    return {
      answer:
        "Demo mode: connect an AI provider key to enable live, retrieval-augmented answers. " +
        `Your question was: "${question}". Numik would return a graded, citation-backed, non-diagnostic response.`,
      citations: [],
      model: "demo",
      demo: true,
    };
  }
  // Live provider integration is intentionally deferred to the AI-services milestone.
  // Wiring point: dispatch to the provider SDK by model.provider here.
  return { answer: "Live model integration pending.", citations: [], model: model.id, demo: false };
}
