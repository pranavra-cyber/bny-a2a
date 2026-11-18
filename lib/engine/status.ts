// Plain-language status for a run. Safe for client components.
import { SEATS } from "./guide";
import type { ApprovalKind, RunStatus, RunSummary } from "./types";

export const STATUS_LABEL: Record<RunStatus, string> = {
  running: "Agents working",
  "awaiting-input": "Waiting for a person",
  "awaiting-approval": "Waiting for approval",
  settled: "Settled",
  "settled-partial": "Partly settled",
  escalated: "Escalated",
  rejected: "Rejected",
  failed: "Failed",
};

export const APPROVAL_LABEL: Record<ApprovalKind, string> = {
  "bny-client-message": "Message to the client",
  "gs-redelivery": "Goldman redelivery",
  "bny-late-exception": "Late-instruction exception",
};

export const FINAL = new Set<RunStatus>(["settled", "settled-partial", "escalated", "rejected", "failed"]);

export const statusText = (s: RunSummary) => (s.status === "escalated" && s.statusReason === "budget" ? "Escalated (budget)" : STATUS_LABEL[s.status]);

export const statusTone = (s: RunSummary): "ok" | "warn" | "bad" | "teal" =>
  s.status.startsWith("settled") ? "ok" : FINAL.has(s.status) ? "bad" : s.status === "running" ? "teal" : "warn";

/** Who holds the ball right now, in one line. */
export function ballText(s: RunSummary): string {
  if (s.status.startsWith("settled")) return "Settled at DTC: case closed";
  if (FINAL.has(s.status)) return `${statusText(s)}: with people at the firms`;
  if (s.turn) return `With ${SEATS[s.turn].person} (${SEATS[s.turn].firm === "BNY" ? `BNY ${SEATS[s.turn].title}` : SEATS[s.turn].firm})`;
  return "Agents working";
}
