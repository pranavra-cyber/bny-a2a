"use client";
// "Secured": a legitimate Goldman connection to BNY, established and secured end to end, played as a
// chat (Goldman's agent on the right, BNY's systems on the left). It plays from scratch on open, one
// bubble at a time with a typing pause; handshake and entitlement lines appear one by one. A
// prototype stage like the attack console, so it keeps the dark prototype look, and every bubble says
// whether the prototype enforces that step in code or only simulates it.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PROVENANCE_LABEL, type Provenance, SECURED, type SecuredMessage, SPEAKER_LABEL, type Speaker } from "@/lib/securedScript";
import { PersonaDock } from "../proto/PersonaDock";

const SPEEDS = [0.5, 1, 2, 4] as const;
type Speed = (typeof SPEEDS)[number];

const unitsOf = (m: SecuredMessage) => 1 + (m.steps?.length ?? 0);
const pauseFor = (m: SecuredMessage) => 700 + Math.min((m.text ?? "").length, 140) * 4 + (m.code || m.split ? 500 : 0);
const STEP_MS = 800;
const HOLD_MS = 600;

const COLOR: Record<Speaker, string> = {
  goldman: "text-[#7fb2ff]",
  card: "text-[#8fd3c7]",
  auth: "text-[#8fd3c7]",
  tls: "text-[#8fd3c7]",
  gate: "text-[#f0c674]",
  registry: "text-[#c9a7ff]",
  bny: "text-[#8fd3c7]",
  orchestrator: "text-[#8fd3c7]",
  audit: "text-[#c9a7ff]",
};
const PROV: Record<Provenance, string> = {
  enforced: "bg-[#3fbf7f]/15 text-[#3fbf7f]",
  partly: "bg-[#3fbf7f]/10 text-[#9bd9b8]",
  simulated: "bg-[#f0c674]/15 text-[#f0c674]",
  illustrative: "bg-white/10 text-white/55",
};

export function SecuredPipeline() {
  const [shown, setShown] = useState(0);
  const [stage, setStage] = useState<"typing" | "reveal">("typing");
  const [unit, setUnit] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<Speed>(1);
  const done = shown >= SECURED.length;
  const next = SECURED[shown];
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!playing || done) return;
    const total = unitsOf(next);
    const advance =
      stage === "typing" ? () => (setStage("reveal"), setUnit(1)) : unit < total ? () => setUnit(unit + 1) : () => (setShown(shown + 1), setStage("typing"), setUnit(0));
    const wait = stage === "typing" ? pauseFor(next) : unit < total ? STEP_MS : HOLD_MS;
    const t = setTimeout(advance, wait / speed);
    return () => clearTimeout(t);
  }, [playing, done, shown, stage, unit, next, speed]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: stage === "reveal" ? "auto" : "smooth" });
  }, [shown, stage, unit]);

  const restart = () => {
    setShown(0);
    setStage("typing");
    setUnit(0);
    setPlaying(true);
  };
  const btn = "rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-40";
  return (
    <div className="proto min-h-svh bg-[#0b0d12] font-sans text-[#d7dde8]">
      <header className="flex flex-wrap items-center gap-4 border-b border-white/10 px-6 py-3">
        <span className="font-mono text-sm font-semibold tracking-wide text-[#3fbf7f]">secured</span>
        <span className="text-xs text-white/40">Prototype stage · a legitimate connection, established and secured end to end</span>
        <Link href="/prototype" className="ml-auto text-xs text-white/50 hover:text-white/80">
          Prototype overview
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-5 pb-28">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
          <button onClick={() => setPlaying(!playing)} disabled={done} aria-pressed={playing} className={btn}>
            {playing && !done ? "Pause" : "Auto-play"}
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              setShown(Math.min(shown + 1, SECURED.length));
              setStage("typing");
              setUnit(0);
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
          <span className="ml-auto text-xs text-white/50 tabular">
            {shown} of {SECURED.length}
          </span>
          <p className="w-full text-xs text-white/55">
            <span className="font-semibold text-white/80">An illustrative walkthrough of the target pipeline.</span> Names, ids and values are synthetic examples. The tag on each message says what this prototype does with that step: enforced in its code, partly enforced, or simulated with no real cryptography (mTLS, RS256/JWKS signatures and rate limits are simulated; tokens are HMAC-signed by the registry).
          </p>
        </div>

        <div className="mt-4 flex justify-between px-1 font-mono text-[10px] tracking-[0.14em] text-white/35 uppercase">
          <span>BNY</span>
          <span>Goldman</span>
        </div>
        <ol role="log" aria-label="The security pipeline, as a conversation" className="mt-2 space-y-2.5">
          {SECURED.slice(0, shown).map((m) => (
            <Row key={m.id} m={m} />
          ))}
          {!done && stage === "reveal" && <Row key={next.id} m={next} reveal={unit} />}
          {playing && !done && stage === "typing" && <Typing m={next} />}
        </ol>
        {done && <p className="mt-6 text-center text-xs text-white/40">End of the exchange. Restart to play it again.</p>}
        <div ref={endRef} />
      </main>
      <PersonaDock />
    </div>
  );
}

const side = (m: SecuredMessage) => (m.speaker === "goldman" ? "right" : "left");

function Typing({ m }: { m: SecuredMessage }) {
  const right = side(m) === "right";
  return (
    <li aria-label="Typing" className={`dock-in flex flex-col gap-1 ${right ? "items-end" : "items-start"}`}>
      <span className={`font-mono text-[11px] font-semibold ${COLOR[m.speaker]}`}>{SPEAKER_LABEL[m.speaker]}</span>
      <span className={`flex gap-1 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3 ${right ? "rounded-tr-sm" : "rounded-tl-sm"}`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/40" style={{ animationDelay: `${i * 160}ms` }} />
        ))}
      </span>
    </li>
  );
}

function Row({ m, reveal }: { m: SecuredMessage; reveal?: number }) {
  const right = side(m) === "right";
  const r = reveal ?? Infinity;
  const steps = m.steps?.slice(0, Math.max(0, r - 1));
  return (
    <>
      {m.phase && (
        <li className="dock-in flex items-center gap-3 pt-3 font-mono text-[11px] tracking-wide text-white/40 uppercase">
          <span className="h-px flex-1 bg-white/10" />
          {m.phase}
          <span className="h-px flex-1 bg-white/10" />
        </li>
      )}
      <li className={`dock-in flex flex-col gap-1 ${right ? "items-end" : "items-start"}`}>
        <p className={`flex flex-wrap items-center gap-1.5 font-mono text-[11px] ${right ? "justify-end" : ""}`}>
          <span className={`font-semibold ${COLOR[m.speaker]}`}>{SPEAKER_LABEL[m.speaker]}</span>
          <span className={`rounded px-1.5 py-px text-[9px] font-semibold tracking-wide uppercase ${PROV[m.provenance]}`}>{PROVENANCE_LABEL[m.provenance]}</span>
        </p>
        <article className={`max-w-[92%] rounded-2xl border px-4 py-2.5 ${right ? "rounded-tr-sm border-[#7fb2ff]/30 bg-[#7fb2ff]/10" : "rounded-tl-sm border-white/10 bg-white/[0.04]"}`}>
          {m.text && <p className="text-sm leading-snug text-white">{m.text}</p>}
          {steps && steps.length > 0 && (
            <ul className="mt-1.5 space-y-1 text-[13px] text-white/80">
              {steps.map((s) => (
                <li key={s} className="dock-in">
                  {s}
                </li>
              ))}
            </ul>
          )}
          {m.code && <Code lang={m.code.lang} body={m.code.body} />}
          {m.split && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-[#3fbf7f]/30 bg-[#3fbf7f]/[0.07] p-2.5">
                <p className="font-mono text-[10px] font-semibold tracking-wide text-[#3fbf7f] uppercase">Shared with Goldman</p>
                <p className="text-[10px] text-white/45">fields in fields_allowed_outbound</p>
                <Code lang="json" body={m.split.shared} />
              </div>
              <div className="rounded-lg border border-[#e0484c]/30 bg-[#e0484c]/[0.07] p-2.5">
                <p className="font-mono text-[10px] font-semibold tracking-wide text-[#ff8a8d] uppercase">Withheld from Goldman</p>
                <p className="text-[10px] text-white/45">fields in fields_blocked_outbound · BNY&apos;s view only</p>
                <ul className="mt-1.5 space-y-0.5 font-mono text-[11px] text-white/75">
                  {m.split.withheld.map((w) => (
                    <li key={w} className="break-all">
                      <span className="text-[#e0484c]">██</span> {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {m.caption && <p className="mt-2 text-xs text-white/60 italic">{m.caption}</p>}
        </article>
      </li>
    </>
  );
}

function Code({ lang, body }: { lang: string; body: string }) {
  return (
    <pre aria-label={lang} className={`mt-2 overflow-auto rounded bg-black/40 px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre text-white/80 ${lang === "yaml" ? "" : "max-h-80"}`}>
      {body}
    </pre>
  );
}
