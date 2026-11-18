import "server-only";
import { getConfig, liveProblems } from "./config";
import { listRecordings } from "./engine/persist";
import type { RunMode, Scenario } from "./engine/types";

export type DemoConfig = { defaultMode: RunMode; model: string; limitUsd: number; liveProblems: string[]; recorded: Partial<Record<Scenario, "live" | "mock">> };

export function demoConfig(): DemoConfig {
  const cfg = getConfig();
  const recorded: DemoConfig["recorded"] = {};
  for (const r of listRecordings()) if (recorded[r.scenario] !== "live") recorded[r.scenario] = r.recordedMode;
  return { defaultMode: cfg.mode, model: cfg.model, limitUsd: cfg.costLimitUsd, liveProblems: liveProblems(cfg), recorded };
}
