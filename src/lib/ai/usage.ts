// Per-tenant model usage: recording it, and capping it.
//
// Two jobs. Recording feeds cost visibility now and billing in Phase 5.
// Capping is the guard against one tenant — or one loop, or one abusive user —
// running up an unbounded provider bill. The per-request rate limit in
// src/lib/ratelimit.ts bounds frequency; this bounds spend.
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import type { Provider } from "./providers";

// USD per 1M tokens. Estimates for cost VISIBILITY, not billing accuracy —
// provider pricing moves and we do not reconcile against invoices. Anything
// unknown falls back to a deliberately pessimistic rate so an unpriced model
// shows up as expensive rather than free.
const PRICES: Record<string, { in: number; out: number }> = {
  "gpt-5.4": { in: 2.5, out: 10 },
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "claude-opus-4": { in: 15, out: 75 },
  "claude-sonnet-4": { in: 3, out: 15 },
  "gemini-2.5-pro": { in: 1.25, out: 5 },
  "text-embedding-3-small": { in: 0.02, out: 0 },
};
const FALLBACK = { in: 10, out: 30 };

export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const p = PRICES[model] ?? FALLBACK;
  return (promptTokens / 1_000_000) * p.in + (completionTokens / 1_000_000) * p.out;
}

export async function recordUsage(input: {
  tenantId: string;
  userId?: string | null;
  provider: Provider | "OpenAI";
  model: string;
  purpose: "answer" | "embedding" | "verification";
  promptTokens: number;
  completionTokens: number;
}): Promise<void> {
  const estimatedCostUsd = estimateCost(input.model, input.promptTokens, input.completionTokens);
  try {
    await prisma.aiUsage.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        provider: input.provider,
        model: input.model,
        purpose: input.purpose,
        promptTokens: input.promptTokens,
        completionTokens: input.completionTokens,
        estimatedCostUsd,
      },
    });
  } catch (err) {
    // Metering must never fail a request the member already paid for in
    // latency. Losing a usage row costs reporting accuracy; failing the
    // response costs the member their answer.
    log.error("usage.record_failed", err, { tenantId: input.tenantId, model: input.model });
  }
}

/** Default monthly ceiling per tenant, overridable per deployment. */
export const MONTHLY_BUDGET_USD = Number(process.env.AI_TENANT_MONTHLY_BUDGET_USD ?? 25);

export type BudgetState = {
  withinBudget: boolean;
  spentUsd: number;
  budgetUsd: number;
  calls: number;
};

/** Spend for the current calendar month. */
export async function monthlyUsage(tenantId: string): Promise<BudgetState> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  const agg = await prisma.aiUsage.aggregate({
    where: { tenantId, createdAt: { gte: start } },
    _sum: { estimatedCostUsd: true },
    _count: true,
  });
  const spentUsd = agg._sum.estimatedCostUsd ?? 0;
  return {
    withinBudget: spentUsd < MONTHLY_BUDGET_USD,
    spentUsd,
    budgetUsd: MONTHLY_BUDGET_USD,
    calls: agg._count,
  };
}

/**
 * Gate a model call on remaining budget.
 *
 * FAILS OPEN on a database error, matching the rate limiter: an outage in the
 * accounting layer must not take the product down. The rate limit still bounds
 * how fast anyone can spend while metering is blind.
 */
export async function checkBudget(tenantId: string): Promise<BudgetState> {
  try {
    return await monthlyUsage(tenantId);
  } catch (err) {
    log.error("usage.budget_check_failed", err, { tenantId });
    return { withinBudget: true, spentUsd: 0, budgetUsd: MONTHLY_BUDGET_USD, calls: 0 };
  }
}
