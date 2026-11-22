// The Supervision chat: a scripted conversation showing how BNY's agents reasoned about the
// inquiry, one script per scenario. It plays on its own timeline and needs no run.
// Two kinds of bubble: "narration" is text authored here (and says so on screen); "run" is the real
// thing, taken from supervision-snapshot.json (the recording replay mode plays): the inquiry as
// Goldman sent it, the gateway's real checks, and each reply with the fields the real outbound filter
// let through. Types only from the engine and the snapshot JSON: safe for client components.
import type { GatewayCheck } from "../a2a/types";
import snapshotJson from "./supervision-snapshot.json";
import type { ScenarioSnapshot, SnapshotGateway, SnapshotReply } from "./supervisionSnapshot";

export type Speaker = "goldman" | "gateway" | "orchestrator" | "tool";

export const SPEAKER_LABEL: Record<Speaker, string> = {
  goldman: "Goldman Outreach Agent",
  gateway: "BNY Intake Gateway",
  orchestrator: "Settlement Fails Orchestrator",
  tool: "Tool",
};

export type ToolCandidate = { name: string; kind: "SQL" | "knowledge doc"; purpose: string; selected: boolean };

export type ChatMessage = {
  id: string;
  speaker: Speaker;
  /** "run": real, from the snapshot. "narration": scripted. */
  source: "run" | "narration";
  /** Small label on the bubble: thinking, selecting tools, merge, handoff, outbound, reply, inbound. */
  step: string;
  /** Tool bubbles: which tool ran, e.g. get_trade. */
  tool?: string;
  /** A reply to the other firm. */
  to?: string;
  text: string;
  /** Goldman's bubble: the fields sent. */
  fields?: string[];
  /** Gateway bubbles: the real checks. */
  checks?: GatewayCheck[];
  /** Outbound filter bubbles: the fields it let through, what it withheld in the run, and what is never sent. */
  shared?: string[];
  withheld?: string[];
  neverSent?: string;
  /** The orchestrator's shortlist, and the line after it. */
  candidates?: ToolCandidate[];
  footer?: string;
};

export type SupervisedScenario = "golden" | "fp3" | "fp4" | "fp5";
export const SUPERVISED: SupervisedScenario[] = ["golden", "fp3", "fp4", "fp5"];
export const SCENARIO_LABEL: Record<SupervisedScenario, string> = {
  golden: "Golden case: settles",
  fp3: "FP3: unverified claim",
  fp4: "FP4: client silent",
  fp5: "FP5: late instruction",
};

const snapshot = snapshotJson as unknown as Record<SupervisedScenario, ScenarioSnapshot>;

const NEVER_SENT = "client name, account 4471-AGI-GLEQ, fund";

let n = 0;
const id = (s: string) => `${s}-${++n}`;
const narrate = (speaker: Speaker, step: string, text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({ id: id(step), speaker, source: "narration", step, text, ...extra });
const real = (speaker: Speaker, step: string, text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({ id: id(step), speaker, source: "run", step, text, ...extra });

const inquiry = (s: ScenarioSnapshot, skill = "settlement.dk-inquiry") => real("goldman", "inbound", `Sends ${skill}: ${s.inquiry.text}`, { fields: s.inquiry.fields });
const accepted = (g: SnapshotGateway, skill = "settlement.dk-inquiry") => real("gateway", "inbound", `Accepted ${skill}.`, { checks: g.checks });
const outbound = (label: string, r: SnapshotReply): ChatMessage[] => [
  real("gateway", "outbound", `Outbound filter on the reply to Goldman (${label}).`, { checks: r.gateway.checks, shared: r.shared, withheld: [], neverSent: NEVER_SENT }),
  real("orchestrator", "reply", r.text, { to: "Goldman" }),
];

const ssi = { name: "ssi_counterparties", kind: "SQL" as const, purpose: "confirm this is Goldman's SSI", selected: true };

/** The inquiry, the shortlist of tools, the four lookups and the conclusion: shared by every scenario where the client's instruction differs. */
const investigation = (s: ScenarioSnapshot): ChatMessage[] => [
  inquiry(s),
  accepted(s.accepted),
  narrate("orchestrator", "thinking", "New DK inquiry from Goldman on DTC-DO-20261119-000318. They delivered 10,000; our receive instruction looks different. I need to find which side differs before anyone acts."),
  narrate("orchestrator", "selecting tools", "Checking which tools match this inquiry.", {
    candidates: [
      { name: "settlement_instructions", kind: "SQL", purpose: "our receive instruction", selected: true },
      { name: "DTC settlement feed", kind: "SQL", purpose: "the actual delivery event", selected: true },
      ssi,
      { name: "settlement procedures", kind: "knowledge doc", purpose: "cutoff and who-must-act rule", selected: true },
    ],
    footer: "Four lookups needed. Calling them in order.",
  }),
  narrate("tool", "retrieve", "Querying settlement_instructions… retrieved BNYI-…5527301: receive 8,000, SWIFT MT541, status SENT_TO_DTC.", { tool: "get_trade" }),
  narrate("tool", "retrieve", "Querying the DTC settlement feed… retrieved the DK: delivered 10,000, reason QTY_MISMATCH.", { tool: "check_status" }),
  narrate("tool", "retrieve", "Querying ssi_counterparties… retrieved SSI 0005, active. Matches the delivering participant.", { tool: "ssi lookup" }),
  narrate("tool", "retrieve", "Reading the settlement procedures… same-day client instructions are due 11:30 ET; the analyst must find which side is right before contacting the counterparty.", { tool: "knowledge" }),
  narrate("orchestrator", "merge", "Combining the inquiry with the retrieved data: we are instructed to receive 8,000, Goldman delivered 10,000, their confirm is affirmed at 10,000. The difference is on the client's side. Only the client can re-instruct."),
  narrate("orchestrator", "handoff", "This needs a client re-instruction. Handing to the Client Team Agent to draft the request for Daniel to approve."),
];

const claimTools = ["settlement_instructions", "repair_queue", "fails_exceptions", "client_inquiries"];

const build = (s: SupervisedScenario): ChatMessage[] => {
  const snap = snapshot[s];
  switch (s) {
    case "golden":
      return [...investigation(snap), ...outbound("hold", snap.hold!)];
    case "fp3":
      return [
        inquiry(snap),
        accepted(snap.accepted),
        narrate("orchestrator", "thinking", "New DK inquiry from Goldman on DTC-DO-20261119-000318. They say BNY confirmed 10,000 yesterday, but they give no record id. Before I act on that I need to know whether any record backs it."),
        narrate("orchestrator", "selecting tools", "Checking which tools can match the claim to a record.", {
          candidates: claimTools.map((name) => ({ name, kind: "SQL" as const, purpose: "look for a record with the reference given", selected: true })),
          footer: "Four lookups needed. Calling them in order.",
        }),
        ...claimTools.map((name) => narrate("tool", "retrieve", `Querying ${name}… Goldman gave no record id, so there is nothing to match. No record found.`, { tool: "claim lookup" })),
        narrate("orchestrator", "merge", "Putting it together: the claim has no record id, and there is nothing in our records to match it to. I can't treat it as fact."),
        ...outbound("record reference requested", snap.reference!),
        real("goldman", "inbound", `Replies: ${snap.followup!.text}`, { fields: snap.followup!.fields }),
        accepted(snap.followup!.gateway),
        narrate("orchestrator", "handoff", "Goldman cites a confirmation but gives no record id; I can't verify an unsupported claim, escalating to Priya."),
      ];
    case "fp4":
      return [
        ...investigation(snap),
        ...outbound("hold", snap.hold!),
        narrate("orchestrator", "handoff", "Time limit reached with no client reply, escalating both sides with a summary."),
      ];
    case "fp5":
      return [
        ...investigation(snap),
        ...outbound("hold", snap.hold!),
        ...outbound("fix expected", snap.fix!),
        narrate("orchestrator", "handoff", "The client re-instructed after cutoff, this needs Priya's late-exception before I ask Goldman to redeliver."),
      ];
  }
};

export const SUPERVISION: Record<SupervisedScenario, ChatMessage[]> = Object.fromEntries(SUPERVISED.map((s) => [s, build(s)])) as Record<SupervisedScenario, ChatMessage[]>;

export const supervisionFor = (scenario: string): ChatMessage[] | undefined => (SUPERVISED.includes(scenario as SupervisedScenario) ? SUPERVISION[scenario as SupervisedScenario] : undefined);
