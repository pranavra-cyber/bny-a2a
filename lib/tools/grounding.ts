// Grounding validator: every agent finding must cite at least one record that
// resolves to a real row in the agent's own scope, with matching field values.
import "server-only";
import type { SourceRef } from "../a2a/types";
import { type DataScope, displayRow, type TableName, UnknownTableError } from "../data/scope";
import type { ResolvedRecord } from "../engine/types";

export type Finding = { claim: string; sourceRecords: { table: string; id: string; fields: { name: string; value: string }[] }[] };

export type GroundingResult = { ok: boolean; problems: string[]; resolved: ResolvedRecord[] };

const DOCS = "docs";

function normalizeTable(scope: DataScope, table: string): string {
  const t = table.trim();
  if (t.includes("/")) return t;
  return t === DOCS ? `${scope.firm}/docs` : `${scope.firm}/${t}`;
}

function sameValue(a: string, b: string): boolean {
  const x = a.trim();
  const y = b.trim().replace(/^\$/, "");
  if (x === y) return true;
  const nx = Number(x.replace(/,/g, ""));
  const ny = Number(y.replace(/,/g, ""));
  return x !== "" && y !== "" && Number.isFinite(nx) && Number.isFinite(ny) && nx === ny;
}

export function resolveRef(scope: DataScope, ref: Omit<SourceRef, "firm">): { record?: ResolvedRecord; problem?: string } {
  const table = normalizeTable(scope, ref.table);
  if (table === `${scope.firm}/docs`) {
    const doc = scope.doc(ref.id.replace(/\.md$/, ""));
    if (!doc) return { problem: `doc ${ref.id} not found in ${scope.firm} docs` };
    for (const f of ref.fields ?? [])
      if (!doc.markdown.includes(f.value)) return { problem: `doc ${ref.id} does not contain "${f.value}"` };
    return { record: { firm: scope.firm, table, id: doc.name, row: { excerpt: doc.markdown.slice(0, 600) } } };
  }
  if (!scope.canRead(table)) return { problem: `${table} is outside ${scope.firm}'s scope` };
  let row;
  try {
    row = scope.find(table as TableName, ref.id);
  } catch (e) {
    if (e instanceof UnknownTableError) return { problem: `${table} is not a table` };
    throw e;
  }
  if (!row) return { problem: `${table}#${ref.id} does not exist` };
  const shown = displayRow(row as Record<string, unknown>);
  for (const f of ref.fields ?? []) {
    if (!(f.name in shown)) return { problem: `${table}#${ref.id} has no column ${f.name}` };
    if (!sameValue(shown[f.name], f.value)) return { problem: `${table}#${ref.id}.${f.name} is "${shown[f.name]}", not "${f.value}"` };
  }
  return { record: { firm: scope.firm, table, id: ref.id, row: shown } };
}

export function validateFindings(scope: DataScope, findings: Finding[]): GroundingResult {
  const problems: string[] = [];
  const resolved = new Map<string, ResolvedRecord>();
  if (findings.length === 0) problems.push("no findings cited");
  for (const f of findings) {
    if (f.sourceRecords.length === 0) problems.push(`uncited claim: "${f.claim}"`);
    for (const ref of f.sourceRecords) {
      const { record, problem } = resolveRef(scope, ref);
      if (problem) problems.push(`"${f.claim}": ${problem}`);
      if (record) resolved.set(`${record.table}#${record.id}`, record);
    }
  }
  return { ok: problems.length === 0, problems, resolved: [...resolved.values()] };
}

export const toResolved = (scope: DataScope, table: TableName, row: Record<string, unknown>, id: string): ResolvedRecord => ({
  firm: scope.firm,
  table,
  id,
  row: displayRow(row),
});
