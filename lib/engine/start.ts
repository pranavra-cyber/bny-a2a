// Starts a run: one user request = one Run = one $0.20 budget.
import "server-only";
import { attachModel } from "../agents/shared";
import { getConfig, liveProblems, type AppConfig } from "../config";
import { Budget } from "../llm/budget";
import { MockClient, OpenAIClient, type ModelClient } from "../llm/client";
import { submitChat } from "./chat";
import { findRecording } from "./persist";
import { replayRun } from "./replay";
import { Run } from "./run";
import { runScenario } from "./scenario";
import { putRun } from "./store";
import type { ApprovalKind, RunMode, Scenario } from "./types";

export class StartError extends Error {}

export const SCENARIOS: Scenario[] = ["golden", "fp1", "fp2", "fp3", "fp4", "fp5", "fp6", "fp7", "fp8"];

/** Who decides each approval when nobody is at the keyboard (safety demo, recordings). */
export const DEFAULT_APPROVERS: Record<ApprovalKind, [string, string]> = {
  "bny-client-message": ["approved", "Daniel Kim"],
  "gs-redelivery": ["approved", "Michael Torres"],
  "bny-late-exception": ["approved", "Priya Sharma"],
};

export function modelContextFor(mode: "live" | "mock", cfg: AppConfig, budget: Budget, client?: ModelClient) {
  return {
    budget,
    client: client ?? (mode === "live" ? new OpenAIClient(cfg.apiKey!) : new MockClient()),
    model: cfg.model,
    prices: cfg.prices,
    reasoningEffort: cfg.reasoningEffort,
    defaultMaxOutputTokens: cfg.defaultMaxOutputTokens,
  };
}

export type StartOptions = {
  fast?: boolean;
  client?: ModelClient;
  /** Guided case: the user's opening request to the GS assistant. The run then waits at each checkpoint. */
  request?: string;
  /** Unattended run: approvals are decided by the default approvers. */
  autoApprove?: boolean;
};

export function startRun(scenario: Scenario, requestedMode?: RunMode, opts: StartOptions = {}): Run {
  const cfg = getConfig();
  const mode = requestedMode ?? cfg.mode;
  if (!SCENARIOS.includes(scenario)) throw new StartError(`Unknown scenario ${scenario}`);
  if (mode === "live") {
    const problems = liveProblems(cfg);
    if (problems.length) throw new StartError(`Live mode cannot start:\n${problems.join("\n")}`);
  }
  const guided = opts.request !== undefined;
  if (guided && scenario !== "golden") throw new StartError("The guided case runs the golden case only. Failure paths run from the safety tests.");
  if (guided && !opts.request!.trim()) throw new StartError("Type a request for the assistant.");
  const budget = new Budget(cfg.costLimitUsd, "run");
  const run = new Run(scenario, mode, cfg.model, budget);
  budget.label = `run ${run.id}`;
  run.fast = opts.fast ?? false;
  run.guided = guided;
  if (opts.autoApprove && !guided) run.autoApprove = DEFAULT_APPROVERS;

  if (mode === "replay") {
    // A guided replay needs a recording made since checkpoints existed.
    const rec = findRecording(scenario, guided ? (r) => r.events.some((e) => e.kind === "checkpoint") : undefined);
    if (!rec) throw new StartError(`No saved run for ${scenario} in runs/${guided ? " with guided checkpoints" : ""}. Record one with \`npm run record\` (mock or live), or switch to live mode.`);
    putRun(run);
    void replayRun(run, rec);
  } else {
    attachModel(run, modelContextFor(mode, cfg, budget, opts.client));
    putRun(run);
    void runScenario(run);
  }
  if (guided)
    void run
      .whenCheckpoint()
      .then(() => submitChat(run, "goldman", { text: opts.request }))
      .catch((e) => console.error(`[copilot] opening request: ${(e as Error).message}`));
  return run;
}
