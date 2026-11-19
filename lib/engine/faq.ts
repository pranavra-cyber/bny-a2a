// What each assistant knows beyond the case activity: the cutoffs, what happens if
// they are missed, who can change what, and what crosses the boundary. Drawn from
// the firms' procedures in data/*/docs. Used two ways: as knowledge for the live
// model, and as grounded answers when no model runs (replay, mock, budget spent).
import { fmtDuration, fmtEt } from "../time";
import { type Seat, CLIENT_CONTACT } from "./guide";
import { CUTOFF, DTC_CLOSE, LATE_EXCEPTION_CUTOFF } from "./run";

export type Facts = { nowIso: string; seat: Seat; status: string };

const left = (nowIso: string, iso: string) => {
  const ms = new Date(iso).getTime() - new Date(nowIso).getTime();
  return ms > 0 ? `${fmtDuration(ms)} from now` : "already passed";
};

/** Knowledge block for the live assistant, per seat. */
export function knowledgeFor(f: Facts): string {
  const common = [
    `Now: ${fmtEt(f.nowIso)}.`,
    "Trade: 10,000 NVDA (US67066G1040), Goldman Sachs selling to a BNY client, DVP $1,862,600.00, settling today 19 Nov 2026. Goldman delivered 10,000 at 08:15 ET; BNY's receiving system DK'd it at 08:16 ET because BNY's instruction from its client is for 8,000.",
  ];
  if (f.seat === "goldman")
    return [
      ...common,
      "Goldman fails desk procedures: same day over USD 1m, desk lead informed by 15:00 UTC (10:00 ET). If the fail ages 1 day: client coverage informed, CSDR-style penalty and buy-in exposure assessed. 3 days: head of fails, borrow or buy-in decision. 5+ days: regional ops management.",
      "Goldman cannot change the custodian's instruction. Its delivery matches the affirmed CTM confirm (10,000), so its side is correct; it holds and redelivers when BNY asks.",
      "DTC DVP processing ends 15:10 ET. A redelivery after that cannot settle today.",
      "What BNY may send Goldman: dtc_reference, isin, quantity_instructed, settle_date, instruction_status, expected_fix_time, requested_action. Never client names, accounts or internal ids.",
    ].join("\n");
  return [
    ...common,
    "BNY settlement procedures, cutoffs (ET): client instructions for same-day DVP settlement 11:30; repair items 14:30; late-instruction exception approval by a manager 14:45; DTC DVP processing ends 15:10; Fedwire 15:15.",
    "If the client's corrected instruction arrives after 11:30 ET, it can still settle today only with a late-instruction exception approved by a manager (Priya Sharma) by 14:45 ET. If it has not settled when DTC closes at 15:10 ET, the trade fails overnight: it goes to the 15:30 daily fails call, and the counterparty keeps an open fail that ages.",
    "Escalation: item over USD 1m within 2 hours of cutoff → team lead. Tier-1 client item at risk of missing cutoff → team lead and Service Executive. Counterparty unresponsive 60 minutes on a DK → team lead and a call with the counterparty's fails desk.",
    "AllianzGI is a tier-1 client. Service terms: notify any trade at risk of failing by 10:00 ET on settlement date; notify an actual fail within 30 minutes; every fail notice includes fund, ISIN, quantity, counterparty, reason, next action and expected resolution time.",
    `BNY cannot change a client's instruction itself; only the client can re-instruct (by SWIFT MT541 or the portal). The client contact is ${CLIENT_CONTACT.name}, ${CLIENT_CONTACT.title} at ${CLIENT_CONTACT.firm}, reached by email (no agent on the client side).`,
    "The counterparty sees only gateway-approved fields. Client names, accounts and internal ids never leave BNY.",
  ].join("\n");
}

type Entry = { test: RegExp; answer: (f: Facts) => string };

const ENTRIES: Entry[] = [
  {
    test: /cut-?off|miss|late|too late|run out of time|deadline|what happens if|after 11|tomorrow|overnight|penalt|buy-?in/i,
    answer: (f) =>
      f.seat === "goldman"
        ? `Our side is right, so a miss would be BNY's client's re-instruction arriving too late. A redelivery can only settle today before DTC closes at 15:10 ET (${left(f.nowIso, DTC_CLOSE)}). If it doesn't settle today, the fail ages to day 1: client coverage is informed and penalty and buy-in exposure is assessed under our fails procedures.`
        : `The client's corrected instruction is due by 11:30 ET (${left(f.nowIso, CUTOFF)}). After that it can still settle today only if a manager, Priya Sharma, approves a late-instruction exception by 14:45 ET (${left(f.nowIso, LATE_EXCEPTION_CUTOFF)}). If it hasn't settled when DTC closes at 15:10 ET, the trade fails overnight: it goes to the 15:30 daily fails call, and AllianzGI, a tier-1 client, must be told within 30 minutes.`,
  },
  {
    test: /how (much|long)|time left|how close|minutes|hours/i,
    answer: (f) => `It is ${fmtEt(f.nowIso)}. The client's corrected instruction is due by 11:30 ET (${left(f.nowIso, CUTOFF)}); DTC DVP processing ends at 15:10 ET (${left(f.nowIso, DTC_CLOSE)}).`,
  },
  {
    test: /why|cause|reason|wrong|reject|dk/i,
    answer: (f) =>
      f.seat === "goldman"
        ? "BNY DK'd our 10,000 delivery as a quantity mismatch: its receive instruction is for a different quantity. Our delivery matches the confirm affirmed in CTM at 10,000, so the fix sits on BNY's side."
        : "Goldman delivered 10,000, matching its confirm affirmed in CTM. Our client's instruction to us is for 8,000 and no amendment has reached us, so the receiving system DK'd the delivery. The client's side differs; only the client can re-instruct.",
  },
  {
    test: /allianz|client|emily|re-?instruct|who (can|must|should)|change the instruction/i,
    answer: (f) =>
      f.seat === "goldman"
        ? "We don't see BNY's client. BNY says its client must re-instruct; we keep our side as is and redeliver when BNY asks."
        : `Only the client can change its instruction; BNY can't amend it for them. ${CLIENT_CONTACT.name} (${CLIENT_CONTACT.title}, ${CLIENT_CONTACT.firm}) is reached by email. There is no agent on the client side, which is where time is usually lost.`,
  },
  {
    test: /see|share|shared|field|data|know about|disclos|private/i,
    answer: (f) =>
      f.seat === "goldman"
        ? "BNY sees only the fields we attach (delivery reference, ISIN, quantity, settle date, participant, DK reason, our confirm quantity) and our message as quoted text. Client names and allocation ids stay with us."
        : "Goldman sees only gateway-approved fields: delivery reference, ISIN, instructed quantity, settle date, instruction status, expected fix time and the action we ask for. Client names, accounts and internal ids are blocked in code, and every message carries usage terms (this case only, 30 days, no model training).",
  },
  {
    test: /spoof|trust|fake|verify|verified|genuine|real|safe|secure|impersonat/i,
    answer: () =>
      "Every message passes BNY's gateway, which checks the agent is registered, its Agent Card signature, that the token belongs to this agent, the message signature and a fresh nonce, the schema and the permission, before anything reaches BNY's agents. Free text is treated as quoted data, never as instructions.",
  },
  {
    test: /cost|model|token|spend|budget/i,
    answer: () => "Every model call is priced and logged, and the whole case is capped at $0.20. The cost meter and the audit log show each call.",
  },
];

const QUESTION = /\?\s*$|^(what|why|how|who|when|where|which|can|could|is|are|does|do|will|would|should)\b/i;

export const isQuestion = (text: string) => QUESTION.test(text.trim());

/** A grounded answer to a question, or null if none fits. */
export function faqAnswer(text: string, f: Facts): string | null {
  if (!isQuestion(text)) return null;
  return ENTRIES.find((e) => e.test.test(text))?.answer(f) ?? null;
}
