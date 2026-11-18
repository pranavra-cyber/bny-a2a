// Per-request cost budget. One Budget is shared by everything a single user
// action causes (all agents, turns and retries).
import type { ModelPrices } from "../config";

export type Usage = { inputTokens: number; cachedInputTokens: number; outputTokens: number; reasoningTokens?: number };

export type CallRecord = {
  n: number;
  agent: string;
  firm: string;
  model: string;
  usage: Usage;
  costUsd: number;
  runningUsd: number;
  worstCaseUsd: number;
  maxOutputTokens: number;
};

export class BudgetExceededError extends Error {
  constructor(
    public readonly agent: string,
    public readonly spentUsd: number,
    public readonly worstCaseUsd: number,
    public readonly limitUsd: number,
  ) {
    super(
      `Budget exhausted: ${agent} needs up to $${worstCaseUsd.toFixed(4)} but only $${Math.max(0, limitUsd - spentUsd).toFixed(4)} of $${limitUsd.toFixed(2)} remains.`,
    );
    this.name = "BudgetExceededError";
  }
}

export function costUsd(usage: Usage, prices: ModelPrices | null): number {
  if (!prices) return 0;
  const uncached = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  const cachedRate = prices.cachedInputPer1M ?? prices.inputPer1M;
  return (uncached * prices.inputPer1M + usage.cachedInputTokens * cachedRate + usage.outputTokens * prices.outputPer1M) / 1e6;
}

export class Budget {
  spentUsd = 0;
  calls: CallRecord[] = [];
  exhausted = false;
  exhaustedBy: BudgetExceededError | null = null;

  constructor(
    public readonly limitUsd: number,
    public label: string,
  ) {}

  get tokensIn() {
    return this.calls.reduce((s, c) => s + c.usage.inputTokens, 0);
  }
  get tokensOut() {
    return this.calls.reduce((s, c) => s + c.usage.outputTokens, 0);
  }
  get remainingUsd() {
    return Math.max(0, this.limitUsd - this.spentUsd);
  }

  snapshot(): BudgetSnapshot {
    return {
      limitUsd: this.limitUsd,
      spentUsd: this.spentUsd,
      tokensIn: this.tokensIn,
      tokensOut: this.tokensOut,
      calls: this.calls.length,
      exhausted: this.exhausted,
    };
  }

  summaryLine(): string {
    return `[cost] ${this.label}: ${this.calls.length} calls, ${this.tokensIn.toLocaleString("en-US")} in / ${this.tokensOut.toLocaleString("en-US")} out tokens, $${this.spentUsd.toFixed(4)} of $${this.limitUsd.toFixed(2)}`;
  }
}

export type BudgetSnapshot = {
  limitUsd: number;
  spentUsd: number;
  tokensIn: number;
  tokensOut: number;
  calls: number;
  exhausted: boolean;
};
