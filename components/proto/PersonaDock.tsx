"use client";
// The prototype's own control, not part of the product: who you are, your task,
// and a way to switch people. It opens with context when you become someone new
// or when the case moves to someone else, then tucks itself away.
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SEATS } from "@/lib/engine/guide";
import { FINAL } from "@/lib/engine/status";
import type { RunMode } from "@/lib/engine/types";
import { type Persona, PERSONAS, personaForSeat } from "@/lib/personas";
import { useProto } from "./Proto";

const MODES: { m: RunMode; label: string; hint: string }[] = [
  { m: "replay", label: "Replay", hint: "Plays saved agent output. No API calls." },
  { m: "live", label: "Live", hint: "Calls the model (capped at $0.20 per case)." },
  { m: "mock", label: "Mock", hint: "Scripted agents, no API calls." },
];

const OPEN_MS = 6000;

export function PersonaDock() {
  const { persona, setPersona, summary, introKey, mode, setMode, cfg, runId, setRunId } = useProto();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [moved, setMoved] = useState<Persona | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastTurn = useRef<string | null | undefined>(undefined);

  const peek = (ms = OPEN_MS) => {
    setOpen(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), ms);
  };

  // Introduce the person you just became.
  useEffect(() => {
    if (!introKey) return;
    const t = setTimeout(() => {
      setMoved(null);
      peek();
    }, 0);
    return () => clearTimeout(t);
  }, [introKey]);

  // When the case moves to someone else, offer to switch to them.
  const turn = summary && !FINAL.has(summary.status) ? summary.turn : null;
  useEffect(() => {
    const was = lastTurn.current;
    lastTurn.current = turn;
    if (was === undefined || !turn || turn === was || turn === persona.seat) return;
    const t = setTimeout(() => {
      setMoved(personaForSeat(turn));
      peek(12000);
    }, 600);
    return () => clearTimeout(t);
  }, [turn, persona.seat]);

  const expanded = open || pinned;
  const waitingOn = turn ? personaForSeat(turn) : null;

  return (
    <div className="proto fixed right-4 bottom-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
      {expanded && (
        <section
          aria-label="Prototype controls"
          onMouseEnter={() => clearTimeout(timer.current)}
          onMouseLeave={() => !pinned && peek(2500)}
          className="dock-in w-[22rem] max-w-full overflow-hidden rounded-xl bg-navy text-white shadow-2xl ring-1 ring-white/10"
        >
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
            <span className="text-[11px] font-semibold tracking-[0.14em] text-teal uppercase">Eliza A2A Prototype</span>
            <button onClick={() => (setPinned(false), setOpen(false))} className="text-xs text-white/60 hover:text-white" aria-label="Close prototype controls">
              Close
            </button>
          </header>

          {moved && moved.id !== persona.id && (
            <div className="border-b border-white/10 bg-teal/20 px-4 py-3">
              <p className="text-sm">
                The case moved to <span className="font-semibold">{moved.name}</span> ({moved.firm === "BNY" ? `BNY ${moved.role}` : moved.firm}).
              </p>
              <button onClick={() => setPersona(moved.id)} className="mt-2 rounded-md bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-white hover:text-navy">
                Switch to {moved.name.split(" ")[0]} →
              </button>
            </div>
          )}

          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Image src={persona.photo} alt="" width={44} height={44} className="h-11 w-11 rounded-full ring-2 ring-teal" />
              <div className="min-w-0">
                <p className="text-[11px] text-white/60">You are</p>
                <p className="font-semibold">{persona.name}</p>
                <p className="truncate text-xs text-white/70">
                  {persona.role} · {persona.team}
                </p>
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-white/5 px-3 py-2.5">
              <p className="text-[11px] font-semibold tracking-wide text-teal uppercase">{persona.section}</p>
              <p className="mt-0.5 font-semibold">{persona.task}</p>
              <p className="mt-0.5 text-sm text-white/75">{persona.taskLine}</p>
            </div>
          </div>

          <div className="border-t border-white/10 px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wide text-white/60 uppercase">Switch person</p>
            <ul className="mt-2 space-y-1">
              {PERSONAS.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => setPersona(p.id)}
                    aria-current={p.id === persona.id ? "true" : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm ${p.id === persona.id ? "bg-white/10" : "hover:bg-white/5"}`}
                  >
                    <Image src={p.photo} alt="" width={28} height={28} className="h-7 w-7 rounded-full" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block truncate text-[11px] text-white/60">
                        {p.task} · {p.firm}
                      </span>
                    </span>
                    {waitingOn?.id === p.id && <span className="rounded-full bg-warn px-2 py-0.5 text-[10px] font-semibold">case waiting</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2 border-t border-white/10 px-4 py-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-white/60">Agents</span>
              <div className="inline-flex rounded-md bg-white/10 p-0.5">
                {MODES.map((x) => (
                  <button
                    key={x.m}
                    onClick={() => setMode(x.m)}
                    disabled={x.m === "live" && cfg.liveProblems.length > 0}
                    title={x.m === "live" && cfg.liveProblems.length ? cfg.liveProblems.join("\n") : x.hint}
                    className={`rounded px-2.5 py-1 font-medium disabled:opacity-40 ${mode === x.m ? "bg-teal text-white" : "text-white/80 hover:text-white"}`}
                  >
                    {x.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-white/50">{MODES.find((x) => x.m === mode)?.hint} Applies to the next case you start.</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
              <Link href="/" className="font-medium text-teal hover:underline">
                Prototype overview
              </Link>
              {runId && (
                <Link href="/eliza/case?new=1" onClick={() => setRunId(null)} className="font-medium text-teal hover:underline">
                  Restart the case
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      <button
        onClick={() => (expanded ? (setPinned(false), setOpen(false)) : (setPinned(true), setMoved(null)))}
        aria-expanded={expanded}
        className="flex items-center gap-2 rounded-full bg-navy py-1.5 pr-4 pl-1.5 text-sm text-white shadow-xl ring-1 ring-white/10 hover:bg-navy-2"
      >
        <span className="relative">
          <Image src={persona.photo} alt="" width={32} height={32} className="h-8 w-8 rounded-full ring-2 ring-teal" />
          {waitingOn && waitingOn.id !== persona.id && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-warn ring-2 ring-navy" />}
        </span>
        <span className="text-left leading-tight">
          <span className="block text-[10px] font-semibold tracking-[0.12em] text-teal uppercase">Prototype</span>
          <span className="block font-medium">{persona.name}</span>
        </span>
      </button>
      {waitingOn && waitingOn.id !== persona.id && !expanded && (
        <span className="sr-only">
          The case is waiting on {waitingOn.name}, {SEATS[waitingOn.seat!].title}.
        </span>
      )}
    </div>
  );
}
