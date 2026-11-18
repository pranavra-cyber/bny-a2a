// DataScope: the only way agents, tools and consoles read data. A scope can read
// its own firm's tables and docs, the public DTC participant directory, and only
// its own participant's rows of the DTC settlement feed. Anything else throws.
import "server-only";
import { loadAllianzGI, type AllianzGIData } from "./allianzgi";
import { loadBny, type BnyData } from "./bny";
import type { Timestamp } from "./core";
import { loadDocs, type FirmDoc } from "./docs";
import { loadDtc, type DtcData } from "./dtc";
import { loadGoldman, type GoldmanData } from "./goldman";

export type ScopeFirm = "bny" | "goldman" | "allianzgi";

type Prefixed<F extends string, D> = { [K in keyof D & string as `${F}/${K}`]: D[K] extends (infer R)[] ? R : never };
export type TableMap = Prefixed<"bny", BnyData> &
  Prefixed<"goldman", GoldmanData> &
  Prefixed<"allianzgi", AllianzGIData> &
  Prefixed<"dtc", DtcData>;
export type TableName = keyof TableMap;

export const PARTICIPANT: Record<ScopeFirm, string | null> = { bny: "0901", goldman: "0005", allianzgi: null };

export class ScopeViolationError extends Error {
  constructor(firm: ScopeFirm, table: string) {
    super(`DataScope(${firm}) may not read ${table}`);
    this.name = "ScopeViolationError";
  }
}

export class UnknownTableError extends Error {
  constructor(table: string) {
    super(`No table ${table}`);
    this.name = "UnknownTableError";
  }
}

/** Primary key used to cite a row as a source record. */
export function recordId(table: TableName, row: Record<string, unknown>): string {
  const r = row as Record<string, unknown>;
  switch (table) {
    case "bny/positions":
      return `${r.account_id}/${r.isin}`;
    case "goldman/inventory":
      return `${r.isin}@${r.box_location}`;
    case "dtc/settlement_activity":
      return `${r.dtc_reference}/${r.event}`;
    default:
      return String(Object.values(r)[0]);
  }
}

/** Row rendered for display and comparison: timestamps as their original strings. */
export function displayRow(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) out[k] = "";
    else if (typeof v === "object" && "raw" in (v as Timestamp)) out[k] = (v as Timestamp).raw;
    else out[k] = String(v);
  }
  return out;
}

export class DataScope {
  constructor(public readonly firm: ScopeFirm) {}

  get participant() {
    return PARTICIPANT[this.firm];
  }

  canRead(table: string): boolean {
    const [owner, name] = table.split("/");
    if (owner === this.firm) return true;
    if (owner !== "dtc") return false;
    if (name === "participants") return true;
    return name === "settlement_activity" && this.participant !== null;
  }

  read<K extends TableName>(table: K): readonly TableMap[K][] {
    if (!this.canRead(table)) throw new ScopeViolationError(this.firm, table);
    const [owner, name] = table.split("/") as [string, string];
    if (owner === "dtc") {
      const dtc = loadDtc();
      if (name === "participants") return dtc.participants as unknown as TableMap[K][];
      const p = this.participant;
      return dtc.settlement_activity.filter(
        (e) => e.deliverer_participant === p || e.receiver_participant === p,
      ) as unknown as TableMap[K][];
    }
    const data = (owner === "bny" ? loadBny() : owner === "goldman" ? loadGoldman() : loadAllianzGI()) as Record<
      string,
      unknown[]
    >;
    if (!data[name]) throw new UnknownTableError(table);
    return data[name] as TableMap[K][];
  }

  find<K extends TableName>(table: K, id: string): TableMap[K] | undefined {
    return this.read(table).find((r) => recordId(table, r as Record<string, unknown>) === id);
  }

  docs(): FirmDoc[] {
    return loadDocs(this.firm);
  }

  doc(name: string): FirmDoc | undefined {
    return this.docs().find((d) => d.name === name);
  }
}

const scopes = new Map<ScopeFirm, DataScope>();
export function scopeFor(firm: ScopeFirm): DataScope {
  let s = scopes.get(firm);
  if (!s) scopes.set(firm, (s = new DataScope(firm)));
  return s;
}

/** The depository's own view of its feed (used only by the mock DTC, never by firm agents). */
export function depositoryFeed() {
  return loadDtc().settlement_activity;
}
