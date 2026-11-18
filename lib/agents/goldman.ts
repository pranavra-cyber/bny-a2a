// Goldman Sachs agents (LLM steps). They decide what to say; deterministic
// tools did the lookups. Each has a scripted mock decision for mock mode/tests.
import "server-only";
import { z } from "zod";
import type { Run } from "../engine/run";
import { registerMock } from "../llm/client";
import type { GsCase } from "../tools/goldman";
import { ACTORS, agentCall, cite, CITE_RULE, compact, findingSchema, rowOf } from "./shared";

const GS_COLS = {
  fails: ["gs_fail_id", "delivery_id", "fail_reason", "opened_ts_utc", "exposure_usd", "owner", "status"],
  deliveries: ["delivery_id", "gs_trade_ref", "dtc_reference", "from_participant", "to_participant", "isin", "quantity", "settlement_amount", "status", "status_ts_utc", "dk_reason"],
  trade_blotter: ["gs_trade_ref", "client_name", "client_side", "ticker", "isin", "quantity", "price", "trade_date", "settle_date"],
  allocations_confirms: ["alloc_id", "gs_trade_ref", "quantity", "custodian_name", "custodian_dtc_participant", "ctm_confirm_id", "affirmed", "version", "status"],
  "dtc/settlement_activity": ["dtc_reference", "event_ts_et", "deliverer_participant", "receiver_participant", "quantity", "event", "reason_code"],
  inventory: ["isin", "box_location", "quantity_available"],
};

const rowsOf = (c: GsCase) => compact(c.records, GS_COLS);

// ---------- Fails Monitor summary ----------
const summarySchema = z.object({ summary: z.string(), findings: z.array(findingSchema) });

registerMock("gs_fail_summary", (input) => {
  const { records } = JSON.parse(input);
  const f = rowOf(records, "fails")!;
  const d = rowOf(records, "deliveries")!;
  return {
    summary: `Delivery ${d.delivery_id} of ${Number(d.quantity).toLocaleString("en-US")} shares to participant ${d.to_participant} was DK'd (${d.dk_reason}); fail ${f.gs_fail_id} is open and unassigned with $${Number(f.exposure_usd).toLocaleString("en-US")} exposure.`,
    findings: [
      { claim: "The receiver DK'd the delivery for quantity mismatch", sourceRecords: cite(d, "status", "dk_reason") },
      { claim: "The fail is open and unassigned", sourceRecords: cite(f, "status", "fail_reason") },
    ],
  };
});

export function summarizeFail(run: Run, c: GsCase) {
  return agentCall(run, ACTORS.gsMonitor, "goldman", {
    schemaName: "gs_fail_summary",
    schema: summarySchema,
    maxOutputTokens: 800,
    system: `You are Goldman Sachs' Fails Monitor. Summarize this fail for the fails desk in at most two sentences. ${CITE_RULE}`,
    input: JSON.stringify({ records: rowsOf(c) }),
  });
}

// ---------- Outreach: compose the A2A request ----------
// The structured fields are copied from Goldman's records by code; the agent only
// writes the message and cites what it relies on.
export function requestFields(c: GsCase) {
  return {
    dtc_reference: c.delivery.dtc_reference,
    counterparty_trade_ref: c.trade.gs_trade_ref, // Goldman's own refs, shared so BNY can quote them back
    counterparty_fail_ref: c.fail.gs_fail_id,
    isin: c.delivery.isin,
    quantity_delivered: c.delivery.quantity,
    settle_date: c.trade.settle_date,
    deliverer_participant: c.delivery.from_participant,
    dk_reason: c.delivery.dk_reason ?? "",
    confirm_quantity: c.allocation.quantity,
    confirm_status: c.allocation.affirmed === "Y" ? "AFFIRMED" : c.allocation.status,
    requested_action: "explain_dk_and_confirm_redelivery",
  };
}

export const outreachRequestSchema = z.object({
  message: z.string().describe("Short request to the receiving custodian's agent"),
  findings: z.array(findingSchema),
});

registerMock("gs_outreach_request", (input) => {
  const { records, receiver, attachedFields: x } = JSON.parse(input);
  const d = rowOf(records, "deliveries")!;
  const t = rowOf(records, "trade_blotter")!;
  const a = rowOf(records, "allocations_confirms")!;
  return {
    message: `Hello ${receiver}. Our DVP delivery ${x.dtc_reference} of ${Number(x.quantity_delivered).toLocaleString("en-US")} ${t.ticker} (${x.isin}) for settlement ${x.settle_date} was DK'd by your side for ${x.dk_reason}. Our confirm is affirmed at ${Number(a.quantity).toLocaleString("en-US")}. Please tell us what quantity you are instructed to receive and whether we should redeliver before cutoff.`,
    findings: [
      { claim: "Delivery was DK'd for quantity mismatch", sourceRecords: cite(d, "dtc_reference", "quantity", "dk_reason") },
      { claim: "Confirm affirmed at the delivered quantity", sourceRecords: cite(a, "quantity", "affirmed", "status") },
    ],
  };
});

export function composeRequest(run: Run, c: GsCase, receiverName: string) {
  return agentCall(run, ACTORS.gsOutreach, "goldman", {
    schemaName: "gs_outreach_request",
    schema: outreachRequestSchema,
    system:
      "You are Goldman Sachs' Counterparty Outreach Agent. Write a short, professional request to the receiving custodian's agent asking why the delivery was DK'd and whether to redeliver before cutoff. " +
      "The attachedFields are sent with your message automatically; refer to them as needed. Do not include client names or allocation ids in the message. " +
      CITE_RULE,
    input: JSON.stringify({ receiver: receiverName, attachedFields: requestFields(c), records: rowsOf(c) }),
  });
}

// ---------- Outreach: interpret BNY's reply ----------
const interpretSchema = z.object({
  summary: z.string(),
  action: z.enum(["hold", "redeliver", "escalate"]).describe("hold: keep our side as is and wait; redeliver: propose a redelivery to GS ops"),
  quantity: z.number().describe("Quantity to redeliver, or 0 when holding"),
  findings: z.array(findingSchema),
});

registerMock("gs_outreach_interpret", (input) => {
  const { shared, records } = JSON.parse(input);
  const d = rowOf(records, "deliveries")!;
  const inv = rowOf(records, "inventory");
  if (shared.requested_action !== "redeliver")
    return {
      summary: `BNY is waiting for its client to re-instruct${shared.expected_fix_time ? `, expected by ${shared.expected_fix_time}` : ""}, and asks us to hold. Our delivery matches the affirmed confirm, so we keep our side as is.`,
      action: "hold",
      quantity: 0,
      findings: [{ claim: "Our delivery quantity matches the trade", sourceRecords: cite(d, "quantity", "status") }],
    };
  const qty = Number(shared.quantity_instructed);
  const available = inv ? Number(inv.quantity_available) : qty;
  return {
    summary: `BNY now instructs ${qty.toLocaleString("en-US")} (${shared.instruction_status}) and asks us to redeliver; ${available.toLocaleString("en-US")} shares are available in our DTC box.`,
    action: qty === Number(d.quantity) && available >= qty ? "redeliver" : "escalate",
    quantity: qty,
    findings: [
      { claim: "Original delivery quantity matches BNY's new instructed quantity", sourceRecords: cite(d, "quantity") },
      ...(inv ? [{ claim: "Box has enough shares to redeliver", sourceRecords: cite(inv, "quantity_available") }] : []),
    ],
  };
});

export function interpretReply(run: Run, c: GsCase, shared: Record<string, unknown>, text: string) {
  return agentCall(run, ACTORS.gsOutreach, "goldman", {
    schemaName: "gs_outreach_interpret",
    schema: interpretSchema,
    maxOutputTokens: 1200,
    system:
      "You are Goldman Sachs' Counterparty Outreach Agent. The receiving custodian replied. If it asks us to hold while its client re-instructs, choose hold and keep our side as is. " +
      "If it asks us to redeliver, propose a redelivery to Goldman ops if its instructed quantity (in shared) matches our trade quantity and our box has the shares; otherwise escalate. " +
      "The shared fields are the custodian's own statement through a verified gateway: take them as given, since you cannot and need not verify the custodian's records. Cite only our own records for our side. " +
      CITE_RULE,
    input: JSON.stringify({ shared, replyText: text, records: rowsOf(c) }),
  });
}

// ---------- Outreach: follow-up (FP3 reference request, FP4 status chase) ----------
const followUpSchema = z.object({
  message: z.string(),
  claimReference: z.string().nullable().describe("A BNY record id supporting the claim, or null if Goldman has none"),
});

registerMock("gs_outreach_followup", (input) => {
  const { purpose, turn } = JSON.parse(input);
  if (purpose === "reference")
    return { message: "We do not hold a BNY record id for that confirmation; it was our understanding from yesterday's call.", claimReference: null };
  return {
    message: `Follow-up ${turn}: our 10,000 delivery is still DK'd and we have no fix time yet. Please confirm when your client will re-instruct; our confirm is affirmed at 10,000.`,
    claimReference: null,
  };
});

export function followUp(run: Run, c: GsCase, purpose: "reference" | "chase", bnyText: string, turn: number) {
  return agentCall(run, ACTORS.gsOutreach, "goldman", {
    schemaName: "gs_outreach_followup",
    schema: followUpSchema,
    maxOutputTokens: 700,
    system:
      purpose === "reference"
        ? "You are Goldman Sachs' Counterparty Outreach Agent. The custodian asks for the record reference behind your claim. Give a BNY record id only if one appears in your records; otherwise set claimReference to null and say so."
        : "You are Goldman Sachs' Counterparty Outreach Agent. Your delivery is still DK'd and the custodian has not given a fix time. Write a one-sentence follow-up asking when its client will re-instruct. Set claimReference to null.",
    input: JSON.stringify({ purpose, turn, custodianReply: bnyText, records: rowsOf(c).filter((r) => r.table !== "inventory") }),
  });
}
