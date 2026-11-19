// In-memory state for one run: scenario clock, event stream, audit log, budget
// and pending human approvals. Subscribers (SSE streams) are notified on every change.
import "server-only";
import crypto from "node:crypto";
import { Budget } from "../llm/budget";
import { etToIso } from "../time";
import { type Checkpoint, type Seat, stageIndexOf } from "./guide";
import type {
  ApprovalKind,
  AuditEntry,
  EscalationReason,
  RunEvent,
  RunMode,
  RunStatus,
  RunSummary,
  Scenario,
} from "./types";

export const SCENARIO_DATE = "2026-11-19";
export const SCENARIO_START = etToIso(SCENARIO_DATE, "09:02:00");
/** Client instructions for same-day DVP settlement must reach BNY by 11:30 ET (procedures §3). */
export const CUTOFF = etToIso(SCENARIO_DATE, "11:30:00");
/** After 11:30 a late instruction needs a manager's exception, approved by 14:45 ET; DTC DVP processing ends 15:10 ET. */
export const LATE_EXCEPTION_CUTOFF = etToIso(SCENARIO_DATE, "14:45:00");
export const DTC_CLOSE = etToIso(SCENARIO_DATE, "15:10:00");

/** Whose turn an approval is. */
export const APPROVAL_SEAT: Record<ApprovalKind, Seat> = { "bny-client-message": "bny-cs", "gs-redelivery": "goldman", "bny-late-exception": "bny" };

export class ScenarioClock {
  private t: number;
  constructor(start = SCENARIO_START) {
    this.t = new Date(start).getTime();
  }
  get iso() {
    return new Date(this.t).toISOString();
  }
  advance(seconds: number) {
    this.t += Math.round(seconds * 1000);
  }
  set(iso: string) {
    this.t = new Date(iso).getTime();
  }
  /** Move to a scripted ET time on the scenario date (never backwards). */
  at(hhmmss: string) {
    this.t = Math.max(this.t, new Date(etToIso(SCENARIO_DATE, hhmmss)).getTime());
  }
}

export type Decision = { outcome: string; by: string };
type EventInput = Omit<RunEvent, "seq" | "at" | "wallMs">;

export class Run {
  readonly id: string;
  readonly startedAt = new Date();
  status: RunStatus = "running";
  statusReason?: string;
  events: RunEvent[] = [];
  audit: AuditEntry[] = [];
  clock = new ScenarioClock();
  turns = 0;
  toolCalls = 0;
  negotiationMinutes = 0;
  /** Skip artificial latency (tests and headless recording). */
  fast = false;
  recordedMode?: "live" | "mock";
  recordedModel?: string;
  /** Instruction/record state changed by the mock settlement system during this run. */
  overlay = new Map<string, Record<string, string>>();
  /** Guided case: checkpoints wait for the user instead of passing straight through. */
  guided = false;
  /** Unattended runs (safety demo): approvals are decided by the named person after a short pause. */
  autoApprove?: Partial<Record<ApprovalKind, [outcome: string, by: string]>>;
  private copilotBusy = false;
  /** Whose assistant is answering right now (questions can come from any seat at any time). */
  busySeat: Seat | null = null;
  private pending = new Map<ApprovalKind, (d: Decision) => void>();
  private cp?: { def: Checkpoint; seq: number; resolve: (action: string) => void };
  private cpWaiters: (() => void)[] = [];
  private listeners = new Set<(e: RunEvent | null) => void>();

  constructor(
    readonly scenario: Scenario,
    readonly mode: RunMode,
    readonly model: string,
    readonly budget: Budget,
  ) {
    this.id = `r_${crypto.randomBytes(4).toString("hex")}`;
  }

  emit(input: EventInput & { at?: string }): RunEvent {
    const event: RunEvent = { ...input, seq: this.events.length + 1, at: input.at ?? this.clock.iso, wallMs: Date.now() - this.startedAt.getTime() };
    this.events.push(event);
    for (const l of this.listeners) l(event);
    return event;
  }

  log(entry: Omit<AuditEntry, "seq" | "at" | "afterSeq"> & { at?: string }) {
    this.audit.push({ ...entry, seq: this.audit.length + 1, at: entry.at ?? this.clock.iso, afterSeq: this.events.length });
  }

  setStatus(status: RunStatus, reason?: string) {
    this.status = status;
    this.statusReason = reason;
    for (const l of this.listeners) l(null);
  }

  awaitApproval(kind: ApprovalKind): Promise<Decision> {
    this.setStatus("awaiting-approval", kind);
    const p = new Promise<Decision>((resolve) => this.pending.set(kind, resolve));
    const auto = this.autoApprove?.[kind];
    if (auto) setTimeout(() => this.decide(kind, auto[0], auto[1]), this.fast ? 0 : 1500);
    return p;
  }

  decide(kind: ApprovalKind, outcome: string, by: string): boolean {
    const resolve = this.pending.get(kind);
    if (!resolve) return false;
    this.pending.delete(kind);
    this.setStatus("running");
    resolve({ outcome, by });
    return true;
  }

  /** Waits for the user's choice at a checkpoint (unguided runs take the primary action). */
  awaitCheckpoint(def: Checkpoint, seq: number): Promise<string> {
    if (!this.guided) return Promise.resolve((def.actions.find((a) => a.kind === "primary") ?? def.actions[0]).id);
    return new Promise((resolve) => {
      this.cp = { def, seq, resolve };
      this.setStatus("awaiting-input", def.id);
      for (const w of this.cpWaiters.splice(0)) w();
    });
  }

  resolveCheckpoint(action: string): boolean {
    const cp = this.cp;
    if (!cp || !cp.def.actions.some((a) => a.id === action)) return false;
    this.cp = undefined;
    this.setStatus("running");
    cp.resolve(action);
    return true;
  }

  get pendingCheckpoint() {
    return this.cp ? { def: this.cp.def, seq: this.cp.seq } : undefined;
  }

  /** Resolves once a checkpoint is pending (immediately if one already is). */
  whenCheckpoint(): Promise<void> {
    return this.cp ? Promise.resolve() : new Promise((r) => this.cpWaiters.push(r));
  }

  get copilotWorking() {
    return this.copilotBusy;
  }

  set copilotWorking(v: boolean) {
    this.copilotBusy = v;
    if (!v) this.busySeat = null;
    for (const l of this.listeners) l(null);
  }

  get pendingApprovals(): ApprovalKind[] {
    return [...this.pending.keys()];
  }

  async latency(minMs = 300, maxMs = 800) {
    if (this.fast) return;
    await new Promise((r) => setTimeout(r, minMs + Math.random() * (maxMs - minMs)));
  }

  escalated(reason: EscalationReason) {
    this.setStatus("escalated", reason);
  }

  subscribe(fn: (e: RunEvent | null) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  summary(): RunSummary {
    return {
      id: this.id,
      scenario: this.scenario,
      mode: this.mode,
      recordedMode: this.recordedMode,
      recordedModel: this.recordedModel,
      model: this.model,
      status: this.status,
      statusReason: this.statusReason,
      startedAt: this.startedAt.toISOString(),
      clock: this.clock.iso,
      scenarioStart: SCENARIO_START,
      cutoff: CUTOFF,
      budget: this.budget.snapshot(),
      turns: this.turns,
      negotiationMinutes: this.negotiationMinutes,
      pendingApprovals: this.pendingApprovals,
      guided: this.guided,
      pendingCheckpoint: this.cp && { id: this.cp.def.id, seat: this.cp.def.seat, seq: this.cp.seq },
      copilotBusy: this.copilotBusy,
      busySeat: this.copilotBusy ? (this.busySeat ?? this.cp?.def.seat ?? null) : null,
      turn: this.cp?.def.seat ?? (this.pendingApprovals.length ? APPROVAL_SEAT[this.pendingApprovals[0]] : null),
      guideStage: this.guided ? stageIndexOf(this.events, this.status) : 0,
    };
  }
}
