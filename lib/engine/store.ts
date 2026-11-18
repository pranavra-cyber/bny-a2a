// Run state lives in memory on the server, keyed by runId (kept on globalThis so
// it survives dev hot reloads).
import "server-only";
import type { Run } from "./run";

const g = globalThis as unknown as { __runs?: Map<string, Run> };
const runs = (g.__runs ??= new Map<string, Run>());

export const putRun = (run: Run) => void runs.set(run.id, run);
export const getRun = (id: string) => runs.get(id);
export const latestRun = () => [...runs.values()].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
export const allRuns = () => [...runs.values()];
