// Replay mode: plays a saved run with no model calls. Approval cards still wait
// for a click so the presenter drives the demo; the recorded cost is shown as-is.
import "server-only";
import { checkpoint } from "./chat";
import type { Recording } from "./persist";
import type { Run } from "./run";

const isApproval = (action: string) => action.startsWith("review ");

export async function replayRun(run: Run, rec: Recording): Promise<void> {
  run.recordedMode = rec.recordedMode;
  run.recordedModel = rec.model;
  run.toolCalls = 0;
  let auditIdx = 0;
  let prevWall = 0;
  let lastBy = "";

  const flushAudit = (emitted: number) => {
    while (auditIdx < rec.audit.length && rec.audit[auditIdx].afterSeq <= emitted) {
      const entry = { ...rec.audit[auditIdx++] };
      if (entry.action.startsWith("chat:")) continue; // the user's own chat is live, not replayed
      if (isApproval(entry.action) && lastBy) entry.approver = lastBy;
      if (entry.action.startsWith("tool ")) run.toolCalls++;
      run.log({ ...entry, at: entry.at });
    }
  };

  for (const ev of rec.events) {
    if (!run.fast) await new Promise((r) => setTimeout(r, Math.min(1200, Math.max(250, ev.wallMs - prevWall))));
    prevWall = ev.wallMs;
    run.clock.set(ev.at);
    run.turns = Math.max(run.turns, ev.kind === "gateway" ? run.turns + 1 : run.turns);

    if (ev.kind === "approval") continue; // re-emitted below with the actual approver
    if (ev.kind === "chat" || ev.modelCall?.agent.includes("Copilot")) continue; // chat happens live
    if (ev.kind === "checkpoint" && ev.checkpoint) {
      const primary = (ev.checkpoint.actions.find((a) => a.kind === "primary") ?? ev.checkpoint.actions[0]).id;
      const action = await checkpoint(run, ev.checkpoint);
      flushAudit(ev.seq);
      if (action !== primary) {
        run.emit({ kind: "status", lane: "network", audience: [], actor: ev.actor, title: "Replay stopped", detail: `The recording continued with "${primary}". Switch to live or mock mode to explore other choices.` });
        run.setStatus("escalated", "replay diverged from recording");
        return;
      }
      continue;
    }
    if (ev.modelCall) {
      const m = ev.modelCall;
      run.budget.calls.push({
        n: run.budget.calls.length + 1,
        agent: m.agent,
        firm: ev.actor.firm,
        model: m.model,
        usage: { inputTokens: m.tokensIn, cachedInputTokens: 0, outputTokens: m.tokensOut },
        costUsd: m.costUsd,
        runningUsd: m.runningUsd,
        worstCaseUsd: 0,
        maxOutputTokens: 0,
      });
      run.budget.spentUsd = m.runningUsd;
    }
    const { seq: _seq, wallMs: _wall, ...rest } = ev;
    void _seq;
    void _wall;
    run.emit(rest);
    flushAudit(ev.seq);

    if (ev.kind === "approval-request" && ev.approval) {
      const recorded = rec.events.find((e) => e.kind === "approval" && e.decision?.kind === ev.approval!.kind);
      const d = await run.awaitApproval(ev.approval.kind);
      lastBy = d.by;
      run.emit({
        kind: "approval",
        lane: ev.lane,
        audience: ev.audience,
        actor: { ...ev.actor, name: d.by },
        desk: ev.desk,
        title: `${ev.title}: ${d.outcome} by ${d.by}`,
        decision: { kind: ev.approval.kind, outcome: d.outcome, by: d.by },
      });
      if (recorded && recorded.decision?.outcome !== d.outcome) {
        run.emit({ kind: "status", lane: "network", audience: [], actor: ev.actor, title: "Replay stopped", detail: `The recording continued with "${recorded.decision?.outcome}". Switch to live or mock mode to explore "${d.outcome}".` });
        run.setStatus("escalated", "replay diverged from recording");
        return;
      }
    }
  }
  flushAudit(Number.MAX_SAFE_INTEGER);
  run.clock.set(rec.summary.clock);
  run.negotiationMinutes = rec.summary.negotiationMinutes;
  run.setStatus(rec.summary.status, rec.summary.statusReason);
}
