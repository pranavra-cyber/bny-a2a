// BNY deterministic tools: lookups for the Settlement Ops and Client Team agents,
// and the mock settlement system that applies the client's corrected instruction.
// State changes go to the run's overlay; the data files are never modified.
import "server-only";
import type { ClientAccount, FailException, SettlementInstruction, SsiCounterparty } from "../data/bny";
import type { DtcEvent } from "../data/dtc";
import { displayRow } from "../data/scope";
import type { ResolvedRecord } from "../engine/types";
import { accessed, accessedDoc, section, type ToolCtx } from "./common";

export type BnyCase = {
  dtcEvents: DtcEvent[];
  exception: FailException | undefined;
  instruction: SettlementInstruction;
  /** Any later instruction from the client that amends this one (none in the golden case). */
  amendment: SettlementInstruction | undefined;
  account: ClientAccount | undefined;
  /** BNY's active SSI for the counterparty: confirms the delivering participant is the one on file. */
  ssi: SsiCounterparty | undefined;
  records: ResolvedRecord[];
};

const LIVE = new Set(["SENT_TO_DTC", "MATCHED", "PENDING_SETTLEMENT", "ENRICHED"]);

/**
 * Settlement Ops Agent lookups, starting only from what the counterparty sent: the
 * DTC reference, ISIN and settlement date. BNY's exception record links the DK'd
 * delivery to the live instruction; amendments are found via amends_instruction_id.
 */
export function investigateDelivery(ctx: ToolCtx, req: { dtcReference: string; isin: string; settleDate: string }): BnyCase | null {
  const s = ctx.scope;
  const dtcEvents = s.read("dtc/settlement_activity").filter((e) => e.dtc_reference === req.dtcReference);
  const records = [...accessed(ctx, "getDtcEvents", "dtc/settlement_activity", dtcEvents)];
  if (!dtcEvents.length) return null;

  const exception = s.read("bny/fails_exceptions").find((x) => x.dtc_reference === req.dtcReference);
  if (exception) records.push(...accessed(ctx, "getException", "bny/fails_exceptions", [exception]));

  const instructions = s.read("bny/settlement_instructions");
  const instruction =
    (exception && instructions.find((i) => i.instruction_id === exception.instruction_id)) ||
    instructions.find(
      (i) =>
        i.isin === req.isin &&
        i.settle_date === req.settleDate &&
        i.direction === "RVP" &&
        i.cpty_dtc_participant === dtcEvents[0].deliverer_participant &&
        LIVE.has(i.status) &&
        i.quantity !== dtcEvents[0].quantity,
    );
  if (!instruction) return null;
  records.push(...accessed(ctx, "getInstruction", "bny/settlement_instructions", [instruction]));

  const amendment = instructions.find((i) => i.amends_instruction_id === instruction.instruction_id);
  // Searching for an amendment is a lookup even when nothing comes back.
  records.push(...accessed(ctx, "findAmendments", "bny/settlement_instructions", amendment ? [amendment] : []));

  const account = s.read("bny/client_accounts").find((a) => a.account_id === instruction.client_account_id);
  if (account) records.push(...accessed(ctx, "getClientAccount", "bny/client_accounts", [account]));

  const ssi = s
    .read("bny/ssi_counterparties")
    .find((x) => x.counterparty_name === instruction.counterparty_name && x.market === "US" && x.asset_class === "EQUITY" && x.status === "ACTIVE");
  if (ssi) records.push(...accessed(ctx, "getCounterpartySsi", "bny/ssi_counterparties", [ssi]));

  return { dtcEvents, exception, instruction, amendment, account, ssi, records };
}

/** What the procedures say about cutoffs and escalation (for the agents and the assistant). */
export function proceduresExcerpt(ctx: ToolCtx): { text: string; record?: ResolvedRecord } {
  const doc = ctx.scope.doc("settlement_operations_procedures");
  if (!doc) return { text: "" };
  const text = ["Matching and DKs", "Cutoffs", "Escalation"].map((h) => section(doc.markdown, h)).filter(Boolean).join("\n\n");
  return { text, record: accessedDoc(ctx, "readProcedures", doc.name, text) };
}

/** Client Team Agent lookups: the client's service terms and contacts. */
export function clientContext(ctx: ToolCtx, c: BnyCase) {
  const sla = ctx.scope.doc("allianzgi_service_level_summary");
  const terms = sla ? [section(sla.markdown, "Settlement standards"), section(sla.markdown, "Communication")].filter(Boolean).join("\n\n") : "";
  const records: ResolvedRecord[] = [];
  if (sla) records.push(accessedDoc(ctx, "readServiceTerms", sla.name, terms));
  if (c.account) records.push(...accessed(ctx, "getClientAccount", "bny/client_accounts", [c.account]));
  return { terms, records };
}

/** Client-facing fields: the client's own trade details, which BNY may share with the client. */
export function clientFields(c: BnyCase, delivered: number) {
  return {
    fund: c.account?.fund_name ?? c.instruction.client_account_id,
    account: c.instruction.client_account_id,
    client_ref: c.instruction.client_ref,
    isin: c.instruction.isin,
    counterparty: c.instruction.counterparty_name,
    settle_date: c.instruction.settle_date,
    quantity_instructed: c.instruction.quantity,
    quantity_delivered: delivered,
    instruction_id: c.instruction.instruction_id,
    source_channel: c.instruction.source_channel,
  };
}

export const CORRECTED_INSTRUCTION_ID = "BNYI-20261119-5531207";

export type ReinstructResult = { replaced: string; instruction: Record<string, string> };

/**
 * BNY Settlement System (mock): the client's corrected MT541 arrives. It replaces the
 * old instruction, which is cancelled; nobody at BNY changes the instruction by hand.
 */
export function applyClientInstruction(ctx: ToolCtx, c: BnyCase, quantity: number, receivedIso: string): ReinstructResult {
  const old = displayRow(c.instruction);
  const at = receivedIso;
  const amount = Math.round((c.instruction.settlement_amount / c.instruction.quantity) * quantity * 100) / 100;
  const instruction = {
    ...old,
    instruction_id: CORRECTED_INSTRUCTION_ID,
    received_ts_et: at,
    source_channel: "SWIFT_MT541",
    quantity: String(quantity),
    settlement_amount: String(Math.round(amount * 100) / 100),
    amends_instruction_id: c.instruction.instruction_id,
    status: "SENT_TO_DTC",
    status_ts_et: at,
  };
  ctx.run.overlay.set(`bny/settlement_instructions#${CORRECTED_INSTRUCTION_ID}`, instruction);
  ctx.run.overlay.set(`bny/settlement_instructions#${c.instruction.instruction_id}`, { ...old, status: "CANCELLED", status_ts_et: at });
  ctx.run.toolCalls++;
  ctx.run.log({
    actor: ctx.actor.name,
    actorType: "RULE",
    firm: "bny",
    action: "apply client instruction",
    dataAccessed: [`bny/settlement_instructions#${c.instruction.instruction_id}`],
    fieldsShared: [],
    decision: `client MT541 ${CORRECTED_INSTRUCTION_ID} (qty ${quantity}) replaces ${c.instruction.instruction_id}, now cancelled`,
    approver: "",
  });
  return { replaced: c.instruction.instruction_id, instruction };
}

/** Values that must never be disclosed to a counterparty for this case. */
export function sensitiveTerms(c: BnyCase): string[] {
  return [
    c.account?.client_legal_name,
    c.account?.fund_name,
    c.account?.fund_name.replace(/\s*\(synthetic\)\s*$/, ""), // the name as people write it
    c.account?.client_short_code,
    c.account?.account_id,
    c.instruction.client_ref,
    c.account?.fund_name.split(" ")[0], // brand name the fund trades under, e.g. "AllianzGI"
    "allocation",
    "amendment",
    "amended",
    "repair queue",
  ].filter((t): t is string => Boolean(t));
}

export type { SsiCounterparty };
