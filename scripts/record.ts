// npm run record [-- --live] [-- golden fp2 ...]
// Runs scenarios headlessly with auto-approvals and saves them to runs/ for replay.
// Default is mock mode (no API calls). Use --live to record real model runs.
import { loadEnvConfig } from "@next/env";
import { runBenchmark } from "../lib/engine/benchmark";
import { DEFAULT_APPROVERS, startRun, SCENARIOS } from "../lib/engine/start";
import type { Scenario } from "../lib/engine/types";

loadEnvConfig(process.cwd()); // same .env.local the app uses

const args = process.argv.slice(2);
const mode = args.includes("--live") ? "live" : "mock";
const only = args.filter((a) => !a.startsWith("--")) as Scenario[];
const scenarios = only.length ? only : SCENARIOS;
const FINAL = new Set(["settled", "settled-partial", "escalated", "rejected", "failed"]);

async function record(s: Scenario) {
  const run = startRun(s, mode);
  await new Promise<void>((resolve) => {
    const check = () => {
      for (const k of run.pendingApprovals) setTimeout(() => run.decide(k, ...DEFAULT_APPROVERS[k]), 600);
      if (FINAL.has(run.status)) resolve();
    };
    run.subscribe(() => queueMicrotask(check));
  });
  console.log(`${s}: ${run.status}${run.statusReason ? ` (${run.statusReason})` : ""} · ${run.budget.summaryLine()}`);
}

(async () => {
  for (const s of scenarios) await record(s);
  if (!only.length || only.includes("golden")) {
    const b = await runBenchmark(mode);
    console.log(`benchmark (${mode}): ${b.rows.map((r) => `${r.label} ${r.metrics.minutesToResolution.value}m`).join(" · ")}`);
  }
})();
