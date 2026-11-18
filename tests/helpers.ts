import { DEFAULT_APPROVERS, startRun } from "../lib/engine/start";
import type { Run } from "../lib/engine/run";
import type { ApprovalKind, Scenario } from "../lib/engine/types";
import type { ModelClient } from "../lib/llm/client";

const FINAL = new Set(["settled", "settled-partial", "escalated", "rejected", "failed"]);

/** Runs a scenario in mock mode with no latency, answering approvals automatically. */
export function runToEnd(scenario: Scenario, decisions: Partial<Record<ApprovalKind, string>> = {}, client?: ModelClient): Promise<Run> {
  const run = startRun(scenario, "mock", { fast: true, client });
  return new Promise((resolve) => {
    const check = () => {
      for (const k of run.pendingApprovals) run.decide(k, decisions[k] ?? "approved", DEFAULT_APPROVERS[k][1]);
      if (FINAL.has(run.status)) {
        unsub();
        resolve(run);
      }
    };
    const unsub = run.subscribe(() => queueMicrotask(check));
    queueMicrotask(check);
  });
}
