"use client";
// One person's assistant chat for the live case. It shows only that firm's
// projection of the run, and within BNY only that person's desk: their Teams
// trigger, the assistant's questions, approvals as messages from the
// orchestrator, the agents' work, and messages from the client.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  type Checkpoint,
  GREETING,
  INTAKE_SUGGESTIONS,
  type Seat,
  SEATS,
} from "@/lib/engine/guide";
import { FINAL, statusText } from "@/lib/engine/status";
import type { RunEvent, RunSummary } from "@/lib/engine/types";
import { personaForSeat } from "@/lib/personas";
import { fmtEt, fmtUtc } from "@/lib/time";
import { Chip, Composer } from "../chat";
import { useProto } from "../proto/Proto";
import { ApprovalCard, approvalsOf, Step } from "../Step";
import type { Notice } from "./Shell";
import { TeamsCard } from "./TeamsCard";

/** Where an answer came from: the files and versions the model read, or a note that it was a fixed answer. */
function AnswerSources({ e }: { e: RunEvent }) {
  const c = e.chat!;
  return (
    <div className="mt-2 ml-11 rounded-md border border-line bg-white/70 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2 text-muted">
        <span
          className={`font-semibold ${c.answeredBy === "model" ? "text-teal" : "text-warn"}`}
        >
          {c.answeredBy === "model"
            ? "Worked out from the data"
            : "Fixed answer (no model)"}
        </span>
        {c.costUsd !== undefined && (
          <span className="tabular">· ${c.costUsd.toFixed(4)}</span>
        )}
      </div>
      {c.sources && c.sources.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {c.sources.map((src) => (
            <li
              key={`${src.file}${src.version}${src.usedFor}`}
              className="flex flex-wrap gap-x-2"
            >
              <span className="font-mono text-navy">
                {src.file.replace(/^data\//, "")}
              </span>
              {src.version && (
                <span className="rounded bg-canvas px-1.5 text-muted">
                  {src.version}
                </span>
              )}
              {src.system && <span className="text-muted">{src.system}</span>}
              {src.usedFor && <span className="text-ink">· {src.usedFor}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const deskOf = (e: RunEvent): Seat =>
  e.desk ?? (e.lane === "goldman" ? "goldman" : "bny");

/** Notifications addressed to this person, as notices for the bell and the trigger card. */
export function noticesFor(events: RunEvent[], seat: Seat): Notice[] {
  const tz = seat === "goldman" ? fmtUtc : fmtEt;
  return events
    .filter((e) => e.kind === "notification" && e.notification?.seat === seat)
    .map((e) => ({
      id: String(e.seq),
      title: e.title,
      detail: e.detail,
      from: e.notification!.from,
      channel: e.notification!.channel,
      at: tz(e.at),
      level: e.notification!.level,
    }));
}

type Item =
  { type: "event"; e: RunEvent } | { type: "work"; events: RunEvent[] };

function thread(events: RunEvent[]): Item[] {
  const items: Item[] = [];
  let work: RunEvent[] = [];
  const flush = () => {
    if (work.length) items.push({ type: "work", events: work });
    work = [];
  };
  for (const e of events) {
    if (e.kind === "approval" || e.kind === "notification") continue;
    const standalone =
      e.kind === "chat" ||
      e.kind === "checkpoint" ||
      e.kind === "approval-request" ||
      e.kind === "escalation" ||
      e.flags?.includes("manual");
    if (standalone) {
      flush();
      items.push({ type: "event", e });
    } else work.push(e);
  }
  flush();
  return items;
}

async function postChat(
  runId: string,
  seat: Seat,
  body: { text?: string; action?: string },
) {
  const r = await fetch(`/api/runs/${runId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ view: seat, ...body }),
  });
  if (!r.ok) throw new Error((await r.json()).error ?? "message failed");
}

export function AssistantAvatar({ seat }: { seat: Seat }) {
  return seat === "goldman" ? (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gs-dark font-serif text-[11px] text-white">
      GS
    </div>
  ) : (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal to-navy text-xs font-semibold text-white">
      E
    </div>
  );
}

export function AssistantMsg({
  seat,
  children,
  label,
}: {
  seat: Seat;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <AssistantAvatar seat={seat} />
      <div className="min-w-0 max-w-[88%] flex-1">
        <div className="text-xs font-medium text-muted">
          {label ?? SEATS[seat].assistant}
        </div>
        <div className="mt-1 text-[15px] leading-relaxed whitespace-pre-wrap text-ink">
          {children}
        </div>
      </div>
    </div>
  );
}

function UserMsg({ seat, text }: { seat: Seat; text: string }) {
  return (
    <div className="flex justify-end">
      <p
        className={`max-w-[75%] rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] whitespace-pre-wrap text-white ${seat === "goldman" ? "bg-gs-dark" : "bg-navy"}`}
      >
        {text}
      </p>
    </div>
  );
}

function ClientMsg({ e }: { e: RunEvent }) {
  const email = e.actor.firm === "allianzgi";
  return (
    <div className="ml-11">
      <TeamsCard
        n={{
          id: String(e.seq),
          channel: email ? "email" : "teams",
          from: email
            ? "Emily Carter <emily.carter@example-agi.test>"
            : `${e.actor.name} → Emily Carter`,
          at: fmtEt(e.at),
          title: e.title,
          detail: e.detail,
        }}
      />
    </div>
  );
}

export function ChatThread({
  runId,
  seat,
  summary,
  events,
}: {
  runId: string;
  seat: Seat;
  summary: RunSummary | null;
  events: RunEvent[];
}) {
  const { snack } = useProto();
  const mine = events.filter((e) => deskOf(e) === seat);
  const pending =
    summary?.pendingCheckpoint?.seat === seat
      ? summary.pendingCheckpoint
      : undefined;
  const busy = !!summary?.copilotBusy && summary.busySeat === seat;
  const approvals = approvalsOf(mine);
  const decidedOf = (e: RunEvent) =>
    approvals.find((a) => a.req.seq === e.seq)?.decided;
  const awaitingMine = approvals.find((a) => !a.decided);
  const final = !!summary && FINAL.has(summary.status);
  const items = thread(mine);
  // Michael's case always opens the way it started: the greeting, then the three suggestions.
  const hasGreeting = mine.some(
    (e) =>
      (e.kind === "checkpoint" || e.kind === "chat") && e.title === GREETING,
  );
  const picked = mine.find(
    (e) => e.kind === "chat" && e.chat?.role === "user",
  )?.title;
  const lastWork = items.findLastIndex((i) => i.type === "work");
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [mine.length, pending?.seq, busy]);

  const send = async (body: { text?: string; action?: string }) => {
    if (body.action && !pending) return;
    setSending(true);
    setErr(null);
    try {
      await postChat(runId, seat, body);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const other =
    summary?.turn && summary.turn !== seat
      ? personaForSeat(summary.turn)
      : null;
  const status = !summary
    ? "Connecting…"
    : final
      ? null
      : busy
        ? `${SEATS[seat].assistant} is thinking…`
        : pending
          ? null
          : awaitingMine
            ? "Waiting for your decision above."
            : other
              ? `Waiting on ${other.name} (${other.firm === "BNY" ? other.team : other.firm}).`
              : "Agents are working…";
  const pendingDef =
    pending && mine.find((e) => e.seq === pending.seq)?.checkpoint;

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-5 px-5 py-6">
          {seat === "goldman" && !hasGreeting && <Opening picked={picked} />}
          {items.map((it, i) => {
            if (it.type === "work")
              return (
                <WorkLog
                  key={`w${it.events[0].seq}`}
                  events={it.events}
                  seat={seat}
                  defaultOpen={i === lastWork && !final}
                />
              );
            const e = it.e;
            if (e.kind === "chat" && e.chat?.role === "user")
              return <UserMsg key={e.seq} seat={seat} text={e.title} />;
            if (e.kind === "chat")
              return (
                <div key={e.seq}>
                  <AssistantMsg seat={seat}>{e.title}</AssistantMsg>
                  {e.chat?.answeredBy && <AnswerSources e={e} />}
                </div>
              );
            if (e.kind === "checkpoint")
              return (
                <div key={e.seq}>
                  <AssistantMsg seat={seat}>{e.title}</AssistantMsg>
                  {seat === "goldman" &&
                    e.title === GREETING &&
                    pending?.seq !== e.seq && <Suggestions picked={picked} />}
                  {pending?.seq === e.seq && e.checkpoint && (
                    <Choices
                      seat={seat}
                      cp={e.checkpoint}
                      disabled={sending || busy}
                      onAction={(action) => send({ action })}
                      onText={(text) => send({ text })}
                    />
                  )}
                </div>
              );
            if (e.kind === "approval-request") {
              const d = decidedOf(e);
              return (
                <div key={e.seq}>
                  <AssistantMsg
                    seat={seat}
                    label={
                      seat === "goldman"
                        ? SEATS.goldman.assistant
                        : "Settlement Fails Orchestrator"
                    }
                  >
                    {d
                      ? `${e.title}.`
                      : `${e.title}. Nothing happens until you decide.`}
                  </AssistantMsg>
                  <div className="mt-3 ml-11">
                    <ApprovalCard
                      e={e}
                      runId={runId}
                      view={seat === "goldman" ? "goldman" : "bny"}
                      decided={d}
                      onDone={(outcome, channels) => {
                        if (outcome !== "approved")
                          return snack(
                            "Rejected: the case goes to people at the firms.",
                          );
                        if (e.approval?.message)
                          snack(
                            `Email sent to ${e.approval.message.to.replace(/\s*<.*>$/, "")}`,
                          );
                        else
                          snack(`${e.approval?.title ?? "Approved"}: approved`);
                        void channels;
                      }}
                    />
                  </div>
                </div>
              );
            }
            if (e.flags?.includes("manual"))
              return <ClientMsg key={e.seq} e={e} />;
            return (
              <div key={e.seq} className="ml-11">
                <Step e={e} view={seat === "goldman" ? "goldman" : "bny"} />
              </div>
            );
          })}
          {final && summary && <Finished s={summary} seat={seat} />}
          <div ref={end} />
        </div>
      </div>
      <div className="shrink-0 border-t border-line bg-white">
        <div className="mx-auto max-w-3xl px-5 py-3">
          {status && (
            <p className="mb-2 flex items-center gap-2 text-xs text-muted">
              {!awaitingMine && !other && (
                <span
                  className={`h-2 w-2 animate-pulse rounded-full ${seat === "goldman" ? "bg-gs" : "bg-teal"}`}
                />
              )}
              {status}
            </p>
          )}
          <Composer
            tone={seat === "goldman" ? "bg-gs-dark" : "bg-navy"}
            disabled={sending || busy}
            onSend={(text) => send({ text })}
            placeholder={
              pending && pendingDef
                ? `Message ${SEATS[seat].assistant}, or ask a question`
                : "Ask about the case, the data or where it comes from…"
            }
          />
          {err && (
            <p role="alert" className="mt-1 text-sm text-bad">
              Your message didn&apos;t go through: {err}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Choices({
  seat,
  cp,
  disabled,
  onAction,
  onText,
}: {
  seat: Seat;
  cp: Checkpoint;
  disabled: boolean;
  onAction: (id: string) => void;
  onText: (t: string) => void;
}) {
  return (
    <div className="mt-3 ml-11 space-y-2">
      <div className="flex flex-wrap gap-2">
        {cp.actions.map((a) => (
          <Chip
            key={a.id}
            tone={
              a.kind === "cancel"
                ? "cancel"
                : seat === "goldman"
                  ? "primary-gs"
                  : "primary"
            }
            confirm={a.kind === "cancel"}
            disabled={disabled}
            onClick={() => onAction(a.id)}
          >
            {a.label}
          </Chip>
        ))}
        {cp.suggestions?.map((s) => (
          <Chip key={s} disabled={disabled} onClick={() => onText(s)}>
            {s}
          </Chip>
        ))}
      </div>
      {cp.questions && cp.questions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Ask:</span>
          {cp.questions.map((q) => (
            <Chip
              key={q}
              tone="question"
              disabled={disabled}
              onClick={() => onText(q)}
            >
              {q}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkLog({
  events,
  seat,
  defaultOpen,
}: {
  events: RunEvent[];
  seat: Seat;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState<boolean | null>(null);
  const shown = open ?? defaultOpen;
  const steps = events.filter((e) => e.kind !== "model-call");
  const calls = events.length - steps.length;
  return (
    <div className="ml-11 rounded-lg border border-line bg-white/60">
      <button
        onClick={() => setOpen(!shown)}
        aria-expanded={shown}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs"
      >
        <span
          className={`text-[10px] text-muted transition ${shown ? "rotate-90" : ""}`}
        >
          ▶
        </span>
        <span className="font-medium text-ink">
          {steps.length} step{steps.length === 1 ? "" : "s"} by agents and
          systems
        </span>
        {calls > 0 && (
          <span className="text-muted">
            · {calls} model call{calls === 1 ? "" : "s"}
          </span>
        )}
        {!shown && steps.length > 0 && (
          <span className="min-w-0 flex-1 truncate text-right text-muted">
            {steps[steps.length - 1].title}
          </span>
        )}
      </button>
      {shown && (
        <div className="space-y-2 border-t border-line p-3">
          {events.map((e) => (
            <Step
              key={e.seq}
              e={e}
              view={seat === "goldman" ? "goldman" : "bny"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Finished({ s, seat }: { s: RunSummary; seat: Seat }) {
  const ok = s.status.startsWith("settled");
  return (
    <div
      className={`ml-11 rounded-lg border px-4 py-3 ${ok ? "border-ok/30 bg-ok-soft" : "border-bad/30 bg-bad-soft"}`}
    >
      <p className="font-semibold text-ink">
        {ok ? "Case settled" : `Case ${statusText(s).toLowerCase()}`}
      </p>
      <p className="mt-1 text-sm text-ink">
        {ok
          ? `Resolved by ${fmtEt(s.clock)}, ${Math.round((new Date(s.clock).getTime() - new Date(s.scenarioStart).getTime()) / 60000)} minutes after the case opened, with ${s.turns} cross-firm messages and $${s.budget.spentUsd.toFixed(4)} of model spend.`
          : "People at the firms now own the case."}
      </p>
      {/* BNY's review pages are BNY's; Goldman's assistant doesn't link to them. */}
      {seat !== "goldman" && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
          <Link href="/eliza/a2a" className="text-teal hover:underline">
            Examine the A2A interaction →
          </Link>
          <Link href="/eliza/audit" className="text-teal hover:underline">
            Safety and audit →
          </Link>
          <Link href="/eliza/analytics" className="text-teal hover:underline">
            Analytics →
          </Link>
        </div>
      )}
    </div>
  );
}

/** The three suggestions Michael was offered, with the one he chose marked. */
function Suggestions({ picked }: { picked?: string }) {
  return (
    <div className="mt-3 ml-11 flex flex-wrap gap-2">
      {INTAKE_SUGGESTIONS.map((s) => (
        <span
          key={s}
          className={`rounded-full border px-3 py-1 text-sm ${s === picked ? "border-gs bg-gs text-white" : "border-line bg-white text-ink"}`}
        >
          {s}
        </span>
      ))}
    </div>
  );
}

/** For a case whose record has no greeting. */
function Opening({ picked }: { picked?: string }) {
  return (
    <div>
      <AssistantMsg seat="goldman">{GREETING}</AssistantMsg>
      <Suggestions picked={picked} />
    </div>
  );
}
