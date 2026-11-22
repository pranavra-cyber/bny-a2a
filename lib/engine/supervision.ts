// Scripted narration of BNY's agents' reasoning, one script per scenario, for the backstage view.
// This is NARRATION, not model output: the text is authored here, and any view that shows it must
// say so. Nothing here changes the run. A step may name an `anchor`, a real milestone of the run,
// to time itself against; the fields shared and withheld in a compose step are read from the real
// outbound gateway result (`resolveStep`), never written into the script.
// Types only from the engine: safe to import from client components.
import type { GatewayCheck } from "../a2a/types";
import type { Lane, RunEvent, Scenario } from "./types";

export const PHASES = ["think", "retrieve", "merge", "handoff", "compose"] as const;
export type Phase = (typeof PHASES)[number];

/** A real milestone of the run, found by the same signals the Technical view uses. */
export type Anchor =
  | "records-found"
  | "cause-found"
  | "client-asked"
  | "hold-sent"
  | "fix-sent"
  | "claim-unverified"
  | "reference-requested"
  | "late-exception"
  | "escalated";

export type SupervisionStep = {
  phase: Phase;
  lane: Lane;
  /** `{shared}` in a compose step is replaced with the fields in the real outbound gateway result. */
  text: string;
  anchor?: Anchor;
};

export type SupervisedScenario = "golden" | "fp3" | "fp4" | "fp5";

const think = (text: string): SupervisionStep => ({ phase: "think", lane: "bny", text });
const retrieve = (text: string, anchor?: Anchor): SupervisionStep => ({ phase: "retrieve", lane: "bny", text, anchor });
const merge = (text: string, anchor?: Anchor): SupervisionStep => ({ phase: "merge", lane: "bny", text, anchor });
const handoff = (text: string, anchor?: Anchor): SupervisionStep => ({ phase: "handoff", lane: "bny", text, anchor });
const compose = (text: string, anchor?: Anchor): SupervisionStep => ({ phase: "compose", lane: "bny", text, anchor });

const NEVER_LEAVE = "Withholding the client name, account 4471-AGI-GLEQ and the fund. Those never leave.";

/** Steps shared by every scenario in which the client's instruction turns out to differ. */
const investigation: SupervisionStep[] = [
  think("New DK inquiry from Goldman on DTC-DO-20261119-000318. They delivered 10,000; our receive instruction looks different. I need to find which side differs before anyone acts."),
  retrieve("Looking up the trade in settlement_instructions. Found BNYI-…5527301: receive 8,000, status SENT_TO_DTC.", "records-found"),
  retrieve("Pulling the settlement event from the DTC feed. Found the DK: delivered 10,000, reason quantity mismatch."),
  retrieve("Checking Goldman's SSI in ssi_counterparties. Active SSI, participant 0005. Matches."),
  merge("Putting it together: we are instructed to receive 8,000, Goldman delivered 10,000, and their confirm is affirmed at 10,000. The difference is on the client's side. Only the client can re-instruct.", "cause-found"),
  handoff("This needs a client re-instruction. Handing to the Client Team Agent to draft the request for Daniel to approve.", "client-asked"),
];

export const SUPERVISION: Record<SupervisedScenario, SupervisionStep[]> = {
  golden: [...investigation, compose(`Replying to Goldman: hold, fix expected. Sharing {shared}. ${NEVER_LEAVE}`, "fix-sent")],
  fp3: [
    think("New DK inquiry from Goldman on DTC-DO-20261119-000318. They say BNY confirmed 10,000 yesterday, but they give no record id. Before I act on that I need to know whether any record backs it."),
    retrieve("Looking for a record behind the claim in settlement_instructions, repair_queue, fails_exceptions and client_inquiries. Goldman gave no reference, so there is nothing to look up.", "claim-unverified"),
    merge("Putting it together: the claim has no record id and nothing in our records to match it to. I can't treat it as fact."),
    compose("Replying to Goldman: please give the BNY record reference for the claim. Sharing {shared}. Nothing else leaves.", "reference-requested"),
    handoff("Goldman cites a confirmation but gives no record id; I can't verify an unsupported claim, escalating to Priya.", "escalated"),
  ],
  fp4: [
    ...investigation,
    compose(`Replying to Goldman: hold, the client is checking. Sharing {shared}. ${NEVER_LEAVE}`, "hold-sent"),
    handoff("Time limit reached with no client reply, escalating both sides with a summary.", "escalated"),
  ],
  fp5: [
    ...investigation,
    compose(`Replying to Goldman: hold, fix expected. Sharing {shared}. ${NEVER_LEAVE}`, "fix-sent"),
    handoff("The client re-instructed after cutoff, this needs Priya's late-exception before I ask Goldman to redeliver.", "late-exception"),
  ],
};

export const supervisionFor = (scenario: Scenario): SupervisionStep[] | undefined => (scenario in SUPERVISION ? SUPERVISION[scenario as SupervisedScenario] : undefined);

// ---------------- Reading the real run ----------------

const isOutbound = (e: RunEvent, title: RegExp) => e.kind === "message" && e.lane === "bny" && !!e.flags?.includes("outbound") && title.test(e.title);

const ANCHORS: Record<Anchor, (e: RunEvent) => boolean> = {
  "records-found": (e) => e.kind === "step" && e.lane === "bny" && e.title.startsWith("Records found for"),
  "cause-found": (e) => e.kind === "step" && e.lane === "bny" && e.title.startsWith("Cause found"),
  "client-asked": (e) => e.kind === "approval-request" && e.approval?.kind === "bny-client-message",
  "hold-sent": (e) => isOutbound(e, /client asked to confirm, please hold/),
  "fix-sent": (e) => isOutbound(e, /fix expected/),
  "claim-unverified": (e) => e.kind === "step" && !!e.flags?.includes("unverified-claim"),
  "reference-requested": (e) => isOutbound(e, /record reference requested/),
  "late-exception": (e) => e.kind === "approval-request" && e.approval?.kind === "bny-late-exception",
  escalated: (e) => e.kind === "escalation" && e.lane === "bny",
};

export const anchorEvent = (events: RunEvent[], anchor: Anchor): RunEvent | undefined => events.find(ANCHORS[anchor]);

const dataFields = (envelope: unknown): string[] => {
  const parts = (envelope as { params?: { message?: { parts?: { kind: string; data?: Record<string, unknown> }[] } } })?.params?.message?.parts ?? [];
  return parts.filter((p) => p.kind === "data").flatMap((p) => Object.keys(p.data ?? {}));
};

const withheldOf = (checks: GatewayCheck[] = []) =>
  checks
    .filter((c) => (c.id === "disclosure" || c.id === "labels") && !c.ok)
    .flatMap((c) => c.detail.replace(/^(withheld|blocked): /, "").split(", "))
    .filter(Boolean);

export type ResolvedStep = SupervisionStep & {
  /** False until the run has reached the anchor (and, for a compose step, the gateway has answered). */
  ready: boolean;
  /** The real event this step is timed against. */
  event?: RunEvent;
  /** Compose steps: fields the real outbound gateway result let through, and what it withheld. */
  shared?: string[];
  withheld?: string[];
};

/** Fills a step in from the real run. Unanchored steps are ready as soon as the run has started. */
export function resolveStep(step: SupervisionStep, events: RunEvent[]): ResolvedStep {
  const event = step.anchor ? anchorEvent(events, step.anchor) : undefined;
  if (step.anchor && !event) return { ...step, text: step.text.replace("{shared}", "…"), ready: false };
  if (step.phase !== "compose" || !event) return { ...step, ready: true, event };
  const gateway = events.slice(events.indexOf(event) + 1).find((e) => e.kind === "gateway");
  if (!gateway) return { ...step, text: step.text.replace("{shared}", "…"), ready: false, event };
  const shared = dataFields(gateway.envelope);
  return { ...step, text: step.text.replace("{shared}", shared.join(", ") || "nothing"), ready: true, event, shared, withheld: withheldOf(gateway.checks) };
}
