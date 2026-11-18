// Benchmark: the golden case three ways on the same data. Each metric is labeled
// measured (from a run), scripted (scenario clock anchors) or assumed (interviews).
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { singleAgent } from "../agents/bny";
import { ACTORS, attachModel } from "../agents/shared";
import { getConfig, liveProblems } from "../config";
import { scopeFor } from "../data/scope";
import { Budget, BudgetExceededError } from "../llm/budget";
import { AgentOutputError } from "../llm/callModel";
import type { ModelClient } from "../llm/client";
import { investigateDelivery, proceduresExcerpt, sensitiveTerms } from "../tools/bny";
import { validateFindings } from "../tools/grounding";
import { findRecording, RUNS_DIR, type Recording } from "./persist";
import { Run, SCENARIO_DATE } from "./run";
import { modelContextFor, StartError } from "./start";
import { etToIso, fmtEt } from "../time";

export type Basis = "measured" | "scripted" | "assumed";
export type Metric = { value: number; basis: Basis; note?: string };
export type BenchmarkRow = {
  mode: "manual" | "single" | "a2a";
  label: string;
  description: string;
  metrics: {
    minutesToResolution: Metric;
    turns: Metric;
    toolCalls: Metric;
    humanApprovals: Metric;
    escalations: Metric;
    fieldsShared: Metric;
    tokens: Metric;
    costUsd: Metric;
  };
  fieldsSharedList: string[];
  detail?: string;
};
export type Email = { to: string; subject: string; body: string };
export type BenchmarkResult = { createdAt: string; mode: "live" | "mock"; model: string; dkAt: string; rows: BenchmarkRow[]; emails?: Email[] };

const DK_AT = etToIso(SCENARIO_DATE, "08:16:02");
const minutesFromDk = (iso: string) => Math.round((new Date(iso).getTime() - new Date(DK_AT).getTime()) / 60000);

// Patterns that count as a disclosed field when they appear in free text.
const FIELD_PATTERNS: [string, RegExp][] = [
  ["dtc_reference", /DTC-DO-\d{8}-\d{6}/],
  ["isin", /\bUS[A-Z0-9]{9}\d\b/],
  ["quantity", /\b\d{1,3}(,\d{3})+\b|\b\d{4,6}\b/],
  ["instruction_id", /BNYI-\d{8}-\d{7}/],
  ["repair_status", /repair queue|in repair/i],
  ["participant", /\b0005\b|\b0901\b/],
];

export function disclosedFields(text: string, sensitive: string[]): string[] {
  const found = FIELD_PATTERNS.filter(([, re]) => re.test(text)).map(([n]) => n);
  for (const t of sensitive) if (t.length >= 3 && new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) found.push(`client data: ${t}`);
  return [...new Set(found)];
}

export const MANUAL_BASELINE: BenchmarkRow = {
  mode: "manual",
  label: "Manual baseline",
  description: "Today's phone/email chase. Assumed from interviews and the Nov 18-19 ops chat; not measured.",
  metrics: {
    minutesToResolution: { value: minutesFromDk(etToIso(SCENARIO_DATE, "13:40:00")), basis: "assumed", note: "DK 08:16 → settled ~13:40: client reply ~10:30, GS fails desk found and told ~11:30, late-instruction exception needed" },
    turns: { value: 11, basis: "assumed", note: "emails and calls across BNY, AllianzGI and Goldman" },
    toolCalls: { value: 0, basis: "assumed", note: "manual screen lookups" },
    humanApprovals: { value: 2, basis: "assumed" },
    escalations: { value: 1, basis: "assumed", note: "flagged to team lead" },
    fieldsShared: { value: 9, basis: "assumed", note: "free-text email typically includes client, fund and instruction details" },
    tokens: { value: 0, basis: "assumed" },
    costUsd: { value: 0, basis: "assumed" },
  },
  fieldsSharedList: ["dtc_reference", "isin", "quantity", "settle_date", "instruction_id", "participant", "client name", "fund", "account"],
};

export function a2aRow(rec: Recording): BenchmarkRow {
  const shared = new Set<string>();
  for (const a of rec.audit) if (a.action.startsWith("outbound")) a.fieldsShared.forEach((f) => shared.add(f));
  const approvals = rec.events.filter((e) => e.kind === "approval").length;
  const escalations = rec.events.filter((e) => e.kind === "escalation" && e.lane === "network").length;
  const tokens = rec.summary.budget.tokensIn + rec.summary.budget.tokensOut;
  return {
    mode: "a2a",
    label: "A2A (this design)",
    description: `Full multi-agent run ${rec.runId} (${rec.recordedMode === "live" ? `live, ${rec.model}` : "mock model"}).`,
    metrics: {
      minutesToResolution: { value: minutesFromDk(rec.summary.clock), basis: "scripted", note: `DK 08:16 → settled ${fmtEt(rec.summary.clock)}; human review times are scripted assumptions` },
      turns: { value: rec.summary.turns, basis: "measured", note: "cross-firm messages through the gateway" },
      toolCalls: { value: rec.toolCalls, basis: "measured" },
      humanApprovals: { value: approvals, basis: "measured" },
      escalations: { value: escalations, basis: "measured" },
      fieldsShared: { value: shared.size, basis: "measured", note: "distinct fields BNY sent across the boundary" },
      tokens: { value: tokens, basis: rec.recordedMode === "live" ? "measured" : "assumed", note: rec.recordedMode === "live" ? "API usage fields" : "mock model: approximate token counts" },
      costUsd: { value: rec.summary.budget.spentUsd, basis: rec.recordedMode === "live" ? "measured" : "assumed" },
    },
    fieldsSharedList: [...shared],
  };
}

/** Single BNY agent with all BNY tools but no channel to Goldman: drafts an email and waits. */
export async function runSingleAgent(mode: "live" | "mock", client?: ModelClient): Promise<{ row: BenchmarkRow; emails?: Email[] }> {
  const cfg = getConfig();
  const budget = new Budget(cfg.costLimitUsd, "benchmark single-agent");
  const run = new Run("golden", mode, cfg.model, budget);
  run.fast = true;
  attachModel(run, modelContextFor(mode, cfg, budget, client));
  const bny = scopeFor("bny");
  const ctx = { run, scope: bny, actor: ACTORS.bnyCaseRule };
  // It only learns of the DK from BNY's own exception tracker, not from Goldman.
  // Today's open DK (older open DKs belong to earlier settlement dates).
  const exception = bny
    .read("bny/fails_exceptions")
    .filter((x) => x.status === "OPEN" && x.fail_reason === "DK_QTY_MISMATCH" && x.dtc_reference && x.detected_ts_et.raw.startsWith(SCENARIO_DATE))
    .sort((a, b) => b.detected_ts_et.utc.getTime() - a.detected_ts_et.utc.getTime())[0];
  const dtcEvent = exception && bny.read("dtc/settlement_activity").find((e) => e.dtc_reference === exception.dtc_reference);
  const bc = dtcEvent && investigateDelivery(ctx, { dtcReference: dtcEvent.dtc_reference, isin: dtcEvent.isin, settleDate: SCENARIO_DATE });
  if (!bc) throw new Error("Golden case missing from BNY data");
  const proc = proceduresExcerpt(ctx);
  let detail = "";
  let emails: Email[] | undefined;
  let escalations = 0;
  let fields: string[] = [];
  try {
    const out = await singleAgent(run, bc.records, proc.text);
    const g = validateFindings(bny, out.findings);
    if (!g.ok) escalations++;
    emails = [out.clientEmail, out.counterpartyEmail];
    // Only what goes to the counterparty crosses the firm boundary.
    fields = disclosedFields(`${out.counterpartyEmail.subject}\n${out.counterpartyEmail.body}`, sensitiveTerms(bc));
    detail = out.diagnosis;
  } catch (e) {
    if (!(e instanceof BudgetExceededError || e instanceof AgentOutputError)) throw e;
    escalations++;
    detail = (e as Error).message;
  }
  const settleAt = etToIso(SCENARIO_DATE, "12:20:00");
  return {
    emails,
    row: {
      mode: "single",
      label: "Single agent with tools",
      description: "One BNY agent with every BNY tool but no channel to Goldman: it drafts emails to the client and the counterparty and waits for replies.",
      metrics: {
        minutesToResolution: { value: minutesFromDk(settleAt), basis: "assumed", note: "agent ready ~09:10; client reply ~10:30; finding and briefing the right GS contact ~60 min; redelivery; settles ~12:20" },
        turns: { value: 6, basis: "assumed", note: "client email and reply, counterparty email, follow-up, fix time, redelivery notice" },
        toolCalls: { value: run.toolCalls, basis: "measured" },
        humanApprovals: { value: 2, basis: "assumed", note: "BNY client service + GS ops" },
        escalations: { value: escalations, basis: "measured" },
        fieldsShared: { value: fields.length, basis: "measured", note: "fields detected in the drafted email" },
        tokens: { value: budget.tokensIn + budget.tokensOut, basis: mode === "live" ? "measured" : "assumed" },
        costUsd: { value: budget.spentUsd, basis: mode === "live" ? "measured" : "assumed" },
      },
      fieldsSharedList: fields,
      detail,
    },
  };
}

const benchFile = (mode: string) => path.join(/*turbopackIgnore: true*/ process.cwd(), "runs", `benchmark-${mode}.json`);

export async function runBenchmark(mode: "live" | "mock" | "replay"): Promise<BenchmarkResult> {
  const cfg = getConfig();
  if (mode === "replay") {
    for (const m of ["live", "mock"]) if (fs.existsSync(benchFile(m))) return JSON.parse(fs.readFileSync(benchFile(m), "utf8"));
    throw new StartError("No saved benchmark in runs/. Run `npm run record` or use live/mock mode.");
  }
  if (mode === "live") {
    const p = liveProblems(cfg);
    if (p.length) throw new StartError(`Live mode cannot start:\n${p.join("\n")}`);
  }
  const rec = findRecording("golden", (r) => r.summary.status === "settled");
  if (!rec) throw new StartError("Run the golden case to settlement once (live or mock) so its measurements can be compared.");
  const single = await runSingleAgent(mode);
  const result: BenchmarkResult = { createdAt: new Date().toISOString(), mode, model: cfg.model, dkAt: DK_AT, rows: [MANUAL_BASELINE, single.row, a2aRow(rec)], emails: single.emails };
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  fs.writeFileSync(benchFile(mode), JSON.stringify(result, null, 1));
  return result;
}

export function latestBenchmark(): BenchmarkResult | null {
  const files = ["live", "mock"].map(benchFile).filter((f) => fs.existsSync(f));
  const all = files.map((f) => JSON.parse(fs.readFileSync(f, "utf8")) as BenchmarkResult).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return all[0] ?? null;
}
