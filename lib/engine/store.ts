// Run state lives in memory on the server, keyed by runId (kept on globalThis so
// it survives dev hot reloads). Old runs are dropped so a long-running server
// doesn't keep every case it has ever started.
import "server-only";
import type { Run } from "./run";
import { FINAL } from "./status";

const g = globalThis as unknown as { __runs?: Map<string, Run> };
const runs = (g.__runs ??= new Map<string, Run>());

/** Finished runs kept beyond this many are dropped, oldest first. */
const KEEP = 30;
/** Hard ceiling: past this, even unfinished runs are dropped, oldest first (abandoned cases). */
const CEILING = 100;

function prune() {
  if (runs.size <= KEEP) return;
  // Map iterates in insertion order, so the first entries are the oldest.
  for (const [id, run] of runs) {
    if (runs.size <= KEEP) return;
    if (FINAL.has(run.status)) runs.delete(id);
  }
  for (const id of runs.keys()) {
    if (runs.size <= CEILING) return;
    runs.delete(id);
  }
}

export const putRun = (run: Run) => {
  runs.set(run.id, run);
  prune();
};
export const getRun = (id: string) => runs.get(id);
export const latestRun = () => [...runs.values()].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
export const allRuns = () => [...runs.values()];
