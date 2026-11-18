import { describe, expect, it } from "vitest";
import { toRecording } from "../lib/engine/persist";
import { replayRun } from "../lib/engine/replay";
import { Run } from "../lib/engine/run";
import { Budget } from "../lib/llm/budget";
import { runToEnd } from "./helpers";

describe("replay", () => {
  it("reproduces a recorded run with no model calls", async () => {
    const original = await runToEnd("golden");
    const rec = toRecording(original);
    const replay = new Run("golden", "replay", "n/a", new Budget(0.2, "replay"));
    replay.fast = true;
    const unsub = replay.subscribe(() => queueMicrotask(() => replay.pendingApprovals.forEach((k) => replay.decide(k, "approved", "Presenter"))));
    await replayRun(replay, rec);
    unsub();
    expect(replay.status).toBe("settled");
    expect(replay.events.map((e) => e.title).filter((t) => !t.includes(" by "))).toEqual(original.events.map((e) => e.title).filter((t) => !t.includes(" by ")));
    expect(replay.budget.calls.length).toBe(original.budget.calls.length);
    expect(replay.clock.iso).toBe(original.clock.iso);
    expect(replay.audit.length).toBe(original.audit.length);
  });
});
