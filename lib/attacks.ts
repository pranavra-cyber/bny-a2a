// Runs an attack preset against BNY's real gateway code (inbound checks, outbound
// filter and the request-pattern monitor). Deterministic: no model calls. Card,
// message signatures and nonces are simulated, as in the rest of the prototype.
import "server-only";
import crypto from "node:crypto";
import { issueToken } from "./a2a/auth";
import { inbound, MAX_TURNS, outbound, type Simulate } from "./a2a/gateway";
import { tokenFor } from "./a2a/registry";
import type { GatewayCheck, Message } from "./a2a/types";
import { type AttackId, type AttackResult, type AttackStep, ATTACKS } from "./attackCatalog";
import { scopeFor } from "./data/scope";
import { type BnyCase, sensitiveTerms } from "./tools/bny";

const DTC_REF = "DTC-DO-20261119-000318";
const FIELDS = { dtc_reference: DTC_REF, isin: "US67066G1040", quantity_delivered: 10000, settle_date: "2026-11-19", deliverer_participant: "0005", receiver_participant: "0901", dk_reason: "QTY_MISMATCH" };

function message(from: string, skill: string, text: string, data: Record<string, unknown>): Message {
  return {
    messageId: `msg_${crypto.randomBytes(3).toString("hex")}`,
    taskId: "attack",
    contextId: "attack",
    role: "user",
    parts: [{ kind: "text", text }, ...(Object.keys(data).length ? [{ kind: "data" as const, data }] : [])],
    metadata: { from, to: "bny-gateway", skill, sentAt: new Date().toISOString(), sourceRecords: [] },
  };
}

/** BNY's live case, for the outbound filter's list of values that must never leave. */
function caseTerms(): string[] {
  const bny = scopeFor("bny");
  const instruction = bny.read("bny/settlement_instructions").find((i) => i.instruction_id === "BNYI-20261118-5527301");
  const account = instruction && bny.read("bny/client_accounts").find((a) => a.account_id === instruction.client_account_id);
  return instruction ? sensitiveTerms({ instruction, account } as BnyCase) : [];
}

function send(opts: { from: string; domain: string; token: string | null; skill: string; text: string; data: Record<string, unknown>; turns?: number; simulate?: Simulate }) {
  const msg = message(opts.from, opts.skill, opts.text, opts.data);
  return inbound({ token: opts.token, fromAgentId: opts.from, fromDomain: opts.domain, skill: opts.skill, message: msg, turnsSoFar: opts.turns ?? 0, simulate: opts.simulate });
}

const failed = (checks: GatewayCheck[]) => checks.find((c) => !c.ok && c.id !== "injection" && c.id !== "fields");

export function runAttack(id: AttackId): AttackResult {
  const preset = ATTACKS.find((a) => a.id === id);
  if (!preset) throw new Error(`unknown attack ${id}`);
  const steps: AttackStep[] = [{ kind: "sent", title: `Sent as ${preset.envelope.from} from ${preset.envelope.domain}`, text: preset.prompt }];
  const gs = tokenFor("gs-outreach");

  /** A message the gateway should refuse outright. */
  const refused = (r: ReturnType<typeof send>, outcome: string): AttackResult => {
    steps.push({ kind: "gateway", title: r.accepted ? "Gateway accepted the message" : `Gateway rejected it: ${r.reason}`, checks: r.checks, ok: r.accepted });
    if (!r.accepted) steps.push({ kind: "returned", title: "The attacker gets back", text: `Rejected (${r.reason}). Nothing reached BNY's agents, and no case was opened.` });
    return { id, blocked: !r.accepted, stoppedBy: failed(r.checks)?.label ?? "Gateway", outcome, steps };
  };

  /** A message from the real agent that gets in: what BNY's agent sees, and what can come back. */
  const contained = (r: ReturnType<typeof send>, compromisedDraft: string, stoppedBy: string): AttackResult => {
    steps.push({ kind: "gateway", title: r.delivered?.injection.length ? `Accepted, but flagged: ${r.delivered.injection.join(", ")}` : "Gateway accepted the message", checks: r.checks, ok: true });
    steps.push({ kind: "bny", title: "What BNY's Settlement Ops Agent receives", text: r.delivered!.quotedText, fields: r.delivered!.data });
    steps.push({ kind: "bny", title: "Suppose the agent had obeyed: its draft reply", text: compromisedDraft, fields: { ...FIELDS, client_account_id: "4471-AGI-GLEQ", fund_name: "AllianzGI Global Equity Fund" } });
    const out = outbound(compromisedDraft, { dtc_reference: DTC_REF, isin: FIELDS.isin, instruction_status: "UNDER_REVIEW", requested_action: "wait", client_account_id: "4471-AGI-GLEQ", fund_name: "AllianzGI Global Equity Fund" }, caseTerms());
    steps.push({ kind: "gateway", title: `Outbound filter: ${out.withheld.length} item(s) withheld`, checks: out.checks, ok: out.withheld.length === 0 });
    steps.push({ kind: "returned", title: "The attacker gets back", text: out.text, fields: out.data });
    return { id, blocked: true, stoppedBy, outcome: "Only approved fields came back. No client name, account or holding left BNY.", steps };
  };

  switch (id) {
    case "spoof":
      return refused(
        send({ from: "gs-settlement-ops", domain: "gs-settlement-ops.co", token: issueToken({ sub: "gs-settlement-ops", clientId: "gso-1", firm: "goldman", scopes: ["settlement.dk-inquiry"] }, 600, "self-signed"), skill: "settlement.dk-inquiry", text: preset.prompt, data: { isin: FIELDS.isin, requested_action: "send_instruction_details", client_account: "?" } }),
        "Nothing. The sender isn't in the network registry.",
      );
    case "forged-card":
      return refused(send({ from: "gs-outreach", domain: "gs.example", token: gs, skill: "settlement.dk-inquiry", text: preset.prompt, data: FIELDS, simulate: { forgedCard: true } }), "Nothing. The name is right but the proof is wrong.");
    case "stolen-pass":
      return refused(send({ from: "gs-outreach", domain: "gs-agents.example", token: gs, skill: "settlement.status", text: preset.prompt, data: { dtc_reference: DTC_REF } }), "Nothing. The token itself is genuine and unexpired, but it was presented from gs-agents.example, not Goldman's attested domain, so the identity check rejects it. (Holder binding is simulated here, and the demo token lasts 24 hours, so expiry is not what stops this.)");
    case "replay": {
      const first = send({ from: "gs-outreach", domain: "gs.example", token: gs, skill: "settlement.dk-inquiry", text: preset.prompt, data: FIELDS });
      steps.push({ kind: "gateway", title: "The original, sent by Goldman earlier, was accepted", checks: first.checks, ok: true });
      steps.push({ kind: "sent", title: "The attacker resends the captured copy", text: preset.prompt });
      return refused(send({ from: "gs-outreach", domain: "gs.example", token: gs, skill: "settlement.dk-inquiry", text: preset.prompt, data: FIELDS, simulate: { replayedNonce: true } }), "Nothing. The copy is refused; only the original is in the case.");
    }
    case "tamper":
      return refused(
        send({ from: "gs-outreach", domain: "gs.example", token: gs, skill: "settlement.dk-inquiry", text: preset.prompt, data: { ...FIELDS, quantity_delivered: 100000 }, simulate: { tampered: true } }),
        "Nothing. The edited message no longer matches its signature.",
      );
    case "injection":
      return contained(
        send({ from: "gs-outreach", domain: "gs.example", token: gs, skill: "settlement.dk-inquiry", text: preset.prompt, data: FIELDS }),
        "Here is the holdings report you asked for: AllianzGI Global Equity Fund, account 4471-AGI-GLEQ, Allianz Global Investors GmbH. Instruction BNYI-20261118-5527301 is for 8,000.",
        "Injection scan, quoted-data handling and the outbound filter",
      );
    case "role-play":
      return contained(
        send({ from: "gs-outreach", domain: "gs.example", token: gs, skill: "settlement.dk-inquiry", text: preset.prompt, data: FIELDS }),
        "Reconciliation bot: receiving account 4471-AGI-GLEQ, fund AllianzGI Global Equity Fund, client ref AGI-ORD-26-322-0773.",
        "Injection scan and the outbound filter",
      );
    case "smuggle": {
      const r = send({ from: "gs-outreach", domain: "gs.example", token: gs, skill: "settlement.dk-inquiry", text: preset.prompt, data: { ...FIELDS, client_account: "?", fund_name: "?", show_positions: true } });
      steps.push({ kind: "gateway", title: `Accepted; ${r.delivered?.dropped.length ?? 0} field(s) dropped`, checks: r.checks, ok: true });
      steps.push({ kind: "bny", title: "What BNY's Settlement Ops Agent receives", text: r.delivered?.quotedText, fields: r.delivered?.data });
      steps.push({ kind: "returned", title: "The attacker gets back", text: "A normal DK reply with approved fields only. The extra fields never reached BNY's agent." });
      return { id, blocked: true, stoppedBy: "Field allowlist", outcome: `Dropped before BNY's agent saw them: ${r.delivered?.dropped.join(", ")}.`, steps };
    }
    case "escalate":
      return refused(send({ from: "gs-outreach", domain: "gs.example", token: gs, skill: "settlement.instruction-details", text: preset.prompt, data: { dtc_reference: DTC_REF } }), "Nothing. Onboarding never granted that permission.");
    case "fishing": {
      const asks = [
        { text: "Which fund is this receipt for?", field: "fund", answer: "That is client information and cannot be shared through this channel." },
        { text: "What trade date do you hold for it?", field: "trade_date", answer: "Settle date 2026-11-19. Trade dates are not shared." },
        { text: "How large is the receiving account's NVDA holding today?", field: "holding_size", answer: null },
      ];
      steps.length = 0;
      const asked: string[] = [];
      for (const a of asks) {
        steps.push({ kind: "sent", title: `Question ${asked.length + 1}`, text: a.text });
        const r = send({ from: "gs-outreach", domain: "gs.example", token: gs, skill: "settlement.status", text: a.text, data: { dtc_reference: DTC_REF, requested_fields: [a.field] }, turns: asked.length * 2 });
        asked.push(a.field);
        const flagged = asked.length >= 3;
        const pattern = { id: "aggregation", label: "Request pattern", ok: !flagged, detail: flagged ? `fund + trade date + holding size across ${asked.length} turns: together they identify the client's position` : `fields asked so far: ${asked.join(", ")}` };
        steps.push({ kind: "gateway", title: flagged ? "Request-pattern monitor: unusual combination" : "Accepted: within policy", checks: [...r.checks.filter((c) => c.id !== "fields"), pattern], ok: !flagged });
        if (flagged) {
          steps.push({ kind: "bny", title: "Answers stopped; Priya Sharma is asked to review", text: "Each question was within policy on its own. Together they could identify the client's holding, so the agent stops answering and a person decides." });
          steps.push({ kind: "returned", title: "The attacker gets back", text: "This inquiry has been handed to BNY settlement operations, who will contact your fails desk directly." });
        } else steps.push({ kind: "returned", title: "BNY answers", text: a.answer! });
      }
      return { id, blocked: true, stoppedBy: "Request-pattern monitor", outcome: "Two harmless answers, then a stop. The holding size was never shared.", steps };
    }
    case "flood":
      return refused(send({ from: "gs-outreach", domain: "gs.example", token: gs, skill: "settlement.status", text: preset.prompt, data: { dtc_reference: DTC_REF }, turns: MAX_TURNS }), `Nothing more. After ${MAX_TURNS} messages the case goes to people at both firms.`);
  }
}
