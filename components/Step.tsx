"use client";
import { useState } from "react";
import type { ApprovalKind, RunEvent, View } from "@/lib/engine/types";
import { fmtEt, fmtUtc } from "@/lib/time";
import { decide } from "./useRun";
import { Checks, Expandable, Json, Pill, RecordChips, SharedBlock, TypeBadge, useConfirm } from "./ui";

export function Step({ e, view, compact = false }: { e: RunEvent; view: View; compact?: boolean }) {
  const tz = view === "goldman" ? fmtUtc : fmtEt;
  const injection = e.flags?.some((f) => f.startsWith("injection"));
  const blocked = e.flags?.includes("injection-blocked") || e.flags?.includes("blocked");
  const tone = e.kind === "escalation" ? "border-l-bad bg-bad-soft/50" : blocked ? "border-l-bad bg-white" : injection ? "border-l-warn bg-white" : "border-l-line bg-white";
  if (e.kind === "model-call" && e.modelCall)
    return (
      <div className="tabular flex items-center gap-2 px-1 text-[11px] text-muted">
        <span>{tz(e.at)}</span>
        <span>
          model call · {e.modelCall.agent} · {e.modelCall.tokensIn.toLocaleString("en-US")} in / {e.modelCall.tokensOut.toLocaleString("en-US")} out · ${e.modelCall.costUsd.toFixed(5)}
        </span>
      </div>
    );
  return (
    <article className={`rounded-md border border-l-4 border-line px-3 py-2.5 ${tone}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span className="tabular">{tz(e.at)}</span>
        <span aria-hidden>·</span>
        <span className="font-medium text-ink">{e.actor.name}</span>
        <TypeBadge type={e.actor.type} />
        {e.flags?.filter((f) => f.startsWith("scenario")).map((f) => <Pill key={f} tone="warn">{f.replace("scenario: ", "")}</Pill>)}
        {injection && <Pill tone="warn">injection flagged</Pill>}
        {blocked && <Pill tone="bad">blocked</Pill>}
        {e.flags?.includes("manual") && <Pill>manual · Teams / email</Pill>}
      </div>
      <h3 className="mt-1 text-sm font-semibold text-navy">{e.title}</h3>
      {e.detail && !compact && <p className="mt-1 text-sm whitespace-pre-wrap text-ink">{e.detail}</p>}
      {e.shared && <SharedBlock shared={e.shared} label="Shared by counterparty" />}
      <Checks checks={e.checks} />
      {e.escalation && (
        <div className="mt-2 text-sm">
          <p className="font-medium text-bad">{e.escalation.summary}</p>
          {e.escalation.findings.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {e.escalation.findings.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <RecordChips records={e.records} />
      {e.envelope !== undefined && (
        <Expandable label="A2A envelope (JSON)">
          <Json value={e.envelope} />
        </Expandable>
      )}
    </article>
  );
}

const DEFAULT_APPROVER: Record<ApprovalKind, string> = { "bny-client-message": "Daniel Kim", "gs-redelivery": "Michael Torres", "bny-late-exception": "Priya Sharma" };
const APPROVE_LABEL: Record<ApprovalKind, string> = { "bny-client-message": "Approve and send", "gs-redelivery": "Approve redelivery", "bny-late-exception": "Approve exception" };

export function ApprovalCard({ e, runId, view, decided, onDone }: { e: RunEvent; runId: string; view: View; decided?: RunEvent; onDone?: (outcome: string, channels: string[]) => void }) {
  const a = e.approval!;
  const by = DEFAULT_APPROVER[a.kind];
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const channels = a.message?.channels ?? [];
  const reject = useConfirm();
  const act = async (outcome: string) => {
    setBusy(true);
    setErr(null);
    try {
      await decide(runId, view, a.kind, outcome, by);
      onDone?.(outcome, channels);
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const approved = decided?.decision?.outcome === "approved";
  return (
    <article className={`rounded-lg border bg-white ${decided ? "border-line" : "border-warn shadow-sm"}`}>
      <header className={`flex flex-wrap items-center gap-2 rounded-t-lg px-4 py-2 text-xs ${decided ? "bg-canvas" : "bg-warn-soft"}`}>
        <span className="font-semibold text-warn">{decided ? "Decision recorded" : "Needs your approval"}</span>
        {decided?.decision && (
          <Pill tone={approved ? "ok" : "bad"}>
            {approved ? "Approved" : "Rejected"} by {decided.decision.by}
          </Pill>
        )}
      </header>
      <div className="p-4">
        <h3 className="text-base font-semibold text-navy">{a.title}</h3>
        <p className="mt-1 text-sm text-ink">{a.summary}</p>
        {a.message && (
          <div className="mt-3 rounded-md border border-line">
            <dl className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1 border-b border-line bg-canvas px-3 py-2 text-xs">
              <dt className="text-muted">To</dt>
              <dd className="text-ink">{a.message.to}</dd>
              <dt className="text-muted">Subject</dt>
              <dd className="font-medium text-ink">{a.message.subject}</dd>
            </dl>
            <p className="px-3 py-3 text-sm whitespace-pre-wrap text-ink">{a.message.body}</p>
          </div>
        )}
        {a.shared && <SharedBlock shared={a.shared} label="Shared by counterparty" />}
        {a.evidence.length > 0 && (
          <div className="mt-3">
            <div className="text-xs font-medium text-muted">Evidence</div>
            <RecordChips records={a.evidence} />
          </div>
        )}
        {!decided && (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                disabled={busy}
                onClick={() => act("approved")}
                className="rounded-md bg-ok px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {a.message ? `Send email to ${a.message.to.replace(/\s*<.*>$/, "")}` : APPROVE_LABEL[a.kind]}
              </button>
              <button
                disabled={busy}
                onClick={() => reject.trigger(() => act("rejected"))}
                className={`rounded-md border px-4 py-2 text-sm font-semibold disabled:opacity-50 ${reject.armed ? "border-bad bg-bad text-white" : "border-line text-bad hover:bg-bad-soft"}`}
              >
                {reject.armed ? "Click again to reject" : "Reject"}
              </button>
              <span className="text-xs text-muted">as {by}</span>
              {busy && <span className="text-xs text-muted">Recording your decision…</span>}
            </div>
            {err && (
              <p role="alert" className="mt-2 text-sm text-bad">
                {err}
              </p>
            )}
            <p className="mt-3 text-xs text-muted">Your decision is final and recorded in the audit log. Rejecting stops the case and hands it to people at the firms.</p>
          </>
        )}
      </div>
    </article>
  );
}

/** Pairs each approval request with its decision (if any). */
export function approvalsOf(events: RunEvent[]) {
  return events
    .filter((e) => e.kind === "approval-request" && e.approval)
    .map((req) => ({ req, decided: events.find((d) => d.kind === "approval" && d.decision?.kind === req.approval!.kind && d.seq > req.seq) }));
}
