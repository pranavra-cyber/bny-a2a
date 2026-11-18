// Server-side configuration from .env.local. Prices are never hard-coded: they
// must be set for the configured OPENAI_MODEL before live mode will start.
import "server-only";
import fs from "node:fs";
import path from "node:path";

export type DemoMode = "live" | "replay" | "mock";

export type ModelPrices = { inputPer1M: number; outputPer1M: number; cachedInputPer1M: number | null };

export type AppConfig = {
  mode: DemoMode;
  model: string;
  apiKey: string | null;
  costLimitUsd: number;
  prices: ModelPrices | null;
  reasoningEffort: "none" | "minimal" | "low" | "medium" | "high" | null;
  defaultMaxOutputTokens: number;
};

export const DEFAULT_MODEL = "gpt-6.1-terra";

function num(name: string): number | null {
  const v = process.env[name]?.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function getConfig(): AppConfig {
  const rawMode = process.env.DEMO_MODE?.trim() || "replay";
  const mode: DemoMode = rawMode === "live" || rawMode === "mock" ? rawMode : "replay";
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const input = num("MODEL_INPUT_USD_PER_1M");
  const output = num("MODEL_OUTPUT_USD_PER_1M");
  const effortEnv = process.env.OPENAI_REASONING_EFFORT?.trim();
  // Reasoning models spend output tokens on reasoning; keep it low unless configured.
  const isReasoningModel = /^(gpt-[5-9]|o\d)/.test(model);
  const reasoningEffort = (effortEnv === "" || effortEnv === undefined
    ? isReasoningModel
      ? "low"
      : null
    : effortEnv === "off"
      ? null
      : effortEnv) as AppConfig["reasoningEffort"];
  return {
    mode,
    model,
    apiKey: process.env.OPENAI_API_KEY?.trim() || null,
    costLimitUsd: num("COST_LIMIT_USD") ?? 0.2,
    prices:
      input !== null && output !== null
        ? { inputPer1M: input, outputPer1M: output, cachedInputPer1M: num("MODEL_CACHED_INPUT_USD_PER_1M") }
        : null,
    reasoningEffort,
    defaultMaxOutputTokens: num("MODEL_MAX_OUTPUT_TOKENS") ?? (isReasoningModel ? 2000 : 600),
  };
}

/** Reasons a live request cannot start. Empty when live mode is usable. */
export function liveProblems(cfg = getConfig()): string[] {
  const problems: string[] = [];
  if (!cfg.apiKey) problems.push("OPENAI_API_KEY is not set in .env.local.");
  if (!cfg.prices)
    problems.push(
      `MODEL_INPUT_USD_PER_1M and MODEL_OUTPUT_USD_PER_1M must be set in .env.local to the current prices for ${cfg.model}.`,
    );
  return problems;
}

/** Problems that stop the app from running at all (shown as a setup screen). */
export function setupProblems(): string[] {
  const problems: string[] = [];
  if (!fs.existsSync(path.join(/*turbopackIgnore: true*/ process.cwd(), ".env.local")))
    problems.push("`.env.local` is missing. Copy `.env.example` to `.env.local` (DEMO_MODE=replay works without a key).");
  return problems;
}
