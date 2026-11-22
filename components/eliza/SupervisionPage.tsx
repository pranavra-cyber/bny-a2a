"use client";
// Supervision: BNY's backstage for the case. It plays the scripted narration of the agents'
// reasoning as an append-only log in lanes, with the real gateway checks and shared/withheld
// fields from the run spliced in. Only BNY's Settlement Ops lead (live) and Compliance
// (read-only, once the case has closed) can open it; nothing is fetched for anyone else.
import { useEffect, useMemo, useRef, useState } from "react";
import { type SupervisionAccess, supervisionAccess } from "@/lib/personas";
import { LANES, type LogItem, type LogLane, buildSupervisionLog } from "../a2a/supervisionLog";
import { useProto } from "../proto/Proto";
import { ErrorNote, Pill } from "../ui";
import { useRun } from "../useRun";
import { Shell } from "./Shell";

const SPEEDS = [0.5, 1, 2, 4] as const;
const COL: Record<LogLane, string> = { goldman: "md:col-start-1", gateway: "md:col-start-2", orchestrator: "md:col-start-3", tools: "md:col-start-4" };

export function SupervisionPage() {
  const { persona, runId, summary, hydrated } = useProto();
  const access = supervisionAccess(persona.id, summary?.status);
  const note = (text: string) => <p className="mx-auto max-w-xl px-6 py-12 text-sm text-muted">{text}</p>;
  let body: React.ReactNode;
  if (!hydrated) body = null;
  else if (!access) body = note("Supervision is BNY's own backstage. It is available to BNY's Settlement Operations lead and Compliance only.");
  else if (!runId) body = note("No case has run yet. Start the live case first.");
  else if (access === "waiting-for-close") body = note("This case is still open. Compliance can review the supervision log once the case has closed.");
  else body = <Backstage runId={runId} access={access} />;
  return <Shell title="Supervision" subtitle={access ? "BNY backstage · how the agents reasoned, and what the gateway did" : undefined}>{body}</Shell>;
}

function Backstage({ runId, access }: { runId: string; access: Exclude<SupervisionAccess, "waiting-for-close"> }) {
  const { summary, events, error } = useRun(runId, "network");
  const log = useMemo(() => (summary ? buildSupervisionLog(summary.scenario, events) : null), [summary, events]);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const available = log?.available ?? 0;
  const visible = Math.min(shown, available);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-play: append the next item after a pause, only once the run has reached it.
  useEffect(() => {
    if (!playing || !log || visible >= available) return;
    const t = setTimeout(() => setShown(visible + 1), (log.items[visible].source === "narration" ? 1800 : 1000) / speed);
    return () => clearTimeout(t);
  }, [playing, log, visible, available, speed]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [visible]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-5 pb-28">
      <div className="flex flex-wrap items-center gap-3">
        <Pill tone={access === "live" ? "teal" : "neutral"}>{access === "live" ? "Live" : "Read-only · case closed"}</Pill>
        <p className="min-w-0 flex-1 text-xs text-muted">
          <span className="font-semibold text-ink">Narration is scripted.</span> The reasoning text was written for this demo; it is not live model output. Gateway checks, fields shared and withheld, and the messages are read from the run.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm">
        <button onClick={() => setPlaying(!playing)} aria-pressed={playing} className="rounded-md bg-navy px-3 py-1.5 font-medium text-white hover:bg-teal">
          {playing ? "Pause" : "Auto-play"}
        </button>
        <button
          onClick={() => {
            setPlaying(false);
            setShown(visible + 1);
          }}
          disabled={visible >= available}
          className="rounded-md border border-line px-3 py-1.5 font-medium text-ink hover:bg-canvas disabled:opacity-40"
        >
          Step
        </button>
        <label className="ml-2 flex items-center gap-1.5 text-xs text-muted">
          Speed
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value) as (typeof SPEEDS)[number])} className="rounded-md border border-line bg-white px-2 py-1 text-sm text-ink">
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
        <span className="ml-auto text-xs text-muted tabular">
          {visible} of {log?.items.length ?? 0}
          {log && available < log.items.length ? " · waiting for the run" : ""}
        </span>
      </div>

      {error && <ErrorNote error={error} className="mt-4" />}
      {summary && !log && <p className="mt-6 text-sm text-muted">There is no supervision script for this scenario ({summary.scenario}).</p>}

      {log && (
        <>
          <div className="mt-5 hidden grid-cols-4 gap-3 border-b border-line pb-2 text-xs font-semibold tracking-wide text-muted uppercase md:grid">
            {LANES.map((l) => (
              <span key={l.id}>{l.label}</span>
            ))}
          </div>
          <ol role="log" aria-label="Supervision log" className="mt-3 space-y-3">
            {log.items.slice(0, visible).map((it) => (
              <li key={it.key} className="grid gap-3 md:grid-cols-4">
                <div className={COL[it.lane]}>
                  <Item it={it} />
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
      <div ref={endRef} />
    </div>
  );
}

function Item({ it }: { it: LogItem }) {
  const lane = LANES.find((l) => l.id === it.lane)!.label;
  if (it.source === "narration")
    return (
      <article className="dock-in rounded-lg border border-dashed border-line bg-canvas px-3 py-2">
        <p className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded bg-white px-1.5 py-px font-semibold tracking-wide text-muted uppercase ring-1 ring-line">narration</span>
          <span className="text-muted capitalize">{it.phase}</span>
          <span className="text-muted">· {lane}</span>
        </p>
        <p className="mt-1 text-sm leading-snug text-muted italic">{it.text}</p>
      </article>
    );
  const fieldsLabel = it.lane === "goldman" ? "Fields sent" : "Shared";
  return (
    <article className="dock-in rounded-lg border border-line bg-white px-3 py-2">
      <p className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded bg-teal-soft px-1.5 py-px font-semibold tracking-wide text-navy uppercase">from the run</span>
        <span className="text-muted">{lane}</span>
      </p>
      <h3 className="mt-1 text-sm font-semibold text-navy">{it.title}</h3>
      {it.text && <p className="mt-1 text-xs whitespace-pre-wrap text-ink">{it.text}</p>}
      {it.checks && (
        <ul className="mt-2 space-y-0.5 text-xs">
          {it.checks.map((c) => (
            <li key={c.id}>
              <span className={c.ok ? "text-ok" : c.id === "injection" || c.id === "fields" || c.id === "disclosure" ? "text-warn" : "text-bad"}>{c.ok ? "✓" : "✗"}</span> <span className="font-medium">{c.label}</span> <span className="text-muted">{c.detail}</span>
            </li>
          ))}
        </ul>
      )}
      {it.shared && it.shared.length > 0 && (
        <div className="mt-2 text-xs">
          <span className="text-muted">{fieldsLabel}: </span>
          {it.shared.map((f) => (
            <span key={f} className="mr-1 inline-block font-mono text-ok">
              {f}
            </span>
          ))}
        </div>
      )}
      {it.withheld && (
        <p className="mt-1 text-xs text-warn">{it.withheld.length ? `Withheld: ${it.withheld.join(" · ")}` : "Nothing needed withholding"} · client name, account and fund are never sent</p>
      )}
    </article>
  );
}
