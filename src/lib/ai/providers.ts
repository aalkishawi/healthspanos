// Provider adapters. One shape in, one shape out, three vendors behind it.
//
// Called over plain HTTP rather than three SDKs on purpose: the request bodies
// are small and stable, and three heavyweight dependencies (each with its own
// release cadence and transitive tree) is a lot of surface to carry for what is
// one POST per provider. If streaming or tool-use is needed later, revisit.
//
// NOTHING HERE INVENTS A RESULT. Every failure path returns an error the caller
// must handle; there is no fallback string that could be mistaken for a real
// model answer. That is the rule CLAUDE.md sets and the bug this file replaces.
import { log } from "@/lib/logger";

export type Provider = "OpenAI" | "Anthropic" | "Google";

export type ChatRequest = {
  system: string;
  user: string;
  /** Hard ceiling on generated tokens — a cost guard, not a quality setting. */
  maxTokens?: number;
  /** 0 for the assistant: we want the grounded answer, not a creative one. */
  temperature?: number;
};

export type ChatResponse = {
  text: string;
  promptTokens: number;
  completionTokens: number;
  model: string;
  provider: Provider;
};

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly provider: Provider,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

const TIMEOUT_MS = 45_000;

async function post(url: string, headers: Record<string, string>, body: unknown, provider: Provider) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      // 429 and 5xx are worth retrying; 4xx generally means we sent something wrong.
      const retryable = res.status === 429 || res.status >= 500;
      throw new ProviderError(
        `${provider} returned ${res.status}: ${detail.slice(0, 300)}`,
        provider,
        res.status,
        retryable,
      );
    }
    return await res.json();
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new ProviderError(`${provider} timed out after ${TIMEOUT_MS / 1000}s`, provider, undefined, true);
    }
    throw new ProviderError(`${provider} request failed: ${String(err)}`, provider, undefined, true);
  } finally {
    clearTimeout(timer);
  }
}

// ── OpenAI ──────────────────────────────────────────────────────────────────

async function openaiChat(model: string, req: ChatRequest): Promise<ChatResponse> {
  const data = await post(
    "https://api.openai.com/v1/chat/completions",
    { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    {
      model,
      temperature: req.temperature ?? 0,
      max_tokens: req.maxTokens ?? 1200,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
      response_format: { type: "json_object" },
    },
    "OpenAI",
  );
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new ProviderError("OpenAI returned no content", "OpenAI");
  return {
    text,
    promptTokens: data?.usage?.prompt_tokens ?? 0,
    completionTokens: data?.usage?.completion_tokens ?? 0,
    model,
    provider: "OpenAI",
  };
}

// ── Anthropic ───────────────────────────────────────────────────────────────

async function anthropicChat(model: string, req: ChatRequest): Promise<ChatResponse> {
  const data = await post(
    "https://api.anthropic.com/v1/messages",
    {
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    {
      model,
      max_tokens: req.maxTokens ?? 1200,
      temperature: req.temperature ?? 0,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
    },
    "Anthropic",
  );
  const text = data?.content?.[0]?.text;
  if (typeof text !== "string") throw new ProviderError("Anthropic returned no content", "Anthropic");
  return {
    text,
    promptTokens: data?.usage?.input_tokens ?? 0,
    completionTokens: data?.usage?.output_tokens ?? 0,
    model,
    provider: "Anthropic",
  };
}

// ── Google ──────────────────────────────────────────────────────────────────

async function googleChat(model: string, req: ChatRequest): Promise<ChatResponse> {
  const data = await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {},
    {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: "user", parts: [{ text: req.user }] }],
      generationConfig: {
        temperature: req.temperature ?? 0,
        maxOutputTokens: req.maxTokens ?? 1200,
        responseMimeType: "application/json",
      },
    },
    "Google",
  );
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") throw new ProviderError("Google returned no content", "Google");
  return {
    text,
    promptTokens: data?.usageMetadata?.promptTokenCount ?? 0,
    completionTokens: data?.usageMetadata?.candidatesTokenCount ?? 0,
    model,
    provider: "Google",
  };
}

export async function chat(provider: Provider, model: string, req: ChatRequest): Promise<ChatResponse> {
  switch (provider) {
    case "OpenAI":
      return openaiChat(model, req);
    case "Anthropic":
      return anthropicChat(model, req);
    case "Google":
      return googleChat(model, req);
  }
}

// ── Embeddings ──────────────────────────────────────────────────────────────
// OpenAI-only, deliberately. The corpus embedding and the query embedding must
// come from the SAME model or the vectors are not comparable and retrieval
// silently degrades to noise. Pinning one provider makes that impossible to get
// wrong by configuration.

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMS = 1536; // must match vector(1536) in the schema

export function embeddingsConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function embed(texts: string[]): Promise<{ vectors: number[][]; tokens: number }> {
  if (!embeddingsConfigured()) {
    throw new ProviderError("OPENAI_API_KEY is required for embeddings", "OpenAI");
  }
  if (texts.length === 0) return { vectors: [], tokens: 0 };

  const data = await post(
    "https://api.openai.com/v1/embeddings",
    { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    { model: EMBEDDING_MODEL, input: texts },
    "OpenAI",
  );
  const vectors: number[][] = (data?.data ?? []).map((d: { embedding: number[] }) => d.embedding);
  if (vectors.length !== texts.length) {
    throw new ProviderError(
      `Embedding count mismatch: asked for ${texts.length}, got ${vectors.length}`,
      "OpenAI",
    );
  }
  for (const v of vectors) {
    if (v.length !== EMBEDDING_DIMS) {
      // A dimension change would corrupt the whole index silently.
      throw new ProviderError(
        `Embedding dimension ${v.length} does not match the schema's ${EMBEDDING_DIMS}`,
        "OpenAI",
      );
    }
  }
  log.debug("ai.embedded", { count: vectors.length });
  return { vectors, tokens: data?.usage?.total_tokens ?? 0 };
}
