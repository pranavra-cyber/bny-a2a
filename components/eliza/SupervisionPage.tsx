"use client";
// Supervision: BNY's backstage for the case, as a chat. A scripted conversation shows how the agents
// reasoned about the inquiry, with the real gateway checks and shared/withheld fields (snapshotted from
// the recording) in their bubbles. It plays on its own timeline from the first message and does not
// depend on the run. Only BNY's Settlement Ops lead and, once the case has closed, Compliance (read-only)
// can open it; nothing renders for anyone else.
import { useEffect, useRef, useState } from "react";
import { type ChatMessage, SCENARIO_LABEL, SPEAKER_LABEL, SUPERVISED, type SupervisedScenario, SUPERVISION } from "@/lib/engine/supervision";
import { supervisionAccess } from "@/lib/personas";
import { useProto } from "../proto/Proto";
import { Shell } from "./Shell";

const SPEEDS = [0.5, 1, 2, 4] as const;
type Speed = (typeof SPEEDS)[number];

/** A short typing pause before each message, longer for longer text. */
const pauseFor = (m: ChatMessage) => 500 + Math.min(m.text.length, 220) * 4 + (m.candidates ? 400 : 0);

export function SupervisionPage() {
  const { persona, summary, hydrated } = useProto();
  const access = supervisionAccess(persona.id, summary?.status);
  const note = (text: string) => <p className="mx-auto max-w-xl px-6 py-12 text-sm text-muted">{text}</p>;
  let body: React.ReactNode;
  if (!hydrated) body = null;
  else if (!access) body = note("Supervision is BNY's own backstage. It is available to BNY's Settlement Operations lead and Compliance only.");
  else if (access === "waiting-for-close") body = note("This case is still open. Compliance can review the supervision conversation once the case has closed.");
  else body = <Chat readOnly={access === "read-only"} initial={SUPERVISED.includes(summary?.scenario as SupervisedScenario) ? (summary!.scenario as SupervisedScenario) : "golden"} />;
  return <Shell title="Supervision" subtitle={access ? "BNY backstage · how the agents reasoned, and what the gateway did" : undefined}>{body}</Shell>;
}

function Chat({ readOnly, initial }: { readOnly: boolean; initial: SupervisedScenario }) {
  const [scenario, setScenario] = useState(initial);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<Speed>(1);
  const script = SUPERVISION[scenario];
  const done = shown >= script.length;
  const next = script[shown];
  const typing = playing && !done;
  const endRef = useRef<HTMLDivElement>(null);

  // One message at a time: the next speaker "types", then the message appears.
  useEffect(() => {
    if (!playing || done) return;
    const t = setTimeout(() => setShown(shown + 1), pauseFor(next) / speed);
    return () => clearTimeout(t);
  }, [playing, done, shown, next, speed]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [shown, typing]);

  const restart = () => {
    setShown(0);
    setPlaying(true);
  };
  const btn = "rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-40";
  return (
    <div className="mx-auto max-w-3xl px-5 py-5 pb-28">
      <div className="proto rounded-lg bg-[#0b0d12] px-4 py-3 text-[#d7dde8]">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setPlaying(!playing)} disabled={done} aria-pressed={playing} className={btn}>
            {playing && !done ? "Pause" : "Auto-play"}
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              setShown(Math.min(shown + 1, script.length));
            }}
            disabled={done}
            className={btn}
          >
            Step
          </button>
          <button onClick={restart} className={btn}>
            Restart
          </button>
          <label className="ml-1 flex items-center gap-1.5 text-xs text-white/50">
            Speed
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value) as Speed)} className="rounded-md border border-white/15 bg-[#0b0d12] px-2 py-1 text-sm text-white">
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s}×
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-white/50">
            Scenario
            <select
              value={scenario}
              onChange={(e) => {
                setScenario(e.target.value as SupervisedScenario);
                restart();
              }}
              className="rounded-md border border-white/15 bg-[#0b0d12] px-2 py-1 text-sm text-white"
            >
              {SUPERVISED.map((s) => (
                <option key={s} value={s}>
                  {SCENARIO_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <span className="ml-auto text-xs text-white/50 tabular">
            {shown} of {script.length}
          </span>
        </div>
        <p className="mt-2 text-xs text-white/55">
          <span className="font-semibold text-white/80">Narration is scripted.</span>{" "}
          It was written for this demo and is not live model output. Bubbles tagged &quot;from the run&quot; carry the real gateway checks, fields and messages from the recorded case, and play the same whatever the run is doing.
          {readOnly && <span className="ml-2 rounded bg-white/10 px-1.5 py-px text-white/70">Read-only · case closed</span>}
        </p>
      </div>

      <ol role="log" aria-label="Supervision conversation" className="mt-5 space-y-3">
        {script.slice(0, shown).map((m) => (
          <li key={m.id}>
            <Bubble m={m} />
          </li>
        ))}
        {typing && (
          <li aria-hidden className="dock-in flex items-center gap-2 text-xs text-muted">
            <SpeakerBadge m={next} />
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </span>
          </li>
        )}
      </ol>
      {done && <p className="mt-5 text-center text-xs text-muted">End of the conversation. Restart to play it again.</p>}
      <div ref={endRef} />
    </div>
  );
}

const BADGE = {
  goldman: "bg-gs-soft text-gs",
  gateway: "bg-navy text-white",
  orchestrator: "bg-teal-soft text-navy",
  tool: "bg-canvas text-ink ring-1 ring-line",
} as const;

function SpeakerBadge({ m }: { m: ChatMessage }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[m.speaker]}`}>{m.speaker === "tool" ? `Tool · ${m.tool}` : SPEAKER_LABEL[m.speaker]}</span>;
}

function Bubble({ m }: { m: ChatMessage }) {
  const narration = m.source === "narration";
  const failed = m.checks?.filter((c) => !c.ok) ?? [];
  return (
    <article className={`dock-in rounded-lg px-3.5 py-2.5 ${narration ? "border border-dashed border-line bg-canvas" : "border border-line bg-white"}`}>
      <p className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <SpeakerBadge m={m} />
        {m.to && <span className="text-muted">→ {m.to}</span>}
        <span className={`rounded px-1.5 py-px font-semibold tracking-wide uppercase ${narration ? "bg-white text-muted ring-1 ring-line" : "bg-teal-soft text-navy"}`}>{narration ? "narration" : "from the run"}</span>
        <span className="text-muted">{m.step}</span>
      </p>
      <p className={`mt-1.5 text-sm leading-snug ${narration ? "text-muted italic" : "text-ink"}`}>{m.text}</p>

      {m.candidates && (
        <ul className="mt-2 space-y-1 text-sm">
          {m.candidates.map((c) => (
            <li key={c.name} className="flex flex-wrap items-baseline gap-x-2 rounded bg-white px-2 py-1 ring-1 ring-line">
              <span className="font-mono text-xs font-medium text-navy">{c.name}</span>
              <span className="text-[11px] text-muted">({c.kind})</span>
              <span className="text-xs text-muted not-italic">{c.purpose}</span>
              <span className={`ml-auto text-[11px] font-semibold ${c.selected ? "text-ok" : "text-muted"}`}>{c.selected ? "✓ will call" : "not needed"}</span>
            </li>
          ))}
        </ul>
      )}
      {m.footer && <p className={`mt-2 text-sm leading-snug ${narration ? "text-muted italic" : "text-ink"}`}>{m.footer}</p>}

      {m.fields && m.fields.length > 0 && (
        <p className="mt-2 text-xs">
          <span className="text-muted">Fields sent: </span>
          {m.fields.map((f) => (
            <span key={f} className="mr-1.5 inline-block font-mono text-ok">
              {f}
            </span>
          ))}
        </p>
      )}
      {m.checks && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer font-medium text-teal">
            {m.checks.length} checks · {failed.length ? `${failed.length} flagged` : "all passed"}
          </summary>
          <ul className="mt-1 space-y-0.5">
            {m.checks.map((c) => (
              <li key={c.id}>
                <span className={c.ok ? "text-ok" : "text-warn"}>{c.ok ? "✓" : "⚑"}</span> <span className="font-medium">{c.label}</span> <span className="text-muted">{c.detail}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {m.shared && (
        <div className="mt-2 space-y-0.5 text-xs">
          <p>
            <span className="text-muted">Sharing: </span>
            {m.shared.map((f) => (
              <span key={f} className="mr-1.5 inline-block font-mono text-ok">
                {f}
              </span>
            ))}
          </p>
          <p className="text-warn">
            Withheld by the filter in this run: {m.withheld?.length ? m.withheld.join(" · ") : "nothing needed withholding"}. Never sent: {m.neverSent}.
          </p>
        </div>
      )}
    </article>
  );
}
