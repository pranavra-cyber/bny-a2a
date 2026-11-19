import { describe, expect, it } from "vitest";
import { ChatError, submitChat } from "../lib/engine/chat";
import type { CheckpointId } from "../lib/engine/guide";
import { toRecording } from "../lib/engine/persist";
import { project } from "../lib/engine/project";
import { replayRun } from "../lib/engine/replay";
import { Run } from "../lib/engine/run";
import { startRun } from "../lib/engine/start";
import { Budget } from "../lib/llm/budget";
import { runToEnd } from "./helpers";

/** Resolves once the run waits at the given checkpoint (or for the given approval). */
function waitFor(run: Run, ready: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (ready()) {
        unsub();
        resolve();
      }
    };
    const unsub = run.subscribe(() => queueMicrotask(check));
    queueMicrotask(check);
  });
}
const atCheckpoint = (run: Run, id: CheckpointId) => waitFor(run, () => run.pendingCheckpoint?.def.id === id && !run.copilotWorking);
const atApproval = (run: Run, k: "bny-client-message" | "gs-redelivery") => waitFor(run, () => run.pendingApprovals.includes(k));

describe("guided case", () => {
  it("runs from Michael's request to settlement across three people, one checkpoint at a time", async () => {
    const run = startRun("golden", "mock", { fast: true, request: "Why did BNY reject our NVDA delivery?" });
    await atCheckpoint(run, "send");
    // Nothing has reached BNY before Michael sends.
    expect(project(run.summary(), run.events, "bny").events).toHaveLength(0);
    await submitChat(run, "goldman", { text: "send it" });
    await atCheckpoint(run, "investigate");
    // Not Michael's step: his choices are refused, but he can still ask his assistant a question.
    await expect(submitChat(run, "goldman", { action: "send" })).rejects.toBeInstanceOf(ChatError);
    const before = run.pendingCheckpoint?.def.id;
    await submitChat(run, "goldman", { text: "What happens if this misses the cutoff?" });
    expect(run.pendingCheckpoint?.def.id).toBe(before);
    expect(run.events.at(-1)?.chat?.role).toBe("assistant");
    expect(run.events.at(-1)?.desk).toBe("goldman");
    await submitChat(run, "bny", { text: "compare the details" });
    await atCheckpoint(run, "handover");
    await submitChat(run, "bny", { action: "handover" });
    await atCheckpoint(run, "contact");
    await expect(submitChat(run, "bny", { action: "draft" })).rejects.toBeInstanceOf(ChatError);
    await submitChat(run, "bny-cs", { action: "draft" });
    await atApproval(run, "bny-client-message");
    run.decide("bny-client-message", "approved", "Daniel Kim");
    // The client's fix time goes to Goldman on its own; Daniel is only told.
    await atCheckpoint(run, "hold");
    expect(run.events.some((e) => e.kind === "notification" && e.desk === "bny-cs" && e.title.startsWith("Sent to Goldman automatically"))).toBe(true);
    await submitChat(run, "goldman", { action: "hold" });
    await atApproval(run, "gs-redelivery");
    run.decide("gs-redelivery", "approved", "Michael Torres");
    await waitFor(run, () => run.status === "settled");

    // Each seat's chat stays with its own firm and desk.
    for (const e of run.events.filter((e) => e.kind === "chat" || e.kind === "checkpoint")) expect(e.audience).toEqual([e.lane]);
    const gsText = JSON.stringify(project(run.summary(), run.events, "goldman").events);
    expect(gsText).not.toContain("Settlement Fails Orchestrator");
    expect(gsText).not.toContain("Emily Carter");
    expect(run.audit.filter((a) => a.action.startsWith("chat:")).map((a) => a.action)).toEqual([
      "chat: request",
      "chat: send",
      "chat: investigate",
      "chat: handover",
      "chat: contact",
      "chat: hold",
    ]);
  });

  it("answers questions from the procedures without a model", async () => {
    const run = startRun("golden", "mock", { fast: true, request: "Why did BNY reject our NVDA delivery?" });
    await atCheckpoint(run, "send");
    await submitChat(run, "goldman", { text: "send" });
    await atCheckpoint(run, "investigate");
    await submitChat(run, "bny", { text: "What happens if this misses the cutoff?" });
    const answer = run.events.filter((e) => e.kind === "chat" && e.chat?.role === "assistant").at(-1)!.title;
    expect(answer).toContain("11:30 ET");
    expect(answer).toContain("14:45 ET");
    expect(answer).toContain("15:10 ET");
    expect(run.pendingCheckpoint?.def.id).toBe("investigate");
  });

  it("sends each person their Teams trigger, and each firm sees only its own", async () => {
    const run = await runToEnd("golden");
    const notes = run.events.filter((e) => e.kind === "notification");
    const teams = notes.filter((e) => e.notification!.channel === "teams").map((e) => e.notification!.seat);
    expect(teams.slice(0, 3)).toEqual(["goldman", "bny", "bny-cs"]);
    for (const e of notes) expect(e.audience).toEqual([e.notification!.seat === "goldman" ? "goldman" : "bny"]);
    expect(project(run.summary(), run.events, "goldman").events.filter((e) => e.kind === "notification").every((e) => e.notification!.seat === "goldman")).toBe(true);
  });

  it("reports whose turn it is without revealing the other firm's step", async () => {
    const run = startRun("golden", "mock", { fast: true, request: "chase our DK'd delivery" });
    await atCheckpoint(run, "send");
    await submitChat(run, "goldman", { text: "go ahead" });
    await atCheckpoint(run, "investigate");
    const gs = project(run.summary(), run.events, "goldman").summary;
    expect(gs.turn).toBe("bny");
    expect(gs.pendingCheckpoint).toBeUndefined();
    expect(gs.guideStage).toBe(0);
  });

  it("keeps waiting when the opening request is out of scope", async () => {
    const run = startRun("golden", "mock", { fast: true, request: "What's the weather in Pittsburgh?" });
    await waitFor(run, () => run.events.some((e) => e.kind === "chat" && e.chat?.role === "assistant"));
    expect(run.pendingCheckpoint?.def.id).toBe("request");
    expect(run.status).toBe("awaiting-input");
    await submitChat(run, "goldman", { text: "Find out why our NVDA delivery failed" });
    await atCheckpoint(run, "send");
  });

  it("escalates on Goldman's side only when the user declines to send", async () => {
    const run = startRun("golden", "mock", { fast: true, request: "chase our DK'd delivery" });
    await atCheckpoint(run, "send");
    await submitChat(run, "goldman", { text: "no, don't send it" });
    await waitFor(run, () => run.status === "escalated");
    expect(run.statusReason).toBe("rejected-by-human");
    expect(project(run.summary(), run.events, "bny").events).toHaveLength(0);
  });

  it("unguided runs record checkpoints that a guided replay waits on", async () => {
    const original = await runToEnd("golden");
    const cps = original.events.filter((e) => e.kind === "checkpoint").map((e) => e.checkpoint!.id);
    expect(cps).toEqual(["request", "send", "investigate", "handover", "contact", "hold"]);
    const replay = new Run("golden", "replay", "n/a", new Budget(0.2, "replay"));
    replay.fast = true;
    replay.guided = true;
    void replayRun(replay, toRecording(original));
    await atCheckpoint(replay, "request");
    await submitChat(replay, "goldman", { text: "check our open fails" });
    await atCheckpoint(replay, "send");
    expect(replay.budget.calls.length).toBeGreaterThan(0); // recorded calls, none made
  });
});
