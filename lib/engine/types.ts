// Run, event and audit shapes shared by the engine, the API and the UI.
// Types only: safe to import from client components.
import type { GatewayCheck, TaskState } from "../a2a/types";
import type { BudgetSnapshot } from "../llm/budget";
import type { Checkpoint, CheckpointId, Seat } from "./guide";

export type Firm = "bny" | "goldman" | "allianzgi";
export type View = "goldman" | "bny" | "network";
export type ActorType = "RULE" | "AGENT" | "HUMAN";
export type Lane = "goldman" | "network" | "bny" | "allianzgi";

export type Scenario = "golden" | "fp1" | "fp2" | "fp3" | "fp4" | "fp5" | "fp6" | "fp7" | "fp8";
export type RunMode = "live" | "mock" | "replay";

export type Actor = { id: string; name: string; firm: Firm | "dtc" | "network"; type: ActorType };

/** A cited row, resolved from the citing firm's own scope, rendered as strings. */
export type ResolvedRecord = { firm: string; table: string; id: string; row: Record<string, string> };

export type ApprovalKind = "bny-client-message" | "gs-redelivery" | "bny-late-exception";

export type ApprovalRequest = {
  kind: ApprovalKind;
  firm: Firm;
  title: string;
  summary: string;
  riskClass?: string;
  diff?: { field: string; before: string; after: string }[];
  evidence: ResolvedRecord[];
  shared?: { from: string; fields: Record<string, unknown> };
  options?: { id: string; label: string; detail: string }[];
  /** A message the approver sends by hand once approved (Teams and email to the client). */
  message?: { to: string; subject: string; body: string; channels: ("teams" | "email")[] };
};

export type EscalationReason =
  | "budget"
  | "turn-limit"
  | "time-limit"
  | "grounding"
  | "unverified-claim"
  | "agent-error"
  | "rejected-by-human"
  | "unregistered-agent"
  | "forged-card"
  | "replayed-message"
  | "data-aggregation";

export type RunEvent = {
  seq: number;
  at: string; // scenario clock, ISO UTC
  wallMs: number;
  kind: "step" | "message" | "gateway" | "approval-request" | "approval" | "status" | "escalation" | "model-call" | "checkpoint" | "chat" | "notification";
  lane: Lane;
  /** Firms whose console may show this event. The network view shows everything. */
  audience: Firm[];
  actor: Actor;
  title: string;
  detail?: string;
  records?: ResolvedRecord[];
  /** Data that crossed the boundary into the audience firm, tagged "Shared by counterparty". */
  shared?: { from: string; fields: Record<string, unknown>; text?: string };
  /** Full A2A envelope; network view only. */
  envelope?: unknown;
  checks?: GatewayCheck[];
  approval?: ApprovalRequest;
  decision?: { kind: ApprovalKind; outcome: string; by: string };
  escalation?: { reason: EscalationReason; summary: string; findings: string[] };
  modelCall?: { agent: string; model: string; tokensIn: number; tokensOut: number; costUsd: number; runningUsd: number };
  taskState?: TaskState;
  /** Guided case: the copilot waits here for the user. */
  checkpoint?: Checkpoint;
  /** Guided case: a chat line between the user and their firm's copilot. */
  chat?: { role: "user" | "assistant" };
  /** Which person's chat shows this event when one firm has several (BNY Settlement Ops vs Client Service). */
  desk?: Seat;
  /** A notice to one person (title is the message): a Teams message or an in-app alert. */
  notification?: { seat: Seat; level: "action" | "info"; channel: "teams" | "app" | "email"; from: string };
  flags?: string[];
  refs?: { repairId?: string; failId?: string };
};

export type RunStatus = "running" | "awaiting-input" | "awaiting-approval" | "settled" | "settled-partial" | "escalated" | "rejected" | "failed";

export type RunSummary = {
  id: string;
  scenario: Scenario;
  mode: RunMode;
  recordedMode?: "live" | "mock";
  recordedModel?: string;
  model: string;
  status: RunStatus;
  statusReason?: string;
  startedAt: string;
  clock: string;
  scenarioStart: string;
  cutoff: string;
  budget: BudgetSnapshot;
  turns: number;
  negotiationMinutes: number;
  pendingApprovals: ApprovalKind[];
  guided: boolean;
  /** The checkpoint the copilot is waiting on, if any. */
  pendingCheckpoint?: { id: CheckpointId; seat: Seat; seq: number };
  copilotBusy: boolean;
  /** Guided case: which firm the case is waiting on, if any. Says nothing about that firm's internals. */
  turn: Seat | null;
  /** Guided case: index into STAGES of the first stage not yet done. */
  guideStage: number;
};

export type ProjectedRun = { view: View; summary: RunSummary; events: RunEvent[] };

export type AuditEntry = {
  seq: number;
  at: string;
  actor: string;
  actorType: ActorType;
  firm: string;
  action: string;
  dataAccessed: string[];
  fieldsShared: string[];
  decision: string;
  approver: string;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  runningCostUsd?: number;
  /** Number of events emitted when this entry was written (used to pace replay). */
  afterSeq: number;
};
