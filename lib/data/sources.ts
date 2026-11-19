// Where every piece of data comes from: the system of record, the file in data/,
// the version and as-of time the prototype reads, and earlier versions. Records
// change through the day (instructions are amended, SSIs re-verified, procedures
// revised), so every record and every answer names the version it came from.
// Synthetic metadata. Safe for client components.

export type SourceVersion = { version: string; at: string; change: string };

export type Source = {
  key: string;
  firm: "bny" | "goldman" | "dtc" | "allianzgi";
  /** What people call it. */
  name: string;
  /** The system of record the extract comes from. */
  system: string;
  /** File in the repository's data/ folder. */
  file: string;
  kind: "table" | "document";
  /** The version the prototype reads. */
  version: string;
  /** When that version was taken (ET for BNY, UTC for Goldman). */
  asOf: string;
  owner: string;
  refresh: string;
  history: SourceVersion[];
};

const s = (x: Source) => x;

export const SOURCES: Source[] = [
  // ---------- BNY ----------
  s({
    key: "bny/settlement_instructions",
    firm: "bny",
    name: "Settlement instructions",
    system: "BNY Settlement Instruction Store (SIS)",
    file: "data/bny/settlement_instructions.csv",
    kind: "table",
    version: "SIS extract 2026-11-19 08:00 ET",
    asOf: "2026-11-19 08:00 ET",
    owner: "BNY Settlement Operations",
    refresh: "Intraday, every 15 minutes; amendments appear as new rows that reference the one they replace",
    history: [
      { version: "SIS extract 2026-11-19 08:00 ET", at: "2026-11-19 08:00 ET", change: "Current. BNYI-20261118-5527301 (AllianzGI NVDA, 8,000, SENT_TO_DTC) still live; no amendment received." },
      { version: "SIS extract 2026-11-18 18:00 ET", at: "2026-11-18 18:00 ET", change: "End of day. Same NVDA instruction at 8,000." },
      { version: "SIS extract 2026-11-18 15:15 ET", at: "2026-11-18 15:15 ET", change: "BNYI-20261118-5527301 received 15:10 ET at 8,000 via SWIFT MT541." },
    ],
  }),
  s({
    key: "bny/fails_exceptions",
    firm: "bny",
    name: "Fails and exceptions tracker",
    system: "BNY Fails & Exceptions Tracker",
    file: "data/bny/fails_exceptions.csv",
    kind: "table",
    version: "Tracker snapshot 2026-11-19 08:20 ET",
    asOf: "2026-11-19 08:20 ET",
    owner: "BNY Settlement Operations",
    refresh: "Live; each DK opens an exception within a minute",
    history: [
      { version: "Tracker snapshot 2026-11-19 08:20 ET", at: "2026-11-19 08:20 ET", change: "EXC-20261119-0907 opened at 08:16 ET for the NVDA DK." },
      { version: "Tracker snapshot 2026-11-18 18:00 ET", at: "2026-11-18 18:00 ET", change: "Two open DK_QTY_MISMATCH items from 18 Nov carried over." },
    ],
  }),
  s({
    key: "bny/client_accounts",
    firm: "bny",
    name: "Client accounts",
    system: "BNY Client Reference Data",
    file: "data/bny/client_accounts.csv",
    kind: "table",
    version: "Reference data release 2026.11.15",
    asOf: "2026-11-15 06:00 ET",
    owner: "BNY Reference Data",
    refresh: "Weekly release; urgent changes by ticket",
    history: [
      { version: "Reference data release 2026.11.15", at: "2026-11-15 06:00 ET", change: "Current. No change to AllianzGI accounts." },
      { version: "Reference data release 2026.11.08", at: "2026-11-08 06:00 ET", change: "AGI-GLEQ-001 service tier confirmed as tier 1." },
    ],
  }),
  s({
    key: "bny/ssi_counterparties",
    firm: "bny",
    name: "Counterparty SSIs",
    system: "BNY SSI Database",
    file: "data/bny/ssi_counterparties.csv",
    kind: "table",
    version: "SSI database 2026-11-18 19:00 ET",
    asOf: "2026-11-18 19:00 ET",
    owner: "BNY Reference Data",
    refresh: "On change; every new SSI is verified by a second person before use",
    history: [
      { version: "SSI database 2026-11-18 19:00 ET", at: "2026-11-18 19:00 ET", change: "Morgan Stanley SSI-MS-US-EQ-7101-B added, pending verification." },
      { version: "SSI database 2026-02-14", at: "2026-02-14 17:00 ET", change: "Goldman US equity SSI SSI-GS-US-EQ-0005 re-verified by L. Park." },
      { version: "SSI database 2024-06-01", at: "2024-06-01 09:00 ET", change: "Goldman SSI moved to DTC participant 0005; the older SSI was ended." },
    ],
  }),
  s({
    key: "bny/repair_queue",
    firm: "bny",
    name: "Repair queue",
    system: "BNY Instruction Repair Queue",
    file: "data/bny/repair_queue.csv",
    kind: "table",
    version: "Repair queue 2026-11-19 08:00 ET",
    asOf: "2026-11-19 08:00 ET",
    owner: "BNY Instruction Repair",
    refresh: "Live",
    history: [{ version: "Repair queue 2026-11-19 08:00 ET", at: "2026-11-19 08:00 ET", change: "No AllianzGI NVDA item: the amendment never reached BNY." }],
  }),
  s({
    key: "bny/client_inquiries",
    firm: "bny",
    name: "Client inquiry log",
    system: "BNY Client Service CRM",
    file: "data/bny/client_inquiries.csv",
    kind: "table",
    version: "CRM export 2026-11-19 07:30 ET",
    asOf: "2026-11-19 07:30 ET",
    owner: "BNY Client Service",
    refresh: "Hourly",
    history: [{ version: "CRM export 2026-11-19 07:30 ET", at: "2026-11-19 07:30 ET", change: "No inquiry from AllianzGI about NVDA." }],
  }),
  s({
    key: "bny/docs/settlement_operations_procedures",
    firm: "bny",
    name: "Settlement Operations Procedures",
    system: "BNY Policy Library",
    file: "data/bny/docs/settlement_operations_procedures.md",
    kind: "document",
    version: "v4.2",
    asOf: "Reviewed 2026-09-30",
    owner: "US Securities Settlement Operations",
    refresh: "Reviewed quarterly",
    history: [
      { version: "v4.2", at: "2026-09-30", change: "Current. Late-instruction exception window set to 14:45 ET." },
      { version: "v4.1", at: "2026-06-28", change: "Late exceptions until 14:30 ET; tier-1 escalation added." },
      { version: "v4.0", at: "2026-03-31", change: "Agent-assisted triage allowed with analyst sign-off." },
    ],
  }),
  s({
    key: "bny/docs/allianzgi_service_level_summary",
    firm: "bny",
    name: "AllianzGI service terms",
    system: "BNY Client Service Agreements",
    file: "data/bny/docs/allianzgi_service_level_summary.md",
    kind: "document",
    version: "SLA schedule 2026-A",
    asOf: "Effective 2026-01-01",
    owner: "BNY Client Service",
    refresh: "Annual, or on renegotiation",
    history: [
      { version: "SLA schedule 2026-A", at: "2026-01-01", change: "Current. At-risk notice by 10:00 ET; fail notice within 30 minutes." },
      { version: "SLA schedule 2025-B", at: "2025-07-01", change: "At-risk notice by 11:00 ET." },
    ],
  }),
  s({
    key: "bny/docs/repair_queue_runbook",
    firm: "bny",
    name: "Repair Queue Runbook",
    system: "BNY Policy Library",
    file: "data/bny/docs/repair_queue_runbook.md",
    kind: "document",
    version: "v2.7",
    asOf: "Reviewed 2026-10-15",
    owner: "Instruction Repair",
    refresh: "Reviewed quarterly",
    history: [{ version: "v2.7", at: "2026-10-15", change: "Current." }],
  }),
  s({
    key: "bny/docs/ops_team_chat_export_nov_18_19",
    firm: "bny",
    name: "Ops team chat export",
    system: "Microsoft Teams export",
    file: "data/bny/docs/ops_team_chat_export_nov_18_19.md",
    kind: "document",
    version: "Export 2026-11-19 08:30 ET",
    asOf: "2026-11-19 08:30 ET",
    owner: "BNY Settlement Operations",
    refresh: "On request",
    history: [{ version: "Export 2026-11-19 08:30 ET", at: "2026-11-19 08:30 ET", change: "Current." }],
  }),
  // ---------- DTC (each firm sees its own rows) ----------
  s({
    key: "dtc/settlement_activity",
    firm: "dtc",
    name: "DTC settlement activity",
    system: "DTC participant feed (mock)",
    file: "data/dtc/settlement_activity.csv",
    kind: "table",
    version: "Feed through 2026-11-19 08:16 ET",
    asOf: "2026-11-19 08:16 ET",
    owner: "DTC (mock depository)",
    refresh: "Real time; each firm sees only its own participant's rows",
    history: [{ version: "Feed through 2026-11-19 08:16 ET", at: "2026-11-19 08:16 ET", change: "DTC-DO-20261119-000318 DK'd by participant 0901 at 08:16 ET." }],
  }),
  s({
    key: "dtc/participants",
    firm: "dtc",
    name: "DTC participant directory",
    system: "DTC public directory (mock)",
    file: "data/dtc/participants.csv",
    kind: "table",
    version: "Directory 2026-11",
    asOf: "2026-11-01",
    owner: "DTC (mock depository)",
    refresh: "Monthly",
    history: [{ version: "Directory 2026-11", at: "2026-11-01", change: "Current." }],
  }),
  // ---------- Goldman ----------
  s({
    key: "goldman/fails",
    firm: "goldman",
    name: "Fails book",
    system: "GS Fails Management System",
    file: "data/goldman/fails.csv",
    kind: "table",
    version: "Fails book 2026-11-19 13:20 UTC",
    asOf: "2026-11-19 13:20 UTC",
    owner: "GS US Equity Fails Management",
    refresh: "Live",
    history: [{ version: "Fails book 2026-11-19 13:20 UTC", at: "2026-11-19 13:20 UTC", change: "GS-FAIL-20261119-0091 opened, unassigned." }],
  }),
  s({
    key: "goldman/deliveries",
    firm: "goldman",
    name: "Deliveries",
    system: "GS Settlement Engine",
    file: "data/goldman/deliveries.csv",
    kind: "table",
    version: "Settlement engine 2026-11-19 13:16 UTC",
    asOf: "2026-11-19 13:16 UTC",
    owner: "GS Settlements",
    refresh: "Real time",
    history: [{ version: "Settlement engine 2026-11-19 13:16 UTC", at: "2026-11-19 13:16 UTC", change: "DEL for NVDA 10,000 to BNY marked DK." }],
  }),
  s({
    key: "goldman/allocations_confirms",
    firm: "goldman",
    name: "Allocations and confirms",
    system: "GS Allocation Hub (CTM link)",
    file: "data/goldman/allocations_confirms.csv",
    kind: "table",
    version: "CTM sync 2026-11-18 23:40 UTC",
    asOf: "2026-11-18 23:40 UTC",
    owner: "GS Middle Office",
    refresh: "On each CTM message",
    history: [
      { version: "CTM sync 2026-11-18 23:40 UTC", at: "2026-11-18 23:40 UTC", change: "Client's amended allocation 10,000 affirmed in CTM." },
      { version: "CTM sync 2026-11-18 19:05 UTC", at: "2026-11-18 19:05 UTC", change: "Original allocation 8,000 affirmed." },
    ],
  }),
  s({
    key: "goldman/inventory",
    firm: "goldman",
    name: "Box inventory",
    system: "GS Inventory Ledger",
    file: "data/goldman/inventory.csv",
    kind: "table",
    version: "Ledger 2026-11-19 13:00 UTC",
    asOf: "2026-11-19 13:00 UTC",
    owner: "GS Securities Lending",
    refresh: "Every 5 minutes",
    history: [{ version: "Ledger 2026-11-19 13:00 UTC", at: "2026-11-19 13:00 UTC", change: "Current." }],
  }),
  s({
    key: "goldman/trade_blotter",
    firm: "goldman",
    name: "Trade blotter",
    system: "GS Order Management",
    file: "data/goldman/trade_blotter.csv",
    kind: "table",
    version: "Blotter 2026-11-19 00:00 UTC",
    asOf: "2026-11-19 00:00 UTC",
    owner: "GS Equities",
    refresh: "End of day plus intraday amendments",
    history: [{ version: "Blotter 2026-11-19 00:00 UTC", at: "2026-11-19 00:00 UTC", change: "Current." }],
  }),
  s({
    key: "goldman/docs/fails_desk_procedures",
    firm: "goldman",
    name: "Fails Desk Procedures",
    system: "GS Operations Policy Library",
    file: "data/goldman/docs/fails_desk_procedures.md",
    kind: "document",
    version: "v3.1",
    asOf: "Reviewed 2026-08-12",
    owner: "US Equity Fails Management",
    refresh: "Reviewed twice a year",
    history: [
      { version: "v3.1", at: "2026-08-12", change: "Current. Same-day fails over USD 1m reported to desk lead by 15:00 UTC." },
      { version: "v3.0", at: "2026-02-10", change: "CSDR-style penalty assessment added at day 1." },
    ],
  }),
];

const BY_KEY = new Map(SOURCES.map((x) => [x.key, x]));

/** The source for a record's table, or for a document (table "bny/docs", id = doc name). */
export function sourceOf(table: string, id?: string): Source | undefined {
  if (table.endsWith("/docs") && id) return BY_KEY.get(`${table}/${id}`);
  return BY_KEY.get(table);
}

export const sourcesFor = (firm: "bny" | "goldman") => SOURCES.filter((x) => x.firm === firm || x.firm === "dtc");

/** One line for a record: system, version. */
export const sourceLine = (table: string, id?: string) => {
  const x = sourceOf(table, id);
  return x ? `${x.system} · ${x.version}` : table;
};
