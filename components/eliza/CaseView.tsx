"use client";
// The live case dashboard: the person's assistant chat on the left, the case at a
// glance on the right. The case starts at Goldman, in Michael's assistant.
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { RunEvent } from "@/lib/engine/types";
import { store, type Toast } from "../proto/Proto";
import { GREETING, INTAKE_SUGGESTIONS, type Seat, SEATS } from "@/lib/engine/guide";
import { personaForSeat } from "@/lib/personas";
import { fmtDuration, fmtEt, fmtUtc } from "@/lib/time";
import { Chip, Composer } from "../chat";
import { useProto } from "../proto/Proto";
import { ErrorNote } from "../ui";
import { useRun } from "../useRun";
import { CaseRail } from "./CaseRail";
import { AssistantMsg, ChatThread, noticesFor } from "./ChatThread";
import { type Notice, Shell } from "./Shell";

const GS_TRIGGER: Notice = {
  id: "gs-trigger",
  from: "GS Fails Monitor",
  channel: "teams",
  at: "14:02 UTC",
  title: "DK alert: NVDA 10,000 to BNY is unassigned",
  detail: "Fail GS-FAIL-20261119-0091 · DTC-DO-20261119-000318 · $1.86m exposure. Open the GS Fails Assistant to work it.",
};

export function CaseView() {
  const { persona, runId, setRunId } = useProto();
  const params = useSearchParams();
  const router = useRouter();
  const seat: Seat = persona.seat ?? "bny";
  useEffect(() => {
    // ?new=1 starts over; ?run=<id> opens a specific case (a shared link).
    if (params.get("new") || params.get("run")) {
      setRunId(params.get("run"));
      router.replace("/eliza/case");
    }
  }, [params, router, setRunId]);
  const title = seat === "goldman" ? "NVDA 10,000 · DK by BNY" : "NVDA 10,000 · rejected delivery from Goldman Sachs";
  if (!runId) return seat === "goldman" ? <NewCase title={title} /> : <NotYet title={title} seat={seat} />;
  return <Dashboard key={runId} runId={runId} seat={seat} title={title} />;
}

function Dashboard({ runId, seat, title }: { runId: string; seat: Seat; title: string }) {
  const view = seat === "goldman" ? "goldman" : "bny";
  const { summary, events, error } = useRun(runId, view);
  const tz = seat === "goldman" ? fmtUtc : fmtEt;
  useCaseToasts(runId, seat, events);
  const toCutoff = summary ? new Date(summary.cutoff).getTime() - new Date(summary.clock).getTime() : 0;
  return (
    <Shell
      title={title}
      subtitle={`${SEATS[seat].assistant} · ${seat === "goldman" ? "Goldman ⇄ BNY" : "BNY ⇄ Goldman Sachs"}`}
      notices={noticesFor(events, seat)}
      right={
        summary && (
          <div className="flex items-center gap-4">
          <ModeChip mode={summary.mode} />
          <div className="hidden text-right text-xs leading-tight md:block">
            <div className="tabular font-semibold text-ink">{tz(summary.clock)}</div>
            <div className={toCutoff > 0 && toCutoff < 3600_000 ? "text-warn" : "text-muted"}>{toCutoff > 0 ? `${fmtDuration(toCutoff)} to 11:30 ET cutoff` : "11:30 ET cutoff passed"}</div>
          </div>
          </div>
        )
      }
    >
      {/* Goldman's assistant is a plain chat: the case dashboard is BNY's. */}
      <div className={`grid h-full min-h-0 grid-cols-1 ${seat === "goldman" ? "" : "xl:grid-cols-[minmax(0,1fr)_380px]"}`}>
        <div className="flex min-h-0 flex-col">
          {error && <ErrorNote error={error} className="mx-5 mt-3" />}
          <div className="min-h-0 flex-1">
            <ChatThread runId={runId} seat={seat} summary={summary} events={events} />
          </div>
        </div>
        {seat !== "goldman" && (
          <aside className="hidden min-h-0 overflow-y-auto border-l border-line bg-canvas p-4 pb-24 xl:block">
            <CaseRail seat={seat} summary={summary} events={events} />
          </aside>
        )}
      </div>
    </Shell>
  );
}

function NewCase({ title }: { title: string }) {
  const { mode, setRunId, toast } = useProto();
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<boolean | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setChosen(store.get("a2a.modeChosen") === "1"), 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (chosen) toast({ key: "case:gs-trigger", app: "teams", from: GS_TRIGGER.from, title: GS_TRIGGER.title, body: GS_TRIGGER.detail, href: "/eliza/case" }, 800);
  }, [chosen, toast]);
  const [err, setErr] = useState<string | null>(null);
  const send = async (text: string) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenario: "golden", mode, request: text }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "could not start");
      setRunId(d.runId);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Shell title={title} subtitle="GS Fails Assistant · Goldman ⇄ BNY" notices={[GS_TRIGGER]}>
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-5 px-5 py-6">
            <AssistantMsg seat="goldman">{GREETING}</AssistantMsg>
            <div className="ml-11 flex flex-wrap gap-2">
              {INTAKE_SUGGESTIONS.map((s, i) => (
                <Chip key={s} tone={i === 0 ? "primary-gs" : "neutral"} onClick={() => send(s)} disabled={busy}>
                  {s}
                </Chip>
              ))}
            </div>
            {busy && (
              <p role="status" className="ml-11 flex items-center gap-2 text-xs text-muted">
                <span className="h-2 w-2 animate-pulse rounded-full bg-gs" /> Opening the case…
              </p>
            )}
            {err && <ErrorNote error={`Couldn't start the case: ${err}`} className="ml-11" />}
          </div>
        </div>
        <div className="shrink-0 border-t border-line bg-white">
          <div className="mx-auto max-w-3xl px-5 py-3">
            <Composer tone="bg-gs-dark" disabled={busy} onSend={send} placeholder="Message the GS Fails Assistant, e.g. “Why was our NVDA delivery rejected?”" />
          </div>
        </div>
      </div>
      {chosen === false && (
        <ModeChooser
          onChoose={() => {
            store.set("a2a.modeChosen", "1");
            setChosen(true);
          }}
        />
      )}
    </Shell>
  );
}

/** Prototype note: this person's part hasn't started because the case begins at Goldman. */
function NotYet({ title, seat }: { title: string; seat: Seat }) {
  const { setPersona } = useProto();
  const michael = personaForSeat("goldman");
  return (
    <Shell title={title} subtitle={`${SEATS[seat].assistant} · BNY ⇄ Goldman Sachs`}>
      <div className="flex h-full items-center justify-center p-6">
        <div className="proto max-w-md rounded-xl bg-navy p-6 text-white shadow-xl">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-teal uppercase">Prototype</p>
          <p className="mt-2 text-lg font-semibold">The case hasn&apos;t reached you yet.</p>
          <p className="mt-1 text-sm text-white/75">
            It starts at Goldman Sachs, when {michael.name} asks his assistant about the rejected delivery. Once Goldman&apos;s agent contacts BNY, it arrives here as a Teams message.
          </p>
          <button onClick={() => setPersona("torres")} className="mt-4 flex items-center gap-3 rounded-lg bg-white/10 px-3 py-2 text-left hover:bg-white/20">
            <Image src={michael.photo} alt="" width={36} height={36} className="h-9 w-9 rounded-full" />
            <span>
              <span className="block text-sm font-semibold">Switch to {michael.name} →</span>
              <span className="block text-xs text-white/70">{michael.role}, Goldman Sachs</span>
            </span>
          </button>
        </div>
      </div>
    </Shell>
  );
}

/** Prototype question before the live case: should the model decide each step now, or play a recorded live run? */
function ModeChooser({ onChoose }: { onChoose: () => void }) {
  const { cfg, mode, setMode } = useProto();
  const liveOff = cfg.liveProblems.length > 0;
  const options = [
    {
      m: "live" as const,
      title: "Live",
      line: "Every agent step calls the model on the case data: it reads the records, decides, and cites what it used. Your questions are answered from the data too.",
      meta: `${cfg.model} · about $0.02 per case, capped at $${cfg.limitUsd.toFixed(2)} · each step takes a few seconds`,
    },
    {
      m: "replay" as const,
      title: "Replay",
      line: "Plays back a recorded live run of the same case: the model's earlier decisions, at demo speed. You still make every choice and approval; questions still go to the model if a key is set.",
      meta: cfg.recorded.golden === "live" ? "Recorded live run on file · no cost for the case" : "Recorded run on file · no cost for the case",
    },
  ];
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-navy/70 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="mode-title" className="proto dock-in w-full max-w-2xl rounded-2xl bg-navy p-6 text-white shadow-2xl ring-1 ring-white/10">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-teal uppercase">Eliza A2A Prototype</p>
        <h2 id="mode-title" className="mt-2 text-2xl font-semibold">How should the agents run this case?</h2>
        <p className="mt-1 text-sm text-white/70">A prototype setting, not part of the product. Restart the case later to try the other one.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {options.map((o) => {
            const off = o.m === "live" && liveOff;
            return (
              <button
                key={o.m}
                disabled={off}
                onClick={() => {
                  setMode(o.m);
                  onChoose();
                }}
                className={`flex flex-col rounded-xl p-4 text-left ring-1 transition disabled:cursor-not-allowed disabled:opacity-50 ${mode === o.m && !off ? "bg-white/10 ring-teal" : "bg-white/[0.04] ring-white/10 hover:bg-white/10 hover:ring-teal"}`}
              >
                <span className="text-lg font-semibold">{o.title}</span>
                <span className="mt-1 text-sm text-white/80">{o.line}</span>
                <span className="mt-3 text-xs text-teal-soft">{off ? cfg.liveProblems.join(" ") : o.meta}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ModeChip({ mode }: { mode: string }) {
  const live = mode === "live";
  return (
    <span
      title={live ? "Live: the model examines the data and decides every agent step." : "Replay: a recorded live run plays back. Your questions still go to the model when a key is set."}
      className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex ${live ? "bg-ok-soft text-ok" : "bg-canvas text-muted"}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse bg-ok" : "bg-muted"}`} />
      {live ? "Live model" : "Replay"}
    </span>
  );
}

/** Teams and Outlook messages for this person arrive as desktop notifications, once each. */
function useCaseToasts(runId: string, seat: Seat, events: RunEvent[]) {
  const { toast } = useProto();
  useEffect(() => {
    const mine = events.filter((e) => e.kind === "notification" && e.notification?.seat === seat && e.notification.channel !== "app" && e.notification.from !== "GS Fails Monitor");
    for (const e of mine.slice(-3)) {
      const n = e.notification!;
      const t: Toast = { key: `case:${runId}:${e.seq}`, app: n.channel === "email" ? "outlook" : "teams", from: n.from, title: e.title, body: e.detail, href: "/eliza/case" };
      toast(t, 300);
    }
  }, [events, runId, seat, toast]);
}
