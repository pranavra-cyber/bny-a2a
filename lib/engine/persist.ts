// Completed live/mock runs are saved to runs/*.json so replay mode can play them
// back on Demo Day with no API calls.
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Run } from "./run";
import type { AuditEntry, RunEvent, RunSummary, Scenario } from "./types";

export const RUNS_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "runs");

export type Recording = {
  version: 1;
  runId: string;
  scenario: Scenario;
  recordedMode: "live" | "mock";
  model: string;
  recordedAt: string;
  summary: RunSummary;
  events: RunEvent[];
  audit: AuditEntry[];
  toolCalls: number;
};

const FINAL = new Set(["settled", "settled-partial", "escalated", "rejected", "failed"]);

export function toRecording(run: Run): Recording {
  return {
    version: 1,
    runId: run.id,
    scenario: run.scenario,
    recordedMode: run.mode === "live" ? "live" : "mock",
    model: run.model,
    recordedAt: new Date().toISOString(),
    summary: run.summary(),
    events: run.events,
    audit: run.audit,
    toolCalls: run.toolCalls,
  };
}

export function persistRun(run: Run): string | null {
  if (run.mode === "replay" || !FINAL.has(run.status) || process.env.VITEST) return null;
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  const file = path.join(RUNS_DIR, `${run.scenario}-${run.mode}-${run.id}.json`);
  fs.writeFileSync(file, JSON.stringify(toRecording(run), null, 1));
  return file;
}

export function listRecordings(): Recording[] {
  if (!fs.existsSync(RUNS_DIR)) return [];
  return fs
    .readdirSync(RUNS_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("benchmark"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(RUNS_DIR, f), "utf8")) as Recording)
    .filter((r) => r.version === 1);
}

// A run that died on an agent error, the budget or a crash shows the guardrails, not the scenario.
const healthy = (r: Recording) => r.summary.status !== "failed" && !["agent-error", "budget"].includes(r.summary.statusReason ?? "");

/** Latest healthy recording for a scenario, preferring live recordings over mock ones. */
export function findRecording(scenario: Scenario, accept: (r: Recording) => boolean = () => true): Recording | null {
  const recs = listRecordings()
    .filter((r) => r.scenario === scenario && FINAL.has(r.summary.status) && healthy(r) && accept(r))
    .sort((a, b) => (a.recordedMode === b.recordedMode ? b.recordedAt.localeCompare(a.recordedAt) : a.recordedMode === "live" ? -1 : 1));
  return recs[0] ?? null;
}
