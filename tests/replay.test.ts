import { describe, expect, it } from "vitest";
import { submitChat } from "../lib/engine/chat";
import { findRecording, toRecording } from "../lib/engine/persist";
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

describe("replay of saved recordings", () => {
  it("passes the client's fix time to Goldman without stopping, and tells Daniel", async () => {
    const rec = findRecording("golden");
    expect(rec).not.toBeNull();
    const run = new Run("golden", "replay", "n/a", new Budget(0.2, "replay"));
    run.fast = true;
    run.guided = true;
    const stops: string[] = [];
    const unsub = run.subscribe(() =>
      queueMicrotask(() => {
        run.pendingApprovals.forEach((k) => run.decide(k, "approved", "Presenter"));
        const cp = run.pendingCheckpoint;
        if (cp && !stops.includes(cp.def.id)) {
          stops.push(cp.def.id);
          const primary = (cp.def.actions.find((a) => a.kind === "primary") ?? cp.def.actions[0]).id;
          void submitChat(run, cp.def.seat, { action: primary }).catch(() => {});
        }
      }),
    );
    await replayRun(run, rec!);
    unsub();
    expect(run.status).toBe("settled");
    // Steps that now run on their own never stop a replay of an older recording.
    for (const id of ["client-reply", "investigate", "handover", "contact", "hold"]) {
      expect(stops).not.toContain(id);
      expect(run.events.some((e) => e.kind === "checkpoint" && e.checkpoint?.id === id)).toBe(false);
    }
    expect(stops).toEqual(["request", "send"]);
    expect(run.events.some((e) => e.kind === "notification" && e.desk === "goldman" && e.title === "Holding our side while BNY's client re-instructs")).toBe(true);
    const notice = run.events.find((e) => e.kind === "notification" && e.desk === "bny-cs" && e.title.startsWith("Sent to Goldman automatically"));
    expect(notice?.title).toMatch(/fix expected by 11:15 ET$/);
  }, 20000);
});
