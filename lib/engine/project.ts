// Per-view projection of a run. Firm consoles receive only events addressed to
// their firm, only their own cited records, and never the network envelope.
import { firmOfSeat } from "./guide";
import type { ApprovalKind, Firm, ProjectedRun, RunEvent, RunSummary, View } from "./types";

const APPROVAL_FIRM: Record<ApprovalKind, Firm> = { "bny-client-message": "bny", "gs-redelivery": "goldman", "bny-late-exception": "bny" };

export function projectEvent(e: RunEvent, view: View): RunEvent | null {
  if (view === "network") return e;
  if (!e.audience.includes(view)) return null;
  const out: RunEvent = { ...e, records: e.records?.filter((r) => r.firm === view) };
  delete out.envelope;
  if (view !== "bny") delete out.checks; // gateway checks are BNY's own controls
  if (out.approval && out.approval.firm !== view) delete out.approval;
  return out;
}

export function projectSummary(s: RunSummary, view: View): RunSummary {
  if (view === "network") return s;
  return {
    ...s,
    pendingApprovals: s.pendingApprovals.filter((k) => APPROVAL_FIRM[k] === view),
    pendingCheckpoint: s.pendingCheckpoint && firmOfSeat(s.pendingCheckpoint.seat) === view ? s.pendingCheckpoint : undefined,
    copilotBusy: s.copilotBusy && !!s.busySeat && firmOfSeat(s.busySeat) === view,
    busySeat: s.busySeat && firmOfSeat(s.busySeat) === view ? s.busySeat : null,
  };
}

export function project(summary: RunSummary, events: RunEvent[], view: View): ProjectedRun {
  return {
    view,
    summary: projectSummary(summary, view),
    events: events.map((e) => projectEvent(e, view)).filter((e): e is RunEvent => e !== null),
  };
}
