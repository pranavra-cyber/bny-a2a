import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { approxTokens, MockClient, type ModelClient, type ModelRequest } from "../lib/llm/client";
import { runToEnd } from "./helpers";

class Counting implements ModelClient {
  readonly kind = "mock" as const;
  requests: ModelRequest[] = [];
  private inner = new MockClient();
  constructor(private heavy = false) {}
  async create(req: ModelRequest) {
    this.requests.push(req);
    const res = await this.inner.create(req);
    // Force high usage: every call uses its whole output allowance.
    return this.heavy ? { ...res, usage: { inputTokens: approxTokens(req.system + req.input), cachedInputTokens: 0, outputTokens: req.maxOutputTokens } } : res;
  }
}

describe("cost guardrail", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.MODEL_INPUT_USD_PER_1M = "10";
    process.env.MODEL_OUTPUT_USD_PER_1M = "40";
    process.env.COST_LIMIT_USD = "0.20";
    process.env.OPENAI_MODEL = "gpt-5-mini";
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("stops before exceeding $0.20, escalates with reason budget and makes no further calls", async () => {
    const client = new Counting(true);
    const run = await runToEnd("golden", {}, client);
    expect(run.status).toBe("escalated");
    expect(run.statusReason).toBe("budget");
    expect(run.budget.spentUsd).toBeLessThanOrEqual(0.2);
    expect(run.budget.exhausted).toBe(true);
    expect(client.requests.length).toBe(run.budget.calls.length);
    const esc = run.events.filter((e) => e.kind === "escalation");
    expect(esc.some((e) => e.escalation?.reason === "budget" && e.title.includes("ESCALATED (budget)"))).toBe(true);
    // Nothing was released or redelivered after the budget ran out.
    expect(run.events.some((e) => e.title.startsWith("Released"))).toBe(false);
  });

  it("every call sets max_output_tokens and is recorded in the audit log and cost events", async () => {
    const client = new Counting(false);
    const run = await runToEnd("golden", {}, client);
    expect(run.status).toBe("settled");
    expect(client.requests.length).toBe(9);
    expect(client.requests.every((r) => r.maxOutputTokens > 0 && r.maxOutputTokens <= 2000)).toBe(true);
    const audited = run.audit.filter((a) => a.action.startsWith("model call"));
    expect(audited).toHaveLength(9);
    expect(audited.every((a) => a.tokensIn! > 0 && a.costUsd! > 0 && a.runningCostUsd! > 0)).toBe(true);
    expect(run.events.filter((e) => e.kind === "model-call")).toHaveLength(9);
    expect(run.budget.spentUsd).toBeGreaterThan(0);
    expect(run.budget.spentUsd).toBeLessThan(0.2);
  });
});
