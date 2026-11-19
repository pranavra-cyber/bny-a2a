// Shared agent plumbing: the finding/citation schema, compact record rendering
// for prompts, and agentCall(), which routes every model call through callModel()
// and records it in the run's event stream and audit log.
import "server-only";
import { z } from "zod";
import type { Seat } from "../engine/guide";
import type { Run } from "../engine/run";
import type { Actor, Lane, ResolvedRecord } from "../engine/types";
import { callModel, type ModelContext } from "../llm/callModel";

export const sourceRefSchema = z.object({
  table: z.string().describe("Table name, e.g. settlement_instructions or dtc/settlement_activity, or docs"),
  id: z.string().describe("Record id exactly as given in the records"),
  fields: z.array(z.object({ name: z.string(), value: z.string() })).describe("Column values you rely on, copied exactly"),
});
export const findingSchema = z.object({ claim: z.string(), sourceRecords: z.array(sourceRefSchema) });
export type FindingOut = z.infer<typeof findingSchema>;

export const CITE_RULE =
  "Every finding must cite at least one record by table and id, with the exact column values it relies on. Use only the records provided. If something cannot be verified from them, say so instead of guessing. Be brief: at most 4 findings, each claim under 20 words, citing only the columns it relies on.";

/** Rows for a prompt: only the listed columns, tagged with table and id. */
export function compact(records: ResolvedRecord[], columns?: Record<string, string[]>): Record<string, string>[] {
  return records.map((r) => {
    const short = r.table.replace(/^(bny|goldman|allianzgi)\//, "");
    const cols = columns?.[short];
    const row = cols ? Object.fromEntries(cols.filter((c) => c in r.row).map((c) => [c, r.row[c]])) : r.row;
    return { table: short, id: r.id, ...row };
  });
}

/** Finds the first prompt row from a table (used by mock decisions). */
export const rowOf = (rows: Record<string, string>[], table: string) => rows.find((r) => r.table === table);
export const cite = (r: Record<string, string> | undefined, ...cols: string[]) =>
  r ? [{ table: r.table, id: r.id, fields: cols.map((c) => ({ name: c, value: r[c] ?? "" })) }] : [];

const g = globalThis as unknown as { __llmCtx?: WeakMap<Run, ModelContext> };
const contexts = (g.__llmCtx ??= new WeakMap<Run, ModelContext>());
export const attachModel = (run: Run, ctx: ModelContext) => contexts.set(run, ctx);
export const modelContextOf = (run: Run) => contexts.get(run);

export async function agentCall<T extends z.ZodType>(
  run: Run,
  actor: Actor,
  lane: Lane,
  { desk, ...opts }: { system: string; input: string; schemaName: string; schema: T; maxOutputTokens?: number; desk?: Seat },
): Promise<z.output<T>> {
  const ctx = contexts.get(run);
  if (!ctx) throw new Error(`run ${run.id} has no model context`);
  const { data } = await callModel(
    {
      ...ctx,
      onCall: (rec) => {
        run.emit({
          kind: "model-call",
          lane,
          desk,
          audience: actor.firm === "bny" || actor.firm === "goldman" || actor.firm === "allianzgi" ? [actor.firm] : [],
          actor,
          title: `Model call #${rec.n}`,
          detail: `${rec.usage.inputTokens} in / ${rec.usage.outputTokens} out tokens · $${rec.costUsd.toFixed(5)}`,
          modelCall: {
            agent: actor.name,
            model: rec.model,
            tokensIn: rec.usage.inputTokens,
            tokensOut: rec.usage.outputTokens,
            costUsd: rec.costUsd,
            runningUsd: rec.runningUsd,
          },
        });
        run.log({
          actor: actor.name,
          actorType: "AGENT",
          firm: actor.firm,
          action: `model call (${opts.schemaName})`,
          dataAccessed: [],
          fieldsShared: [],
          decision: `max_output_tokens ${rec.maxOutputTokens}; worst case $${rec.worstCaseUsd.toFixed(5)}`,
          approver: "",
          model: rec.model,
          tokensIn: rec.usage.inputTokens,
          tokensOut: rec.usage.outputTokens,
          costUsd: rec.costUsd,
          runningCostUsd: rec.runningUsd,
        });
      },
    },
    { agent: actor.name, firm: actor.firm, ...opts },
  );
  return data;
}

export const ACTORS = {
  gsMonitor: { id: "gs-fails-monitor", name: "GS Fails Monitor", firm: "goldman", type: "AGENT" },
  gsMonitorRule: { id: "gs-fails-monitor", name: "GS Fails Monitor", firm: "goldman", type: "RULE" },
  gsOutreach: { id: "gs-outreach", name: "GS Counterparty Outreach Agent", firm: "goldman", type: "AGENT" },
  gsOutreachRule: { id: "gs-outreach", name: "GS Counterparty Outreach Agent", firm: "goldman", type: "RULE" },
  gsOps: { id: "gs-ops-approver", name: "Michael Torres", firm: "goldman", type: "HUMAN" },
  gateway: { id: "bny-gateway", name: "BNY Intake Gateway", firm: "bny", type: "RULE" },
  bnyCase: { id: "bny-settlement-agent", name: "BNY Settlement Ops Agent", firm: "bny", type: "AGENT" },
  bnyCaseRule: { id: "bny-settlement-agent", name: "BNY Settlement Ops Agent", firm: "bny", type: "RULE" },
  bnyClientTeam: { id: "bny-client-team", name: "BNY Client Team Agent", firm: "bny", type: "AGENT" },
  bnyClientTeamRule: { id: "bny-client-team", name: "BNY Client Team Agent", firm: "bny", type: "RULE" },
  bnySystem: { id: "bny-settlement-system", name: "BNY Settlement System (mock)", firm: "bny", type: "RULE" },
  bnyOps: { id: "bny-ops-lead", name: "Priya Sharma", firm: "bny", type: "HUMAN" },
  bnyClientService: { id: "bny-client-service", name: "Daniel Kim", firm: "bny", type: "HUMAN" },
  dtc: { id: "dtc", name: "DTC (mock depository)", firm: "dtc", type: "RULE" },
  agiClient: { id: "agi-trade-ops", name: "Emily Carter (AllianzGI)", firm: "allianzgi", type: "HUMAN" },
  gsCopilot: { id: "gs-copilot", name: "GS Fails Assistant", firm: "goldman", type: "AGENT" },
  bnyCopilot: { id: "bny-orchestrator", name: "Settlement Fails Orchestrator", firm: "bny", type: "AGENT" },
  gsUser: { id: "gs-user", name: "Michael Torres", firm: "goldman", type: "HUMAN" },
  bnyUser: { id: "bny-user", name: "Priya Sharma", firm: "bny", type: "HUMAN" },
  bnyCsUser: { id: "bny-cs-user", name: "Daniel Kim", firm: "bny", type: "HUMAN" },
  spoof: { id: "gs-settlement-ops", name: "gs-settlement-ops.co agent", firm: "network", type: "AGENT" },
} satisfies Record<string, Actor>;
