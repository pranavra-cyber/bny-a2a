// npm run data:check: parses every /data file with the zod schemas, checks
// cross-references and the golden NVDA DK case, and prints row counts.
// Runs with --conditions=react-server so the `server-only` guard allows it.
// This script is the one place allowed to read across firms.
import { loadAllianzGI } from "../lib/data/allianzgi";
import { loadBny } from "../lib/data/bny";
import { toEt } from "../lib/data/core";
import { loadDocs } from "../lib/data/docs";
import { loadDtc } from "../lib/data/dtc";
import { loadGoldman } from "../lib/data/goldman";

const EXPECTED_COUNTS: Record<string, Record<string, number>> = {
  bny: {
    settlement_instructions: 2259,
    repair_queue: 144,
    fails_exceptions: 90,
    positions: 1671,
    cash_ledger: 2143,
    client_inquiries: 537,
    client_accounts: 83,
    securities_master: 146,
    ssi_counterparties: 18,
  },
  goldman: {
    trade_blotter: 1888,
    allocations_confirms: 1889,
    deliveries: 1888,
    fails: 70,
    inventory: 42,
    ssi_book: 52,
    stock_loan: 160,
  },
  dtc: { settlement_activity: 6504, participants: 14 },
  allianzgi: { orders: 371, allocations: 371, funds: 8, broker_list: 8 },
};

const failures: string[] = [];
const check = (ok: boolean, label: string) => {
  if (!ok) failures.push(label);
};

// ---------- 1. parse ----------
const loaded: Record<string, Record<string, unknown[]>> = {};
for (const [firm, load] of Object.entries({ bny: loadBny, goldman: loadGoldman, dtc: loadDtc, allianzgi: loadAllianzGI })) {
  try {
    loaded[firm] = load();
  } catch (e) {
    console.error(`\n✗ ${firm}: ${(e as Error).message}`);
    failures.push(`${firm}: failed to load`);
  }
}
for (const firm of ["bny", "goldman", "dtc", "allianzgi"] as const) {
  try {
    loadDocs(firm);
  } catch (e) {
    console.error(`\n✗ ${firm} docs: ${(e as Error).message}`);
    failures.push(`${firm}: docs failed to load`);
  }
}
if (failures.length) bail();

const bny = loadBny();
const gs = loadGoldman();
const dtc = loadDtc();
const agi = loadAllianzGI();

// ---------- 2. row counts ----------
console.log("Row counts");
for (const [firm, tables] of Object.entries(EXPECTED_COUNTS)) {
  for (const [table, expected] of Object.entries(tables)) {
    const actual = loaded[firm][table]?.length ?? 0;
    const ok = actual === expected;
    console.log(`  ${ok ? "✓" : "✗"} ${`${firm}/${table}`.padEnd(32)} ${String(actual).padStart(5)}${ok ? "" : `  (expected ${expected})`}`);
    check(ok, `${firm}/${table}: ${actual} rows, expected ${expected}`);
  }
}
for (const firm of ["bny", "goldman", "allianzgi"] as const) console.log(`  docs ${firm.padEnd(27)} ${String(loadDocs(firm).length).padStart(5)}`);

// ---------- 3. cross-references ----------
const orphans = <T>(rows: T[], key: (r: T) => string | null, known: Set<string>) =>
  rows.map(key).filter((k): k is string => k !== null && !known.has(k));
const xref = (label: string, missing: string[]) => {
  check(missing.length === 0, `${label}: ${missing.length} orphan(s), e.g. ${missing.slice(0, 5).join(", ")}`);
  console.log(`  ${missing.length ? "✗" : "✓"} ${label}${missing.length ? ` (${missing.length} orphans)` : ""}`);
};

console.log("\nCross-references");
const instructionIds = new Set(bny.settlement_instructions.map((r) => r.instruction_id));
xref("bny repair_queue.instruction_id → settlement_instructions", orphans(bny.repair_queue, (r) => r.instruction_id, instructionIds));
xref("bny fails_exceptions.instruction_id → settlement_instructions", orphans(bny.fails_exceptions, (r) => r.instruction_id, instructionIds));
xref("goldman fails.delivery_id → deliveries", orphans(gs.fails, (r) => r.delivery_id, new Set(gs.deliveries.map((r) => r.delivery_id))));
const dtcRefs = new Set(dtc.settlement_activity.map((r) => r.dtc_reference));
xref("goldman deliveries.dtc_reference → dtc settlement_activity", orphans(gs.deliveries, (r) => r.dtc_reference, dtcRefs));

const isins = new Set(bny.securities_master.map((r) => r.isin));
const isinUses: [string, { isin: string }[]][] = [
  ["bny settlement_instructions", bny.settlement_instructions],
  ["bny positions", bny.positions],
  ["goldman trade_blotter", gs.trade_blotter],
  ["goldman deliveries", gs.deliveries],
  ["goldman inventory", gs.inventory],
  ["goldman stock_loan", gs.stock_loan],
  ["dtc settlement_activity", dtc.settlement_activity],
  ["allianzgi orders", agi.orders],
];
for (const [label, rows] of isinUses)
  xref(`${label}.isin → bny securities_master`, [...new Set(orphans(rows, (r) => r.isin, isins))]);

// ---------- 4. golden case ----------
console.log("\nGolden case (NVDA DK)");
const golden = (label: string, ok: boolean) => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}`);
  check(ok, `golden: ${label}`);
};
const NVDA = "US67066G1040";
const instr = (id: string) => bny.settlement_instructions.find((r) => r.instruction_id === id);

const orig = instr("BNYI-20261118-5527301");
golden(
  "BNYI-20261118-5527301: 8,000 NVDA, SENT_TO_DTC",
  orig?.quantity === 8000 &&
    orig.isin === NVDA &&
    bny.securities_master.find((s) => s.isin === NVDA)?.ticker === "NVDA" &&
    orig.status === "SENT_TO_DTC",
);

const amend = instr("BNYI-20261118-5529944");
golden(
  "BNYI-20261118-5529944: 10,000, cpty participant blank, IN_REPAIR, amends 5527301",
  amend?.quantity === 10000 &&
    amend.cpty_dtc_participant === null &&
    amend.status === "IN_REPAIR" &&
    amend.amends_instruction_id === "BNYI-20261118-5527301",
);

const rq = bny.repair_queue.find((r) => r.repair_id === "RQ-20261118-0412");
golden(
  "RQ-20261118-0412: MISSING_CPTY_PARTICIPANT, cutoff 2026-11-19 14:30 ET, unassigned",
  rq?.repair_reason === "MISSING_CPTY_PARTICIPANT" &&
    rq.cutoff_ts_et.utc.toISOString() === "2026-11-19T19:30:00.000Z" &&
    rq.assigned_to === null,
);

const ssi = (id: string) => bny.ssi_counterparties.find((r) => r.ssi_id === id);
golden("SSI-GS-US-EQ-0005: ACTIVE, participant 0005", ssi("SSI-GS-US-EQ-0005")?.status === "ACTIVE" && ssi("SSI-GS-US-EQ-0005")?.dtc_participant === "0005");
golden("SSI-GS-US-EQ-7108: SUPERSEDED", ssi("SSI-GS-US-EQ-7108")?.status === "SUPERSEDED");

const events = dtc.settlement_activity
  .filter((r) => r.dtc_reference === "DTC-DO-20261119-000318")
  .sort((a, b) => a.event_ts_et.utc.getTime() - b.event_ts_et.utc.getTime());
const [ins, dk] = events;
golden(
  "DTC-DO-20261119-000318: INSTRUCTED 08:15 ET → DK QTY_MISMATCH 08:16 ET; 0005→0901; 10,000; $1,862,600",
  events.length === 2 &&
    ins.event === "INSTRUCTED" &&
    toEt(ins.event_ts_et.utc) === "2026-11-19 08:15" &&
    dk.event === "DK" &&
    dk.reason_code === "QTY_MISMATCH" &&
    toEt(dk.event_ts_et.utc) === "2026-11-19 08:16" &&
    events.every(
      (e) =>
        e.deliverer_participant === "0005" &&
        e.receiver_participant === "0901" &&
        e.quantity === 10000 &&
        e.settlement_amount === 1862600,
    ),
);

const gsFail = gs.fails.find((r) => r.gs_fail_id === "GS-FAIL-20261119-0091");
golden("GS-FAIL-20261119-0091: DK_BY_RECEIVER, OPEN", gsFail?.fail_reason === "DK_BY_RECEIVER" && gsFail.status === "OPEN");

golden("EXC-20261119-0907: OPEN", bny.fails_exceptions.find((r) => r.exception_id === "EXC-20261119-0907")?.status === "OPEN");

const alloc = (id: string) => agi.allocations.find((r) => r.allocation_id === id);
golden("ALC-26-322-0773-2: 10,000, version 2", alloc("ALC-26-322-0773-2")?.quantity === 10000 && alloc("ALC-26-322-0773-2")?.version === 2);
golden("ALC-26-322-0773-1: SUPERSEDED", alloc("ALC-26-322-0773-1")?.status === "SUPERSEDED");

if (failures.length) bail();
console.log("\n✓ data:check passed");

function bail(): never {
  console.error(`\n✗ data:check failed (${failures.length}):\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
