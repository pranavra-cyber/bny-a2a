// Server-side data for each firm's console. Each builder reads only its own
// firm's DataScope; nothing here can see the other firm's tables.
import "server-only";
import { DataParseError, DataSetupError } from "./data/core";
import { displayRow, recordId, scopeFor } from "./data/scope";
import type { ResolvedRecord } from "./engine/types";

/** Loads every firm's tables and docs once; returns setup errors (missing or invalid files) to show on screen. */
export function dataSetupProblems(): string[] {
  const checks = [
    () => scopeFor("bny").read("bny/settlement_instructions"),
    () => scopeFor("bny").docs(),
    () => scopeFor("goldman").read("goldman/fails"),
    () => scopeFor("goldman").docs(),
    () => scopeFor("allianzgi").read("allianzgi/orders"),
    () => scopeFor("allianzgi").docs(),
    () => scopeFor("bny").read("dtc/participants"),
  ];
  const problems: string[] = [];
  for (const check of checks) {
    try {
      check();
    } catch (e) {
      if (!(e instanceof DataSetupError || e instanceof DataParseError)) throw e;
      if (!problems.includes(e.message)) problems.push(e.message);
    }
  }
  return problems;
}

export type QueueRow = Record<string, string>;
export type ConsoleData = { queue: QueueRow[]; caseRecords: ResolvedRecord[] };

const rec = (firm: string, table: string, row: object): ResolvedRecord => ({
  firm,
  table,
  id: recordId(table as never, row as Record<string, unknown>),
  row: displayRow(row as Record<string, unknown>),
});

/** Goldman fails desk: fails queue (open first, newest first) and records for the top open DK. */
export function goldmanConsoleData(): ConsoleData {
  const s = scopeFor("goldman");
  const fails = [...s.read("goldman/fails")].sort((a, b) =>
    a.status !== b.status ? (a.status === "OPEN" ? -1 : 1) : b.opened_ts_utc.utc.getTime() - a.opened_ts_utc.utc.getTime(),
  );
  const deliveries = s.read("goldman/deliveries");
  const top = fails.find((f) => f.status === "OPEN" && f.fail_reason === "DK_BY_RECEIVER");
  const caseRecords: ResolvedRecord[] = [];
  if (top) {
    const d = deliveries.find((x) => x.delivery_id === top.delivery_id);
    caseRecords.push(rec("goldman", "goldman/fails", top));
    if (d) {
      caseRecords.push(rec("goldman", "goldman/deliveries", d));
      const t = s.read("goldman/trade_blotter").find((x) => x.gs_trade_ref === d.gs_trade_ref);
      if (t) caseRecords.push(rec("goldman", "goldman/trade_blotter", t));
      for (const a of s.read("goldman/allocations_confirms").filter((x) => x.gs_trade_ref === d.gs_trade_ref))
        caseRecords.push(rec("goldman", "goldman/allocations_confirms", a));
      const inv = s.read("goldman/inventory").find((x) => x.isin === d.isin);
      if (inv) caseRecords.push(rec("goldman", "goldman/inventory", inv));
    }
  }
  return { queue: fails.slice(0, 40).map((f) => displayRow(f)), caseRecords };
}

/** BNY settlement analyst: repair queue (open first, by priority). */
export function bnyConsoleData(): ConsoleData {
  const s = scopeFor("bny");
  const queue = [...s.read("bny/repair_queue")]
    .sort((a, b) => (!a.resolution !== !b.resolution ? (a.resolution ? 1 : -1) : b.priority_score - a.priority_score))
    .slice(0, 40)
    .map((r) => displayRow(r));
  return { queue, caseRecords: [] };
}
