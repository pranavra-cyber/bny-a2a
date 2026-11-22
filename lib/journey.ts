// "The A2A journey": what it takes to connect BNY to the outside world and how a live case plays
// out. Lifecycle (who does what, before and after go-live), the trust-boundary map, the golden case as
// an A2A task, and every control tagged as protocol or BNY policy, with how real it is here and what
// would replace it in production. Text and data only: safe for client components.
import type { TaskState } from "./a2a/types";

/** How far the prototype takes a control. */
export type Build = "enforced" | "partly" | "simulated" | "missing";
export const BUILD_LABEL: Record<Build, string> = {
  enforced: "Enforced in code",
  partly: "Partly built",
  simulated: "Simulated",
  missing: "Not built",
};
/** Who defines a control: the A2A protocol itself, BNY's own policy layer on top, or ordinary infrastructure. */
export type Layer = "protocol" | "policy" | "infra";
export const LAYER_LABEL: Record<Layer, string> = { protocol: "A2A protocol", policy: "BNY policy layer", infra: "Infrastructure" };

// ---------------------------------------------------------------------------------------------
// 1. Lifecycle

export type Lane = "legal" | "security" | "ops" | "counterparty";
export const LANE_LABEL: Record<Lane, string> = { legal: "Legal & Compliance", security: "BNY Security", ops: "BNY Operations", counterparty: "The counterparty" };

export type LifecycleStep = {
  id: string;
  phase: "setup" | "run";
  lane: Lane;
  title: string;
  /** What happens. */
  what: string;
  /** What exists afterwards. */
  produces: string;
  build: Build;
  /** What the prototype does with this step. */
  prototype: string;
};

export const LIFECYCLE: LifecycleStep[] = [
  { id: "agreement", phase: "setup", lane: "legal", title: "Sign the network agreement", what: "Legal agrees membership terms and data-sharing limits with the firm: what may be asked, what may be shared, for how long it is kept.", produces: "A signed agreement and data-sharing terms", build: "missing", prototype: "Not modelled. The usage terms on every outbound message stand in for it." },
  { id: "verify", phase: "setup", lane: "legal", title: "Verify the firm", what: "Compliance checks the legal entity: its LEI and KYC status, against BNY's own reference data.", produces: "A registry member record, KYC verified", build: "enforced", prototype: "The registry holds each member's LEI and KYC status; the gateway refuses a firm that isn't verified." },
  { id: "domain", phase: "setup", lane: "security", title: "Attest the domain", what: "The firm proves it controls the domain its agents will call from. BNY records it as the only domain that firm may use.", produces: "An attested domain on the member record", build: "enforced", prototype: "The gateway rejects a valid token presented from any other domain (the stolen-token attack)." },
  { id: "keys", phase: "setup", lane: "security", title: "Exchange keys and certificates", what: "Both sides generate keys. BNY registers the firm's public key; the firm trusts BNY's. Certificates bind each agent to its identity for mTLS.", produces: "Registered public keys and agent certificates", build: "simulated", prototype: "Shown in the Secured walkthrough; no certificates are issued and no real signature is checked." },
  { id: "scopes", phase: "setup", lane: "ops", title: "Approve what the agent may ask", what: "BNY Operations decides which skills this firm's agent may call. An Agent Card describes capabilities; it grants nothing.", produces: "Approved skills on the membership", build: "enforced", prototype: "Approved skills are checked on every message, against the token and the registry (the escalation attack)." },
  { id: "sandbox", phase: "setup", lane: "counterparty", title: "Pass the sandbox tests", what: "The firm's team runs a conformance set against a test endpoint: a valid request, a malformed one, an out-of-scope one. BNY signs off.", produces: "A test report both sides agree on", build: "missing", prototype: "Not built. The attack console and the drills show the kind of cases such a set would hold." },
  { id: "golive", phase: "setup", lane: "security", title: "Go live", what: "BNY Security and risk approve. The registry issues the firm's credentials and the firm's agent starts calling.", produces: "A token for each agent, scoped to its approved skills", build: "partly", prototype: "The registry issues HMAC-signed tokens (24 hours in the demo), not JWTs." },
  { id: "cases", phase: "run", lane: "ops", title: "Work live cases", what: "Requests arrive, cross the gateway, and BNY's agents and people resolve them. Anything that matters waits for a person's approval.", produces: "Resolved cases and an audit trail", build: "enforced", prototype: "The whole prototype: the golden case below." },
  { id: "monitor", phase: "run", lane: "security", title: "Monitor and review", what: "Security reviews the audit log and unusual patterns: a firm asking harmless questions that add up, repeated refusals.", produces: "Alerts, periodic access reviews", build: "partly", prototype: "A request-pattern monitor catches the 'fishing' attack; the audit log is browsable. There is no alerting." },
  { id: "rotate", phase: "run", lane: "security", title: "Rotate keys and renew", what: "Keys and tokens expire on a schedule. Rotation has an overlap window so firms are not cut off by surprise.", produces: "New keys, renewed credentials", build: "partly", prototype: "Expiry and key mismatch are refused by the gateway (see the drills). There is no overlap window." },
  { id: "suspend", phase: "run", lane: "security", title: "Suspend or offboard", what: "Access can stop at once: a compromise, a failed review, or the end of the relationship. Open cases move to people.", produces: "A suspended member; an audit record", build: "enforced", prototype: "A suspended firm's valid token is refused on its next message (see the drills)." },
];

// ---------------------------------------------------------------------------------------------
// 2. Trust-boundary map

export type Zone = { id: "counterparty" | "internet" | "dmz" | "internal"; label: string; x: number; y: number; w: number; h: number };
export const ZONES: Zone[] = [
  { id: "counterparty", label: "Counterparty (Goldman Sachs)", x: 15, y: 30, w: 200, h: 460 },
  { id: "internet", label: "Public internet", x: 215, y: 30, w: 115, h: 460 },
  { id: "dmz", label: "BNY edge", x: 330, y: 30, w: 310, h: 460 },
  { id: "internal", label: "BNY internal", x: 655, y: 30, w: 335, h: 460 },
];

export type NodeId = "gs" | "auth" | "edge" | "gate" | "registry" | "outbound" | "orch" | "data" | "people" | "audit";
export type ArchNode = {
  id: NodeId;
  label: string;
  sub: string;
  x: number;
  y: number;
  w: number;
  h: number;
  layer: Layer;
  build: Build;
  /** What it does in the connection. */
  does: string;
  /** What it would be in production. */
  production: string;
  /** Where to see it in the prototype. */
  see?: { label: string; href: string };
};

export const NODES: ArchNode[] = [
  { id: "gs", label: "Goldman's agent", sub: "outside BNY", x: 30, y: 215, w: 170, h: 90, layer: "protocol", build: "enforced", does: "Discovers BNY's Agent Card, gets a token, and sends a signed A2A message. BNY neither runs nor trusts it.", production: "Any A2A-capable agent, built on any framework. The protocol is the only coupling.", see: { label: "The Goldman side of the case", href: "/eliza" } },
  { id: "auth", label: "Token service", sub: "OAuth client credentials", x: 345, y: 395, w: 125, h: 70, layer: "policy", build: "partly", does: "Issues each approved agent a token scoped to its approved skills.", production: "An OAuth authorisation server issuing signed JWTs, with keys published by JWKS.", see: { label: "Real vs simulated", href: "/eliza?tab=controls" } },
  { id: "edge", label: "mTLS edge", sub: "transport security", x: 345, y: 215, w: 110, h: 90, layer: "infra", build: "simulated", does: "Terminates TLS, checks the agent's certificate, and passes the request inward.", production: "A service mesh or API gateway enforcing mutual TLS and certificate binding.", see: { label: "Secured: the handshake", href: "/secured" } },
  { id: "gate", label: "Intake Gateway", sub: "deterministic, no model", x: 505, y: 215, w: 125, h: 90, layer: "policy", build: "enforced", does: "Runs the inbound checks: identity, scope, turn limit, injection scan and field allowlist. Untrusted text goes on only as quoted data.", production: "The same checks as a hardened service in front of every internal agent.", see: { label: "Secured: the six checks", href: "/secured" } },
  { id: "registry", label: "Registry", sub: "members, cards, scopes", x: 490, y: 395, w: 125, h: 70, layer: "policy", build: "enforced", does: "BNY's record of who is on the network, which domain each uses and what each may ask. Goldman never sees or edits it.", production: "A governed service with change control, owned by BNY Security.", see: { label: "Registry (API)", href: "/api/registry" } },
  { id: "outbound", label: "Outbound filter", sub: "what may leave BNY", x: 505, y: 60, w: 125, h: 80, layer: "policy", build: "enforced", does: "Keeps only approved fields, blocks client data labels, scans the text for internal identifiers and attaches usage terms.", production: "The same filter, with the allowlist owned by data governance and reviewed on a schedule.", see: { label: "Supervision: the filter", href: "/eliza" } },
  { id: "orch", label: "BNY agents", sub: "orchestrator and ops agent", x: 675, y: 215, w: 140, h: 90, layer: "policy", build: "enforced", does: "Reason over BNY's own records with deterministic tools, and draft the reply. They never see the counterparty's raw text as instructions.", production: "Eliza digital employees with tool-level access limits.", see: { label: "Supervision: the reasoning", href: "/eliza" } },
  { id: "data", label: "Tools & records", sub: "BNY's synthetic data", x: 845, y: 215, w: 130, h: 90, layer: "policy", build: "enforced", does: "Instructions, DTC activity, client accounts and procedures, read through scoped tools.", production: "BNY's systems of record behind read-only, audited tool interfaces." },
  { id: "people", label: "People approve", sub: "Priya, Daniel", x: 845, y: 60, w: 130, h: 80, layer: "policy", build: "enforced", does: "Anything that sends to the client, releases an instruction or makes an exception waits for a named person.", production: "The same approval gates inside Eliza's chat and BNY's case tooling.", see: { label: "Open the workspace", href: "/eliza" } },
  { id: "audit", label: "Audit log", sub: "every decision", x: 780, y: 395, w: 195, h: 70, layer: "policy", build: "enforced", does: "Records who or what acted, the data it touched, the fields shared and the decision. Gateway checks are recorded too.", production: "An immutable store feeding BNY's security monitoring.", see: { label: "Audit page", href: "/eliza" } },
];

export type FlowStep = { n: number; title: string; detail: string; from: NodeId; to: NodeId; path: [number, number][]; label: string; layer: Layer; build: Build };
export const FLOW: FlowStep[] = [
  { n: 1, title: "Get a token", detail: "Before anything else, Goldman's agent proves who it is to BNY's token service and receives a short-lived token limited to the skills BNY approved.", from: "gs", to: "auth", path: [[115, 305], [115, 430], [345, 430]], label: "Get a token", layer: "policy", build: "partly" },
  { n: 2, title: "Open a secure connection", detail: "Goldman's agent connects over mutual TLS: each side presents a certificate, so the channel itself carries identity as well as encryption.", from: "gs", to: "edge", path: [[200, 245], [345, 245]], label: "mTLS", layer: "infra", build: "simulated" },
  { n: 3, title: "Pass the request inward", detail: "The edge hands the decrypted A2A message, token and signature to the gateway. Nothing past this point has seen the request yet.", from: "edge", to: "gate", path: [[455, 260], [505, 260]], label: "Request", layer: "infra", build: "simulated" },
  { n: 4, title: "Check who is asking", detail: "The gateway asks the registry: is this a verified member, calling from its attested domain, with this skill approved? A card or a token alone is not enough.", from: "gate", to: "registry", path: [[567, 305], [567, 395]], label: "Who is this?", layer: "policy", build: "enforced" },
  { n: 5, title: "Hand over a cleaned request", detail: "The gateway scans the text, drops fields outside the allowlist and passes only what is left, with the free text wrapped as untrusted quoted data.", from: "gate", to: "orch", path: [[630, 260], [675, 260]], label: "Cleaned", layer: "policy", build: "enforced" },
  { n: 6, title: "Look up BNY's records", detail: "BNY's agent uses scoped tools to compare the counterparty's claim with BNY's own instruction, DTC activity and client account.", from: "orch", to: "data", path: [[815, 260], [845, 260]], label: "Records", layer: "policy", build: "enforced" },
  { n: 7, title: "Ask a person where it matters", detail: "Anything beyond routine waits for approval: the client email, the exception, the release. The agent proposes; a named person decides.", from: "orch", to: "people", path: [[795, 215], [795, 100], [845, 100]], label: "Approval", layer: "policy", build: "enforced" },
  { n: 8, title: "Draft the reply and filter it", detail: "The reply is drafted from BNY's records, then the outbound filter removes everything not approved to leave: client name, account, fund, internal references.", from: "orch", to: "outbound", path: [[720, 215], [720, 100], [630, 100]], label: "Draft → filter", layer: "policy", build: "enforced" },
  { n: 9, title: "Send only what is approved", detail: "What survives the filter goes back through the edge with usage terms attached: purpose, retention, no model training.", from: "outbound", to: "edge", path: [[505, 100], [400, 100], [400, 215]], label: "Approved fields", layer: "policy", build: "enforced" },
  { n: 10, title: "Goldman's agent receives it", detail: "The reply reaches Goldman's agent as an A2A message with a task state: working, input-required or completed. Every step above is in the audit log.", from: "edge", to: "gs", path: [[345, 290], [200, 290]], label: "Reply", layer: "protocol", build: "enforced" },
];

// ---------------------------------------------------------------------------------------------
// 3. The golden case as an A2A task. Each beat is a real event in the recorded golden run.

export type CaseBeat = {
  /** Eastern time, hh:mm:ss, from the recording. */
  at: string;
  title: string;
  detail: string;
  who: "goldman" | "bny" | "client" | "dtc";
  /** The task's state after this beat; absent before the task exists. */
  state?: TaskState;
  /** A person acted or approved here. */
  person?: string;
  /** Title of the recorded event this beat is taken from. */
  source: string;
};

export const CASE_RECORDING = "golden-live-r_5497d540";
export const CASE_DEADLINE = "11:30:00";
export const CASE_BEATS: CaseBeat[] = [
  { at: "09:02:00", title: "Goldman's system sees the DK", detail: "A delivery of 10,000 NVDA to BNY is rejected. Goldman's monitor opens a fail.", who: "goldman", source: "DK detected on DEL-20261118-448213" },
  { at: "09:03:00", title: "Goldman's agent opens a request", detail: "It finds BNY's gateway, then sends a settlement.dk-inquiry. The A2A task is created.", who: "goldman", state: "submitted", source: "Sent to BNY: settlement.dk-inquiry" },
  { at: "09:03:04", title: "The gateway accepts it", detail: "Every inbound check passes. BNY's agent starts work and tells Goldman it is investigating, with three approved fields.", who: "bny", state: "working", source: "Gateway accepted settlement.dk-inquiry" },
  { at: "09:04:32", title: "BNY finds the cause", detail: "The client's instruction says 8,000, and Goldman delivered 10,000. Only the client can fix it.", who: "bny", state: "working", source: "Cause found: the client's instruction differs" },
  { at: "09:12:03", title: "A person approves; Goldman is told to hold", detail: "Daniel Kim approves the email to the client. BNY tells Goldman's agent to hold. The task now waits on someone outside the network.", who: "bny", state: "input-required", person: "Daniel Kim", source: "BNY: client asked to confirm, please hold" },
  { at: "10:24:00", title: "The client replies, by email", detail: "AllianzGI is not on the network, so the answer comes by email, 72 minutes after BNY's email went out: a corrected instruction by 11:15.", who: "client", state: "input-required", source: "Email from Emily Carter: corrected instruction by 11:15 ET" },
  { at: "10:26:03", title: "BNY tells Goldman when to expect the fix", detail: "A second filtered message with the expected fix time. Goldman's agent recommends holding as is.", who: "bny", state: "input-required", source: "BNY: fix expected by 11:15 ET" },
  { at: "11:08:03", title: "The instruction is corrected; redeliver", detail: "BNY's record now matches. It tells Goldman's agent to redeliver.", who: "bny", state: "input-required", source: "BNY: instruction updated, please redeliver" },
  { at: "11:14:00", title: "Goldman's person approves the redelivery", detail: "Michael Torres approves. Goldman's agent redelivers 10,000.", who: "goldman", state: "input-required", person: "Michael Torres", source: "Approve the redelivery: approved by Michael Torres" },
  { at: "11:17:00", title: "DTC settles; the task completes", detail: "Settled 13 minutes before the 11:30 deadline. Both firms close the case.", who: "dtc", state: "completed", source: "Fail GS-FAIL-20261119-0091 closed" },
];

export const TASK_STATE_LABEL: Record<TaskState, string> = {
  submitted: "Submitted",
  working: "Working",
  "input-required": "Input required",
  completed: "Completed",
  failed: "Failed",
  rejected: "Rejected",
  canceled: "Canceled",
};

const secs = (t: string) => t.split(":").reduce((a, v) => a * 60 + Number(v), 0);
/** Seconds the case spent in each task state, from the beats. */
export function timeInState(beats: CaseBeat[] = CASE_BEATS): Partial<Record<TaskState, number>> {
  const out: Partial<Record<TaskState, number>> = {};
  for (let i = 0; i < beats.length - 1; i++) {
    const s = beats[i].state;
    if (s) out[s] = (out[s] ?? 0) + secs(beats[i + 1].at) - secs(beats[i].at);
  }
  return out;
}
export const caseSeconds = (a: string, b: string) => secs(b) - secs(a);

// ---------------------------------------------------------------------------------------------
// 4. Controls: protocol or BNY policy, and how real each is here

export type Control = {
  id: string;
  name: string;
  layer: Layer;
  build: Build;
  /** What the prototype does. */
  prototype: string;
  /** What BNY would run in production. */
  production: string;
  owner: string;
  /** For controls built in code: a file and a string that must appear in it. */
  code?: { file: string; has: string };
};

export const CONTROLS: Control[] = [
  { id: "card", name: "Agent Card discovery", layer: "protocol", build: "partly", prototype: "Cards live in the registry and are listed by its API. They are not served from a well-known URL, and the card signature is a stand-in.", production: "Each firm serves its card at its own well-known address; BNY verifies the card's signature against the registered key.", owner: "Each firm; BNY Security verifies", code: { file: "lib/a2a/registry.ts", has: "AGENT_CARDS" } },
  { id: "message", name: "Messages, parts and tasks", layer: "protocol", build: "enforced", prototype: "Typed messages with text and data parts, and a task that moves between states.", production: "The same structures, spoken over the protocol's own transport.", owner: "Protocol", code: { file: "lib/a2a/types.ts", has: "export type Task" } },
  { id: "task-states", name: "Task states", layer: "protocol", build: "enforced", prototype: "The case moves through submitted, working, input-required and completed; failed and rejected exist for the safety paths.", production: "The same states. They are how a waiting counterparty knows whether to wait, answer or stop.", owner: "Protocol", code: { file: "lib/a2a/types.ts", has: "input-required" } },
  { id: "streaming", name: "Streaming and push updates", layer: "protocol", build: "missing", prototype: "The card says streaming is supported, but the two firms do not exchange updates this way. The app's own live feed is a separate thing.", production: "Streaming or push notifications so a waiting agent hears of a state change at once.", owner: "Each firm's platform team" },
  { id: "mtls", name: "Mutual TLS", layer: "infra", build: "simulated", prototype: "Shown in the Secured walkthrough. No certificates are issued or checked.", production: "A service mesh or API gateway enforcing mTLS, with certificates bound to the agent's identity.", owner: "BNY Infrastructure" },
  { id: "token", name: "Token issue and verification", layer: "policy", build: "partly", prototype: "The registry issues HMAC-signed tokens that the gateway verifies for signature, issuer, expiry and shape. They are not JWTs.", production: "Signed JWTs verified with published keys, short lifetimes and a refresh flow.", owner: "BNY Security", code: { file: "lib/a2a/auth.ts", has: "verifyToken" } },
  { id: "registry", name: "Registry and membership", layer: "policy", build: "enforced", prototype: "Verified members, attested domains and approved skills, checked on every message.", production: "A governed registry with change control, dual approval and its own audit trail.", owner: "BNY Security", code: { file: "lib/a2a/registry.ts", has: "membershipFor" } },
  { id: "scopes", name: "Skill scopes", layer: "policy", build: "enforced", prototype: "A skill must be in both the token and the registry before the gateway lets it through.", production: "The same two-sided check.", owner: "BNY Operations", code: { file: "lib/a2a/gateway.ts", has: "not in approved scopes" } },
  { id: "signature", name: "Message signature and fresh nonce", layer: "policy", build: "simulated", prototype: "A flag stands in for a failed signature or a reused nonce. No signature is verified and no nonce is stored.", production: "Signature check on every message and a shared nonce store, with idempotent handling of honest retries.", owner: "BNY Platform", code: { file: "lib/a2a/gateway.ts", has: "replayedNonce" } },
  { id: "allowlist-in", name: "Inbound field allowlist", layer: "policy", build: "enforced", prototype: "Fields outside the list are dropped before BNY's agents see them.", production: "Per-skill schemas, validated strictly.", owner: "BNY Security", code: { file: "lib/a2a/gateway.ts", has: "INBOUND_ALLOWLIST" } },
  { id: "injection", name: "Injection scan", layer: "policy", build: "partly", prototype: "A tripwire for obvious overrides. It is easily evaded, so the real defence is that text only ever arrives as quoted, untrusted data and the outbound filter cannot be talked out of its rules.", production: "A tripwire plus monitoring. Never the only control.", owner: "BNY Security", code: { file: "lib/a2a/gateway.ts", has: "INJECTION_PATTERNS" } },
  { id: "turns", name: "Turn limit", layer: "policy", build: "enforced", prototype: "A case ends after ten messages and goes to people.", production: "Turn, time and cost limits per case.", owner: "BNY Operations", code: { file: "lib/a2a/gateway.ts", has: "MAX_TURNS" } },
  { id: "rate", name: "Rate limiting", layer: "infra", build: "missing", prototype: "None. Mentioned in Secured as the next step in the pipeline.", production: "Per-member request and cost limits at the edge.", owner: "BNY Infrastructure" },
  { id: "allowlist-out", name: "Outbound allowlist, labels and disclosure scan", layer: "policy", build: "enforced", prototype: "Approved fields only; client-labelled fields blocked; client names and internal identifiers scrubbed from text.", production: "The same filter, with the allowlist owned and reviewed by data governance.", owner: "BNY Data Governance", code: { file: "lib/a2a/gateway.ts", has: "OUTBOUND_ALLOWLIST" } },
  { id: "terms", name: "Usage terms", layer: "policy", build: "partly", prototype: "Purpose, retention and no-training terms are attached to every outbound message. Nothing enforces them on the receiving side.", production: "The same terms, backed by the signed agreement.", owner: "BNY Legal", code: { file: "lib/a2a/gateway.ts", has: "usageTerms" } },
  { id: "suspend", name: "Suspension", layer: "policy", build: "enforced", prototype: "A suspended firm's valid token is refused on the next message.", production: "The same registry check, with an operator console and paging.", owner: "BNY Security", code: { file: "lib/a2a/registry.ts", has: "suspendFirm" } },
  { id: "approval", name: "Human approval gates", layer: "policy", build: "enforced", prototype: "The client email, exception and release each wait for a named person.", production: "The same gates inside Eliza and BNY's case tooling.", owner: "BNY Operations" },
  { id: "audit", name: "Audit trail", layer: "policy", build: "enforced", prototype: "Every action, the data it touched and the fields shared are recorded and browsable.", production: "An immutable store feeding security monitoring and retention rules.", owner: "BNY Security" },
];

// ---------------------------------------------------------------------------------------------

export const SECTIONS = [
  { id: "lifecycle", label: "Before day one", title: "Connecting to the outside world starts months before the first message" },
  { id: "map", label: "The connection", title: "Where trust is established, and where the data crosses" },
  { id: "case", label: "A live case", title: "The same case, as an A2A task" },
  { id: "drills", label: "When it goes wrong", title: "Ordinary failures, and what BNY does about them" },
  { id: "controls", label: "Protocol vs policy", title: "What A2A gives BNY, and what BNY has to build" },
] as const;
