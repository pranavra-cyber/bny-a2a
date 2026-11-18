// The single entry point for every model call. Enforces the per-request budget
// before sending, always sets max_output_tokens, prices the actual usage after,
// and reports each call so it lands in the audit log and the cost meter.
import { z } from "zod";
import type { ModelPrices } from "../config";
import { Budget, BudgetExceededError, type CallRecord, costUsd } from "./budget";
import type { ModelClient } from "./client";
import { toStrictJsonSchema } from "./schema";

export type ModelContext = {
  budget: Budget;
  client: ModelClient;
  model: string;
  prices: ModelPrices | null;
  reasoningEffort: "none" | "minimal" | "low" | "medium" | "high" | null;
  defaultMaxOutputTokens: number;
  onCall?: (record: CallRecord) => void;
};

export type CallOptions<T extends z.ZodType> = {
  agent: string;
  firm: string;
  system: string;
  input: string;
  schemaName: string;
  schema: T;
  maxOutputTokens?: number;
};

export class AgentOutputError extends Error {
  constructor(
    public readonly agent: string,
    detail: string,
  ) {
    super(`${agent} returned an unusable decision: ${detail}`);
    this.name = "AgentOutputError";
  }
}

// Conservative: ~3 characters per token over-counts English and JSON, so the
// pre-call worst case is an upper bound rather than a guess.
const estimateInputTokens = (text: string) => Math.ceil(text.length / 3);

export async function callModel<T extends z.ZodType>(
  ctx: ModelContext,
  opts: CallOptions<T>,
): Promise<{ data: z.output<T>; record: CallRecord }> {
  const { budget } = ctx;
  const maxOutputTokens = opts.maxOutputTokens ?? ctx.defaultMaxOutputTokens;
  const jsonSchema = toStrictJsonSchema(opts.schema);

  const estIn = estimateInputTokens(opts.system + opts.input + JSON.stringify(jsonSchema));
  const worstCaseUsd = costUsd({ inputTokens: estIn, cachedInputTokens: 0, outputTokens: maxOutputTokens }, ctx.prices);
  if (budget.exhausted || budget.spentUsd + worstCaseUsd > budget.limitUsd) {
    const err = budget.exhaustedBy ?? new BudgetExceededError(opts.agent, budget.spentUsd, worstCaseUsd, budget.limitUsd);
    budget.exhausted = true;
    budget.exhaustedBy = err;
    console.warn(`[cost] ${budget.label}: refused ${opts.agent} call (${err.message})`);
    throw err;
  }

  const res = await ctx.client.create({
    model: ctx.model,
    system: opts.system,
    input: opts.input,
    schemaName: opts.schemaName,
    jsonSchema,
    maxOutputTokens,
    reasoningEffort: ctx.client.kind === "openai" ? ctx.reasoningEffort : null,
  });

  const cost = costUsd(res.usage, ctx.prices);
  budget.spentUsd += cost;
  const record: CallRecord = {
    n: budget.calls.length + 1,
    agent: opts.agent,
    firm: opts.firm,
    model: res.model,
    usage: res.usage,
    costUsd: cost,
    runningUsd: budget.spentUsd,
    worstCaseUsd,
    maxOutputTokens,
  };
  budget.calls.push(record);
  console.log(
    `[cost] ${budget.label} #${record.n} ${opts.agent}: ${res.usage.inputTokens} in (${res.usage.cachedInputTokens} cached) / ${res.usage.outputTokens} out${res.usage.reasoningTokens ? ` (${res.usage.reasoningTokens} reasoning)` : ""}, $${cost.toFixed(5)}, total $${budget.spentUsd.toFixed(4)} of $${budget.limitUsd.toFixed(2)}`,
  );
  ctx.onCall?.(record);

  if (!res.complete) throw new AgentOutputError(opts.agent, "response incomplete (hit max_output_tokens)");
  let json: unknown;
  try {
    json = JSON.parse(res.text);
  } catch {
    throw new AgentOutputError(opts.agent, "not valid JSON");
  }
  const parsed = opts.schema.safeParse(json);
  if (!parsed.success) throw new AgentOutputError(opts.agent, parsed.error.issues.map((i) => i.message).join("; "));
  return { data: parsed.data, record };
}
