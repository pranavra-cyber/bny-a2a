// "When things go wrong": ordinary operational failures in a live A2A connection, as opposed to the
// attack console's hostile ones. Each drill says how real it is in the prototype: run through BNY's
// real gateway and registry, simulated by a flag, or only illustrative. Text only: safe for client
// components.

export type DrillId = "expired" | "rotated" | "suspended" | "turns" | "retry" | "timeout";

/** real: the prototype's own code decides the outcome. simulated: a flag stands in for a control it doesn't run. illustrative: described, not run. */
export type Reality = "real" | "simulated" | "illustrative";
export const REALITY_LABEL: Record<Reality, string> = {
  real: "Run through BNY's real gateway code",
  simulated: "Simulated control",
  illustrative: "Illustrative, not run",
};

export type Drill = {
  id: DrillId;
  title: string;
  /** What happens in the real world, in one line. */
  situation: string;
  reality: Reality;
  /** What BNY's operations do about it, beyond the automatic refusal. */
  bnyResponse: string[];
  /** What the counterparty's agent is told. */
  counterpartySees: string;
  owner: string;
};

export const DRILLS: Drill[] = [
  {
    id: "expired",
    title: "A token expires mid-case",
    situation: "Goldman's agent keeps using a token past its lifetime. Nothing is wrong with Goldman; its credential simply ran out.",
    reality: "real",
    bnyResponse: ["The gateway refuses the message and says why.", "Goldman's agent is expected to fetch a fresh token from the registry and resend.", "No alert: this is routine, and shows up in the audit log only."],
    counterpartySees: "Rejected: token expired. Request a new token and retry.",
    owner: "Counterparty's integration team",
  },
  {
    id: "rotated",
    title: "BNY rotates its signing key",
    situation: "The registry's signing key changes. A token issued under the old key is still in Goldman's hands.",
    reality: "real",
    bnyResponse: ["The gateway cannot verify the old token and refuses it.", "In production the old key would stay valid for a short overlap window, so rotation is not an outage.", "BNY Security announces the rotation to members ahead of time."],
    counterpartySees: "Rejected: signature not issued by the network registry. Request a new token.",
    owner: "BNY Security",
  },
  {
    id: "suspended",
    title: "BNY suspends a counterparty",
    situation: "A firm's access has to stop now: a compromised agent, a failed review, a legal hold. Its token is still valid and unexpired.",
    reality: "real",
    bnyResponse: ["The network operator suspends the firm in the registry.", "The gateway checks the registry on every message, so the next call is refused even though the token is genuine.", "BNY Security is paged and the case, if any, moves to a person-to-person channel."],
    counterpartySees: "Rejected: the firm is suspended by the network operator. Contact BNY Operations.",
    owner: "BNY Security and the network operator",
  },
  {
    id: "turns",
    title: "A case runs past its turn limit",
    situation: "A conversation keeps going: a stuck loop, or a counterparty that won't take an answer. BNY caps messages per case.",
    reality: "real",
    bnyResponse: ["The gateway refuses further messages for the case.", "The case is handed to people at both firms, who pick up the phone.", "The agents stop; the humans own the resolution."],
    counterpartySees: "Rejected: turn limit reached. This case has been handed to BNY settlement operations.",
    owner: "BNY Settlement Operations",
  },
  {
    id: "retry",
    title: "The same message arrives twice",
    situation: "Goldman's agent times out waiting for a reply and resends. The network is unreliable, so every message may arrive more than once.",
    reality: "simulated",
    bnyResponse: ["In the prototype, a nonce check flags the copy as a replay (the check is a flag, not a real nonce store).", "In production the message id makes the call idempotent: BNY returns the original answer rather than an error, and never opens a second case.", "Genuine replay attacks and honest retries look the same on the wire; the response differs only in tone."],
    counterpartySees: "Prototype: rejected as a reused nonce. Production: the original reply, resent.",
    owner: "BNY Platform",
  },
  {
    id: "timeout",
    title: "A counterparty's agent goes quiet",
    situation: "BNY has asked Goldman for something and gets no answer. The 11:30 deadline is still running.",
    reality: "illustrative",
    bnyResponse: [
      "The task stays in the working state; nothing is failed on a timer alone.",
      "BNY's agent retries with backoff, then flags the case to Priya Sharma well before the deadline.",
      "Priya phones Goldman's fails desk. The agent had the right behaviour: know when to stop and ask a person.",
    ],
    counterpartySees: "Nothing: the counterparty is the one that is silent.",
    owner: "BNY Settlement Operations",
  },
];

export type DrillRun = {
  id: DrillId;
  /** Absent when the drill is illustrative and nothing was run. */
  accepted?: boolean;
  reason?: string;
  checks: { id: string; label: string; ok: boolean; detail: string }[];
};
