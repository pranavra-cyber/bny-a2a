"use client";
// Supervision: BNY's backstage for the case, as a chat (Goldman on the left, BNY on the right). A scripted conversation shows how the agents
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

const words = (t = "") => (t ? t.split(" ") : []);
/** How many steps a bubble reveals in: a run bubble appears whole; narration streams word by word, then its tool list one by one, then its closing line. */
const unitsOf = (m: ChatMessage) => (m.source === "run" ? 1 : words(m.text).length + (m.candidates?.length ?? 0) + words(m.footer).length);
/** Milliseconds to wait before revealing the next step of a bubble. */
const unitDelay = (m: ChatMessage, unit: number) => {
  const tw = words(m.text).length;
  return unit > tw && unit <= tw + (m.candidates?.length ?? 0) ? 450 : 65;
};
const isThinking = (m: ChatMessage) => m.source === "narration" && m.speaker === "orchestrator";
/** How long the next speaker "types" first: the orchestrator thinks longest, with nothing on screen. */
const pauseFor = (m: ChatMessage) => (isThinking(m) ? (m.step === "thinking" ? 2200 : 1600) : m.speaker === "tool" ? 1000 : 650);
const HOLD_MS = 450;

const sideOf = (m: ChatMessage) => (m.speaker === "goldman" ? "left" : "right");

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
  const [shown, setShown] = useState(0); // messages fully shown
  const [stage, setStage] = useState<"typing" | "reveal">("typing"); // the next message: its speaker typing, or the message appearing
  const [unit, setUnit] = useState(0); // steps of the next message revealed so far
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<Speed>(1);
  const script = SUPERVISION[scenario];
  const done = shown >= script.length;
  const next = script[shown];
  const endRef = useRef<HTMLDivElement>(null);

  // One message at a time: the speaker types (the orchestrator "thinks", showing nothing), then the
  // message appears, narration word by word. Each step waits on a timer, so Pause freezes it where it is.
  useEffect(() => {
    if (!playing || done) return;
    const total = unitsOf(next);
    const advance =
      stage === "typing"
        ? () => (setStage("reveal"), setUnit(1))
        : unit < total
          ? () => setUnit(unit + 1)
          : () => (setShown(shown + 1), setStage("typing"), setUnit(0));
    const wait = stage === "typing" ? pauseFor(next) : unit < total ? unitDelay(next, unit) : HOLD_MS;
    const t = setTimeout(advance, wait / speed);
    return () => clearTimeout(t);
  }, [playing, done, shown, stage, unit, next, speed]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: stage === "reveal" ? "auto" : "smooth" });
  }, [shown, stage, unit]);

  const reset = () => {
    setShown(0);
    setStage("typing");
    setUnit(0);
    setPlaying(true);
  };
  const btn = "rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-40";
  const typing = playing && !done && stage === "typing";
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
              setStage("typing");
              setUnit(0);
            }}
            disabled={done}
            className={btn}
          >
            Step
          </button>
          <button onClick={reset} className={btn}>
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
                reset();
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

      <div className="mt-2 flex justify-between px-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
        <span>Goldman</span>
        <span>BNY</span>
      </div>
      <ol role="log" aria-label="Supervision conversation" className="mt-2 space-y-2.5">
        {script.slice(0, shown).map((m) => (
          <Row key={m.id} m={m} />
        ))}
        {!done && stage === "reveal" && <Row key={next.id} m={next} reveal={unit} />}
        {typing && <Typing m={next} />}
      </ol>
      {done && <p className="mt-6 text-center text-xs text-muted">End of the conversation. Restart to play it again.</p>}
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

/** The three dots models use; the orchestrator's says it is thinking, and shows nothing else. */
function Typing({ m }: { m: ChatMessage }) {
  const right = sideOf(m) === "right";
  return (
    <li aria-label={isThinking(m) ? "Thinking" : "Typing"} className={`dock-in flex flex-col gap-1 ${right ? "items-end" : "items-start"}`}>
      <SpeakerBadge m={m} />
      <span className={`flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 ring-1 ring-line ${right ? "rounded-tr-sm" : "rounded-tl-sm"}`}>
        {isThinking(m) && <span className="text-xs text-muted italic">thinking</span>}
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 160}ms` }} />
          ))}
        </span>
      </span>
    </li>
  );
}

function Row({ m, reveal }: { m: ChatMessage; reveal?: number }) {
  const right = sideOf(m) === "right";
  return (
    <li className={`dock-in flex flex-col gap-1 ${right ? "items-end" : "items-start"}`}>
      <p className={`flex flex-wrap items-center gap-1.5 text-[11px] ${right ? "justify-end" : ""}`}>
        <SpeakerBadge m={m} />
        {m.to && <span className="text-muted">→ {m.to}</span>}
        <span className={`rounded px-1.5 py-px font-semibold tracking-wide uppercase ${m.source === "narration" ? "bg-white text-muted ring-1 ring-line" : "bg-teal-soft text-navy"}`}>{m.source === "narration" ? "narration" : "from the run"}</span>
        <span className="text-muted">{m.step}</span>
      </p>
      <Bubble m={m} reveal={reveal} right={right} />
    </li>
  );
}

function Bubble({ m, reveal, right }: { m: ChatMessage; reveal?: number; right: boolean }) {
  const narration = m.source === "narration";
  const failed = m.checks?.filter((c) => !c.ok) ?? [];
  const tw = words(m.text).length;
  const cn = m.candidates?.length ?? 0;
  const r = reveal ?? Infinity;
  const text = r >= tw ? m.text : words(m.text).slice(0, r).join(" ");
  const candidates = m.candidates?.slice(0, Math.max(0, r - tw));
  const footer = r >= tw + cn ? words(m.footer).slice(0, r - tw - cn).join(" ") : "";
  const tone = narration ? "border border-dashed border-line bg-canvas" : right ? "border border-teal/30 bg-teal-soft" : "border border-line bg-white";
  return (
    <article className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${right ? "rounded-tr-sm" : "rounded-tl-sm"} ${tone}`}>
      <p className={`text-sm leading-snug ${narration ? "text-muted italic" : "text-ink"}`}>{text}</p>

      {candidates && candidates.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {candidates.map((c) => (
            <li key={c.name} className="dock-in flex flex-wrap items-baseline gap-x-2 rounded bg-white px-2 py-1 ring-1 ring-line">
              <span className="font-mono text-xs font-medium text-navy">{c.name}</span>
              <span className="text-[11px] text-muted">({c.kind})</span>
              <span className="text-xs text-muted not-italic">{c.purpose}</span>
              <span className={`ml-auto text-[11px] font-semibold ${c.selected ? "text-ok" : "text-muted"}`}>{c.selected ? "✓ will call" : "not needed"}</span>
            </li>
          ))}
        </ul>
      )}
      {footer && <p className={`mt-2 text-sm leading-snug ${narration ? "text-muted italic" : "text-ink"}`}>{footer}</p>}

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
