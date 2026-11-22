"use client";
// The golden case as an A2A task: the four task states, a time bar drawn to scale from 09:02 to the
// 11:30 deadline, and the ten beats of the recorded run. Every beat is an event in the recording.
import { useEffect, useState } from "react";
import { CASE_BEATS, CASE_DEADLINE, caseSeconds, TASK_STATE_LABEL, timeInState } from "@/lib/journey";
import type { TaskState } from "@/lib/a2a/types";
import { btn, Card } from "./parts";

const STATES: TaskState[] = ["submitted", "working", "input-required", "completed"];
const TONE: Record<string, string> = { submitted: "#7fb2ff", working: "#8fd3c7", "input-required": "#f0c674", completed: "#3fbf7f", none: "#4a5160" };
const WHO: Record<string, string> = { goldman: "Goldman", bny: "BNY", client: "AllianzGI (client)", dtc: "DTC" };
const START = CASE_BEATS[0].at;
const SPAN = caseSeconds(START, CASE_DEADLINE);
const pct = (from: string, to: string) => (caseSeconds(from, to) / SPAN) * 100;
const mins = (s: number) => Math.round(s / 60);

export function CaseTask() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const beat = CASE_BEATS[i];
  const time = timeInState();
  const last = CASE_BEATS.at(-1)!;

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      if (i >= CASE_BEATS.length - 1) setPlaying(false);
      else setI(i + 1);
    }, 2800);
    return () => clearTimeout(t);
  }, [playing, i]);

  const segments = CASE_BEATS.map((b, k) => ({ from: b.at, to: CASE_BEATS[k + 1]?.at ?? CASE_DEADLINE, state: b.state ?? "none", k }));
  const stats = [
    { big: `${mins(caseSeconds(START, last.at))} min`, small: "from the DK to settlement", tone: "#3fbf7f" },
    { big: `${mins(time["input-required"] ?? 0)} min`, small: "task waiting on people, mostly the client by email", tone: "#f0c674" },
    { big: `${mins(time.working ?? 0)} min`, small: "agents actually working", tone: "#8fd3c7" },
    { big: `${mins(caseSeconds(last.at, CASE_DEADLINE))} min`, small: "left before the 11:30 deadline", tone: "#7fb2ff" },
  ];

  return (
    <div className="mt-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.small} className="p-4">
            <p className="text-3xl font-semibold tabular-nums" style={{ color: s.tone }}>
              {s.big}
            </p>
            <p className="mt-1 text-sm leading-snug text-white/60">{s.small}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {STATES.map((s, k) => {
            const on = beat.state === s;
            return (
              <div key={s} className="flex items-center gap-2">
                <span className="rounded-full border px-3 py-1 text-sm font-medium transition" style={{ borderColor: TONE[s], color: on ? "#0b0d12" : TONE[s], background: on ? TONE[s] : "transparent", opacity: on || !beat.state ? 1 : 0.55 }}>
                  {TASK_STATE_LABEL[s]}
                </span>
                {k < STATES.length - 1 && <span className="text-white/30">→</span>}
              </div>
            );
          })}
          <span className="ml-auto flex gap-2">
            <button className={btn} onClick={() => (i >= CASE_BEATS.length - 1 && setI(0), setPlaying(!playing))}>
              {playing ? "Pause" : i >= CASE_BEATS.length - 1 ? "↺ Replay" : "▶ Play the case"}
            </button>
          </span>
        </div>

        <div className="relative mt-6 h-9 overflow-hidden rounded-md bg-white/[0.04]">
          {segments.map((g) => (
            <div
              key={g.k}
              className="absolute inset-y-0 transition-opacity"
              style={{ left: `${pct(START, g.from)}%`, width: `${pct(g.from, g.to)}%`, background: TONE[g.state], opacity: g.k <= i ? 0.9 : 0.22, borderRight: "1px solid #0b0d12" }}
              title={`${g.from.slice(0, 5)} to ${g.to.slice(0, 5)}`}
            />
          ))}
          <div className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `${pct(START, beat.at)}%` }} />
        </div>
        <div className="relative mt-1 h-5 text-[11px] text-white/50">
          <span className="absolute left-0">09:02</span>
          <span className="absolute" style={{ left: `${pct(START, "10:00:00")}%` }}>10:00</span>
          <span className="absolute" style={{ left: `${pct(START, "11:00:00")}%` }}>11:00</span>
          <span className="absolute right-0 font-semibold text-[#e0848a]">11:30 deadline</span>
        </div>
        <p className="mt-1 text-xs text-white/45">
          {`Drawn to scale. Each beat below is an event in the recorded run (${CASE_BEATS.length} of them). The grey stretch before the task exists is Goldman's own monitor; the last stretch is the margin.`}
        </p>
      </Card>

      <ol className="mt-4 space-y-2">
        {CASE_BEATS.map((b, k) => {
          const on = k === i;
          return (
            <li key={b.at + b.title}>
              <button onClick={() => (setPlaying(false), setI(k))} aria-current={on} className={`flex w-full gap-4 rounded-xl border p-4 text-left transition ${on ? "border-white/30 bg-white/[0.07]" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"} ${k > i ? "opacity-60" : ""}`}>
                <span className="w-[62px] shrink-0 font-mono text-sm text-white/55">{b.at.slice(0, 5)}</span>
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TONE[b.state ?? "none"] }} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-semibold text-white">{b.title}</span>
                    <span className="text-xs text-white/45">{WHO[b.who]}</span>
                    {b.state && (
                      <span className="rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ background: `${TONE[b.state]}22`, color: TONE[b.state] }}>
                        {TASK_STATE_LABEL[b.state]}
                      </span>
                    )}
                    {b.person && <span className="text-xs text-[#f0c674]">approved by {b.person}</span>}
                  </span>
                  {on && <span className="mt-2 block leading-relaxed text-white/70">{b.detail}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
