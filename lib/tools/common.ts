// Shared plumbing for deterministic tools: every lookup is counted and written to
// the audit log with the exact records it touched.
import "server-only";
import { type DataScope, recordId, type TableName } from "../data/scope";
import type { Run } from "../engine/run";
import type { Actor, ResolvedRecord } from "../engine/types";
import { toResolved } from "./grounding";

export type ToolCtx = { run: Run; scope: DataScope; actor: Actor };

/** Records a tool's data access and returns the rows as citable records. */
export function accessed<K extends TableName>(ctx: ToolCtx, tool: string, table: K, rows: readonly object[]): ResolvedRecord[] {
  ctx.run.toolCalls++;
  const records = rows.map((r) => toResolved(ctx.scope, table, r as Record<string, unknown>, recordId(table, r as Record<string, unknown>)));
  ctx.run.log({
    actor: ctx.actor.name,
    actorType: "RULE",
    firm: ctx.scope.firm,
    action: `tool ${tool}`,
    dataAccessed: records.map((r) => `${r.table}#${r.id}`),
    fieldsShared: [],
    decision: rows.length ? `${rows.length} row(s)` : "no match",
    approver: "",
  });
  return records;
}

export function accessedDoc(ctx: ToolCtx, tool: string, name: string, excerpt: string): ResolvedRecord {
  ctx.run.toolCalls++;
  ctx.run.log({
    actor: ctx.actor.name,
    actorType: "RULE",
    firm: ctx.scope.firm,
    action: `tool ${tool}`,
    dataAccessed: [`${ctx.scope.firm}/docs#${name}`],
    fieldsShared: [],
    decision: "read",
    approver: "",
  });
  return { firm: ctx.scope.firm, table: `${ctx.scope.firm}/docs`, id: name, row: { excerpt } };
}

/** Extracts one markdown section (by heading text) from a doc. */
export function section(markdown: string, heading: string): string {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => /^#+\s/.test(l) && l.includes(heading));
  if (start < 0) return "";
  const level = lines[start].match(/^#+/)![0].length;
  const end = lines.findIndex((l, i) => i > start && new RegExp(`^#{1,${level}}\\s`).test(l));
  return lines.slice(start, end < 0 ? undefined : end).join("\n").trim();
}
