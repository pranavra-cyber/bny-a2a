// The guided case: three people drive the golden case from their own assistant
// chats. People are asked only for real decisions (Michael's request and send, Daniel's
// email to the client, Michael's redelivery, Priya's late exception); every other step
// runs on its own and the person is told with a notification. Types and copy only: safe to import from
// client components.

/** Who acts at a checkpoint: Goldman's fails desk, BNY Settlement Ops, BNY Client Service. */
export type Seat = "goldman" | "bny" | "bny-cs";

export type CheckpointId = "request" | "send" | "investigate" | "handover" | "contact" | "client-reply" | "hold";

export type CheckpointAction = {
  id: string;
  label: string;
  /** primary: what "yes / go ahead" means. cancel: stops the case and hands it to operations. */
  kind?: "primary" | "cancel";
  /** Words that select this action when the assistant has no model (mock, replay, budget spent). */
  keywords?: string[];
};

export type Checkpoint = {
  id: CheckpointId;
  seat: Seat;
  /** What the assistant says before waiting for the user. */
  prompt: string;
  actions: CheckpointAction[];
  /** Example messages, sent as typed text. */
  suggestions?: string[];
  /** Example questions the assistant can answer from the case. */
  questions?: string[];
  /** Manual steps (Teams and email): the UI shows a send form and a confirmation snackbar. */
  manual?: { channels: ("teams" | "email")[]; to: string; subject: string; body: string };
};

export type SeatInfo = { assistant: string; person: string; title: string; firm: "Goldman Sachs" | "BNY"; firmId: "goldman" | "bny"; sees: string };

export const SEATS: Record<Seat, SeatInfo> = {
  goldman: {
    assistant: "GS Fails Assistant",
    person: "Michael Torres",
    title: "Settlement Operations Associate",
    firm: "Goldman Sachs",
    firmId: "goldman",
    sees: "Goldman's fails, deliveries, confirms and inventory, plus what BNY's gateway sends back.",
  },
  bny: {
    assistant: "Settlement Fails Orchestrator",
    person: "Priya Sharma",
    title: "Settlement Operations Lead",
    firm: "BNY",
    firmId: "bny",
    sees: "BNY's instructions, exceptions, SSIs and procedures, plus fields Goldman's agent sent through the gateway.",
  },
  "bny-cs": {
    assistant: "Settlement Fails Orchestrator",
    person: "Daniel Kim",
    title: "Client Service Manager",
    firm: "BNY",
    firmId: "bny",
    sees: "The case record from Settlement Ops, the client's service terms and contacts.",
  },
};

export const firmOfSeat = (seat: Seat): "goldman" | "bny" => SEATS[seat].firmId;

/** The client contact. Outside the prototype: reached by Teams and email, not by an agent. */
export const CLIENT_CONTACT = { name: "Emily Carter", title: "Trade Operations Analyst", firm: "Allianz Global Investors", email: "emily.carter@example-agi.test" };

export const GREETING =
  "Good morning, Michael. I can see Goldman's fails, deliveries and confirms, and I can reach other firms' agents through BNY's closed network. What would you like to work on?";

export const INTAKE_SUGGESTIONS = [
  "Why did BNY reject our NVDA delivery this morning?",
  "Chase the counterparty on our open NVDA fail before cutoff",
  "Which open fails need attention first today?",
];

/** Step titles that mark a stage done (the same in live runs and in older recordings). */
export const STEP_CAUSE_FOUND = "Cause found";
export const STEP_HANDED_OVER = "Case handed to Client Service";
export const STEP_HOLDING = "Holding: our side stays as is";

/** The six steps of the operations flow (from the deck). Done once its marker appears in the run. */
export const STAGES: { label: string; seat: Seat; doneWhen: { checkpoint?: CheckpointId; approval?: string; status?: string; step?: string } }[] = [
  { label: "Find the cause", seat: "bny", doneWhen: { step: STEP_CAUSE_FOUND } },
  { label: "Hand over to Client Service", seat: "bny", doneWhen: { step: STEP_HANDED_OVER } },
  { label: "Ask the client", seat: "bny-cs", doneWhen: { step: `Email from ${CLIENT_CONTACT.name}` } },
  { label: "Notify Goldman of the fix time", seat: "bny-cs", doneWhen: { step: STEP_HOLDING } },
  { label: "Client re-instructs", seat: "bny", doneWhen: { approval: "gs-redelivery" } },
  { label: "Settle and close", seat: "goldman", doneWhen: { status: "settled" } },
];

/** How far the guided case has come: the index of the first stage not yet done. */
export function stageIndexOf(events: { kind: string; title?: string; checkpoint?: { id: string }; decision?: { kind: string; outcome: string } }[], status: string): number {
  const i = STAGES.findIndex(({ doneWhen: w }) =>
    w.step
      ? !events.some((e) => e.title?.startsWith(w.step!))
      : w.checkpoint
      ? !events.some((e) => e.checkpoint?.id === w.checkpoint)
      : w.approval
        ? !events.some((e) => e.kind === "approval" && e.decision?.kind === w.approval && e.decision?.outcome === "approved")
        : status !== w.status,
  );
  return i === -1 ? STAGES.length : i;
}

/** Daniel is told, not asked: the client's fix time goes to Goldman's agent on its own. */
export const relayNoticeTitle = (fixTime: string) => `Sent to Goldman automatically: fix expected by ${fixTime}`;
export const relayNoticeDetail = (late: boolean) =>
  `The Settlement Ops Agent passed the client's time to Goldman's agent through the gateway and asked it to hold. Only approved fields crossed; no client details.${late ? " The instruction is after the 11:30 ET cutoff, so Priya will need to approve a late-instruction exception." : ""} Nothing for you to do.`;

/**
 * Steps that used to wait for a person and now run on their own. Each person is told with
 * an in-app notification instead; the live flow and the replay of older recordings (which
 * still hold these checkpoints) send the same notice.
 */
export const AUTO_NOTICES: Partial<Record<CheckpointId, { seat: Seat; title: string; detail: string }>> = {
  investigate: {
    seat: "bny",
    title: "The Settlement Ops Agent is comparing the details",
    detail: "It checks Goldman's fields against BNY's instruction, the DTC activity and the procedures, then hands the case on. Nothing for you to do unless it gets stuck.",
  },
  handover: {
    seat: "bny",
    title: "Handed to Daniel Kim in Client Service",
    detail: "The client's instruction differs and BNY can't change a client's instruction, so the agent passed the case to Client Service to ask AllianzGI to re-instruct. Nothing for you to do.",
  },
  contact: {
    seat: "bny-cs",
    title: "The Client Team Agent is drafting the request to the client",
    detail: "You decide whether the email goes to the client: nothing is sent until you approve it.",
  },
  hold: {
    seat: "goldman",
    title: "Holding our side while BNY's client re-instructs",
    detail: "Our delivery matches the affirmed confirm, so nothing changes on our side. You'll be asked to approve the redelivery once BNY gives the go-ahead.",
  },
};

/**
 * Checkpoints replay passes straight through. "client-reply" is from recordings made before
 * the relay was automatic; the others are listed in AUTO_NOTICES.
 */
export const AUTO_CHECKPOINTS: ReadonlySet<string> = new Set(["client-reply", ...Object.keys(AUTO_NOTICES)]);
