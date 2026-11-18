import type { AuditEntry } from "./types";

export const AUDIT_COLUMNS = ["seq", "at", "actor", "actorType", "firm", "action", "dataAccessed", "fieldsShared", "decision", "approver", "model", "tokensIn", "tokensOut", "costUsd", "runningCostUsd"] as const;

const cell = (v: unknown) => {
  const s = Array.isArray(v) ? v.join("; ") : v === undefined || v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function auditCsv(entries: AuditEntry[]): string {
  return [AUDIT_COLUMNS.join(","), ...entries.map((e) => AUDIT_COLUMNS.map((c) => cell(e[c])).join(","))].join("\n") + "\n";
}
