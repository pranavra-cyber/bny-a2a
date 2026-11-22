"use client";
// The attack console: a prototype stage, not a product screen. The external
// attacker and the rogue Goldman insider each pick a preset way to slip past BNY's
// gateway, launch it, and watch the real gateway code respond, as a chat: the attacker
// on the right, BNY's gateway and agents on the left.
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { type AttackBubble, chatFor } from "@/lib/attackNarration";
import { type AttackId, type AttackPreset, type AttackResult, type AttackStep, attacksBy, type Attacker } from "@/lib/attackCatalog";
import { PersonaDock } from "../proto/PersonaDock";
import { useProto } from "../proto/Proto";

const WHO: Record<Attacker, { label: string; line: string }> = {
  hacker: { label: "From outside the network", line: "No registration, no keys. Everything depends on fooling the gateway." },
  insider: { label: "From inside Goldman", line: "Drives Goldman's real, registered agent: identity checks pass, so the limits must hold." },
};

export function AttackConsole() {
  const { persona, setPersona } = useProto();
  const who: Attacker = persona.id === "insider" ? "insider" : "hacker";
  const list = attacksBy(who);
  const [sel, setSel] = useState<AttackId>(list[0].id);
  const [results, setResults] = useState<Partial<Record<AttackId, AttackResult>>>({});
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const preset = list.find((a) => a.id === sel) ?? list[0];
  const result = results[preset.id];

  useEffect(() => {
    const t = setTimeout(() => {
      setSel(attacksBy(who)[0].id);
      setShown(0);
    }, 0);
    return () => clearTimeout(t);
  }, [who]);

  // The conversation, revealed one bubble at a time: the next speaker "types" first.
  const bubbles = useMemo(() => (result ? chatFor(preset, result.steps) : []), [preset, result]);
  useEffect(() => {
    if (!result || shown > bubbles.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), shown === bubbles.length ? 900 : pauseFor(bubbles[shown]));
    return () => clearTimeout(t);
  }, [result, bubbles, shown]);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [shown]);

  const launch = async () => {
    setBusy(true);
    setErr(null);
    setShown(0);
    setResults((r) => ({ ...r, [preset.id]: undefined }));
    try {
      const r = await fetch("/api/attack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: preset.id }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "attack failed to run");
      setResults((x) => ({ ...x, [preset.id]: d }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const other: Attacker = who === "hacker" ? "insider" : "hacker";
  return (
    <div className="proto min-h-svh bg-[#0b0d12] font-sans text-[#d7dde8]">
      <header className="flex flex-wrap items-center gap-4 border-b border-white/10 px-6 py-3">
        <span className="font-mono text-sm font-semibold tracking-wide text-[#e0484c]">attack-console</span>
        <span className="text-xs text-white/40">Prototype stage · runs BNY&apos;s real gateway code · no real systems</span>
        <span className="ml-auto flex items-center gap-2 text-xs text-white/50">
          Target: <span className="font-mono text-white/80">bny.example/a2a/gateway</span>
        </span>
      </header>

      <div className="grid min-h-[calc(100svh-49px)] lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-r border-white/10 bg-white/[0.02] p-4 pb-24">
          <div className="flex items-center gap-3">
            <Image src={persona.photo} alt="" width={40} height={40} className="h-10 w-10 rounded-full ring-2 ring-[#e0484c]/60" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{persona.name}</p>
              <p className="truncate text-xs text-white/50">{persona.role}</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] font-semibold tracking-[0.14em] text-[#e0484c] uppercase">{WHO[who].label}</p>
          <p className="mt-1 text-xs text-white/55">{WHO[who].line}</p>
          <ul className="mt-4 space-y-1">
            {list.map((a) => {
              const r = results[a.id];
              return (
                <li key={a.id}>
                  <button
                    onClick={() => (setSel(a.id), setShown(r ? chatFor(a, r.steps).length + 1 : 0))}
                    aria-current={a.id === preset.id ? "true" : undefined}
                    className={`w-full rounded-md px-3 py-2 text-left transition ${a.id === preset.id ? "bg-white/10 ring-1 ring-[#e0484c]/50" : "hover:bg-white/5"}`}
                  >
                    <span className="flex items-center gap-2 text-sm text-white">
                      {a.title}
                      {r && <span className="ml-auto font-mono text-[10px] text-[#3fbf7f]">stopped</span>}
                    </span>
                    <span className="block text-[11px] text-white/45">{a.technique}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button onClick={() => setPersona(other)} className="mt-6 w-full rounded-md border border-white/10 px-3 py-2 text-left text-xs text-white/60 hover:border-white/30 hover:text-white">
            Try it {other === "insider" ? "from inside Goldman instead (rogue insider)" : "from outside the network instead (attacker)"} →
          </button>
          <Link href="/prototype" className="mt-2 block px-1 text-xs text-white/40 hover:text-white/70">
            Prototype overview
          </Link>
        </aside>

        <main className="min-w-0 p-6 pb-28">
          <Preset p={preset} />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={launch} disabled={busy} className="rounded-md bg-[#e0484c] px-5 py-2.5 font-mono text-sm font-semibold text-white shadow-lg shadow-[#e0484c]/20 hover:bg-[#ff5a5e] disabled:opacity-50">
              {busy ? "Sending…" : result ? "▶ Run again" : "▶ Launch attack"}
            </button>
            {err && <span className="text-sm text-[#ff8a8d]">{err}</span>}
          </div>

          {result && (
            <section aria-live="polite" aria-label="The attack, as a conversation" className="mt-6">
              <div className="flex justify-between px-1 font-mono text-[10px] tracking-[0.14em] text-white/35 uppercase">
                <span>BNY</span>
                <span>Attacker</span>
              </div>
              <div className="mt-2 space-y-2.5">
                {bubbles.slice(0, shown).map((b, i) => (
                  <Bubble key={i} b={b} />
                ))}
                {shown < bubbles.length && <Typing side={bubbles[shown].side} />}
              </div>
              {shown > bubbles.length && (
                <div className="dock-in mt-4 rounded-lg border border-[#3fbf7f]/40 bg-[#3fbf7f]/10 px-4 py-3">
                  <p className="font-mono text-xs font-semibold tracking-wide text-[#3fbf7f] uppercase">Attack stopped · {result.stoppedBy}</p>
                  <p className="mt-1 text-sm text-white">{result.outcome}</p>
                  <p className="mt-1 text-xs text-white/50">BNY&apos;s gateway logged the attempt for Compliance.</p>
                </div>
              )}
              {shown > bubbles.length && <p className="mt-6 text-[11px] leading-snug text-white/40">The commentary is written for this demo. The gateway checks and filter results marked &quot;real check&quot; are produced by BNY&apos;s gateway code as the attack runs.</p>}
              <div ref={endRef} />
            </section>
          )}
        </main>
      </div>
      <PersonaDock />
    </div>
  );
}

function Preset({ p }: { p: AttackPreset }) {
  return (
    <section>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-2xl font-semibold text-white">{p.title}</h1>
        <span className="text-sm text-white/50">{p.technique}</span>
      </div>
      <p className="mt-1 text-sm text-white/70">
        <span className="text-white/40">Goal: </span>
        {p.goal}
      </p>
      <div className="mt-4 overflow-hidden rounded-lg border border-white/10 bg-black/40 font-mono text-[13px]">
        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-0.5 border-b border-white/10 px-4 py-3 text-xs">
          <dt className="text-white/40">from</dt>
          <dd className="text-[#f0c674]">{p.envelope.from}</dd>
          <dt className="text-white/40">domain</dt>
          <dd className="text-[#f0c674]">{p.envelope.domain}</dd>
          <dt className="text-white/40">credential</dt>
          <dd>{p.envelope.credential}</dd>
          <dt className="text-white/40">skill</dt>
          <dd>{p.envelope.skill}</dd>
          {p.envelope.extra && (
            <>
              <dt className="text-white/40">also</dt>
              <dd className="text-[#ff8a8d]">{p.envelope.extra}</dd>
            </>
          )}
        </dl>
        <pre className="px-4 py-3 whitespace-pre-wrap text-[#e6e6e6]">
          <span className="text-white/30">&gt; </span>
          {p.prompt}
        </pre>
      </div>
    </section>
  );
}

const KIND: Record<AttackStep["kind"], { label: string; cls: string }> = {
  sent: { label: "attacker", cls: "text-[#f0c674]" },
  gateway: { label: "BNY gateway", cls: "text-[#7fb2ff]" },
  bny: { label: "inside BNY", cls: "text-[#8fd3c7]" },
  returned: { label: "response", cls: "text-[#c9a7ff]" },
};

/** How long the next speaker types before its bubble appears. */
const pauseFor = (b: AttackBubble) => (b.kind === "sent" ? 400 : b.kind === "narration" ? 1100 : 850);

function Typing({ side }: { side: "left" | "right" }) {
  return (
    <div aria-hidden className={`dock-in flex ${side === "right" ? "justify-end" : ""}`}>
      <span className={`flex gap-1 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3 ${side === "right" ? "rounded-tr-sm" : "rounded-tl-sm"}`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/40" style={{ animationDelay: `${i * 160}ms` }} />
        ))}
      </span>
    </div>
  );
}

function Bubble({ b }: { b: AttackBubble }) {
  const right = b.side === "right";
  const wrap = `dock-in flex ${right ? "justify-end" : ""}`;
  const shape = `max-w-[88%] rounded-2xl px-4 py-2.5 ${right ? "rounded-tr-sm" : "rounded-tl-sm"}`;
  if (b.kind === "narration")
    return (
      <div className={wrap}>
        <p className={`${shape} border border-white/10 bg-white/[0.04] text-[13px] leading-snug text-white/75`}>{b.text}</p>
      </div>
    );
  if (b.kind === "real")
    return (
      <div className={wrap}>
        <p className={`${shape} border border-white/15 bg-white/[0.06] text-[12px] leading-snug`}>
          <span className="mr-1.5 rounded bg-[#7fb2ff]/15 px-1 py-px font-mono text-[9px] font-semibold tracking-wide text-[#7fb2ff] uppercase">real check</span>
          <span className={b.ok ? "text-[#3fbf7f]" : "text-[#ff6b6e]"}>{b.ok ? "✓" : "✗"}</span> <span className="font-medium text-white/90">{b.label}</span> <span className="text-white/70">{b.text}</span>
        </p>
      </div>
    );
  const s = b.step;
  const k = KIND[s.kind];
  return (
    <div className={wrap}>
      <article className={`${shape} border ${right ? "border-[#e0484c]/35 bg-[#e0484c]/10" : "border-white/10 bg-white/[0.04]"}`}>
        <p className="flex items-center gap-2 font-mono text-[11px]">
          <span className={`font-semibold tracking-wide uppercase ${k.cls}`}>{k.label}</span>
          {s.ok === false && <span className="rounded bg-[#e0484c]/20 px-1.5 text-[#ff8a8d]">blocked</span>}
        </p>
        <h3 className="mt-1 text-sm font-semibold text-white">{s.title}</h3>
        {s.text && <pre className="mt-2 max-h-48 overflow-auto rounded bg-black/40 px-3 py-2 font-mono text-xs whitespace-pre-wrap text-white/80">{s.text}</pre>}
        {s.fields && Object.keys(s.fields).length > 0 && (
          <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-0.5 font-mono text-[11px]">
            {Object.entries(s.fields).map(([f, v]) => (
              <div key={f} className="contents">
                <dt className="text-white/40">{f}</dt>
                <dd className="break-all text-white/80">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
              </div>
            ))}
          </dl>
        )}
        {s.checks && (
          <ul className="mt-2 space-y-0.5 font-mono text-[11px]">
            {s.checks.map((c) => {
              const flag = !c.ok && (c.id === "injection" || c.id === "fields" || c.id === "disclosure");
              return (
                <li key={c.id} className="flex gap-2">
                  <span className={c.ok ? "text-[#3fbf7f]" : flag ? "text-[#f0c674]" : "text-[#ff6b6e]"}>{c.ok ? "✓" : flag ? "⚑" : "✗"}</span>
                  <span className="text-white/85">{c.label}</span>
                  <span className="text-white/45">{c.detail}</span>
                </li>
              );
            })}
          </ul>
        )}
      </article>
    </div>
  );
}
