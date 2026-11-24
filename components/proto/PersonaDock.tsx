"use client";
// The prototype's own control, not part of the product: who you are, your task,
// and a way to switch people. It opens by itself only when you become someone (on
// landing, or switching person), then tucks itself away; a click anywhere outside it
// or Escape closes it. When the case moves to someone else, a small hint appears
// beside it instead.
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SEATS } from "@/lib/engine/guide";
import { FINAL } from "@/lib/engine/status";
import { type Persona, PERSONAS, personaForSeat } from "@/lib/personas";
import { useProto } from "./Proto";

export function PersonaDock() {
  // Open state lives in the provider: this dock remounts with every page, and a remount
  // must never reopen it.
  const { persona, setPersona, summary, mode, runId, setRunId, dockOpen: expanded, setDockOpen } = useProto();
  const [moved, setMoved] = useState<Persona | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const lastTurn = useRef<string | null | undefined>(undefined);

  // A click anywhere outside the dock, or Escape, collapses it.
  useEffect(() => {
    if (!expanded) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setDockOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDockOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [expanded, setDockOpen]);

  // When the case moves to someone else, offer to switch to them.
  const turn = summary && !FINAL.has(summary.status) ? summary.turn : null;
  useEffect(() => {
    const was = lastTurn.current;
    lastTurn.current = turn;
    if (was === undefined || !turn || turn === was || turn === persona.seat) return;
    const t = setTimeout(() => setMoved(personaForSeat(turn)), 600);
    return () => clearTimeout(t);
  }, [turn, persona.seat]);

  const waitingOn = turn ? personaForSeat(turn) : null;

  return (
    <div ref={root} className="proto fixed right-4 bottom-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
      {expanded && (
        <section
          aria-label="Prototype controls"
          // Hovering keeps it open (cancels the auto-close); it then stays until a click outside.
          onMouseEnter={() => setDockOpen(true)}
          className="dock-in w-[22rem] max-w-full overflow-hidden rounded-xl bg-navy text-white shadow-2xl ring-1 ring-white/10"
        >
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
            <span className="text-[11px] font-semibold tracking-[0.14em] text-teal uppercase">Eliza A2A Prototype</span>
            <button onClick={() => setDockOpen(false)} className="text-xs text-white/60 hover:text-white" aria-label="Close prototype controls">
              Close
            </button>
          </header>

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

          <div className="space-y-1.5 border-t border-white/10 px-4 py-3 text-xs">
            {runId && (
              <p className="text-white/60">
                Case running in <span className="font-semibold text-white">{mode === "live" ? "Live" : "Replay"}</span> mode:{" "}
                {mode === "live" ? "the model examines the data and decides each step." : "a recorded live run plays back; questions still go to the model when a key is set."}
              </p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
              <Link href="/prototype" className="font-medium text-teal hover:underline">
                Prototype overview
              </Link>
              {runId && (
                <Link href="/eliza/case?new=1" onClick={() => (setRunId(null), setPersona("torres", false))} className="font-medium text-teal hover:underline">
                  Restart the case
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {moved && moved.id !== persona.id && !expanded && (
        <div className="dock-in flex items-center gap-2 rounded-full bg-navy py-1 pr-1 pl-3 text-xs text-white shadow-xl ring-1 ring-white/10">
          <span>
            The case moved to <span className="font-semibold">{moved.name}</span>
          </span>
          <button onClick={() => (setMoved(null), setPersona(moved.id))} className="rounded-full bg-teal px-3 py-1 font-semibold hover:bg-white hover:text-navy">
            Switch →
          </button>
          <button onClick={() => setMoved(null)} aria-label="Dismiss" className="px-1.5 text-white/60 hover:text-white">
            ×
          </button>
        </div>
      )}

      <button
        onClick={() => (expanded ? setDockOpen(false) : (setDockOpen(true), setMoved(null)))}
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
