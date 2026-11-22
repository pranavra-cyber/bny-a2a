"use client";
// Swimlane of the connection's whole life: who does what, from the agreement to suspension. One
// column per step, one row per team; click a step to see what it produces and what the prototype does.
import { useState } from "react";
import { BuildTag, Card, BUILD_DOT } from "./parts";
import { LANE_LABEL, LIFECYCLE, type Lane } from "@/lib/journey";

const LANES: Lane[] = ["legal", "security", "ops", "counterparty"];
const COL = 116;
const GAP = 10;
const ROW = 78;
const ROWGAP = 12;
const SETUP = LIFECYCLE.filter((s) => s.phase === "setup").length;
// Steps in different lanes may overlap horizontally (they sit in different rows); steps in the same lane may not.
const OVERLAP_STEP = 54;
const XS = LIFECYCLE.reduce<number[]>((xs, s, i) => {
  const lastSame = LIFECYCLE.map((t, j) => (j < i && t.lane === s.lane ? xs[j] + COL + GAP : 0)).reduce((m, v) => Math.max(m, v), 0);
  xs.push(i === 0 ? 0 : Math.max(xs[i - 1] + OVERLAP_STEP, lastSame));
  return xs;
}, []);
const WIDTH = XS[XS.length - 1] + COL;
const SPLIT = XS[SETUP] - GAP / 2;
const cx = (i: number) => XS[i] + COL / 2;
const cy = (lane: Lane) => LANES.indexOf(lane) * (ROW + ROWGAP) + ROW / 2;

export function Lifecycle() {
  const [id, setId] = useState(LIFECYCLE[0].id);
  const sel = LIFECYCLE.find((s) => s.id === id)!;
  const width = WIDTH;
  const height = LANES.length * (ROW + ROWGAP) - ROWGAP;
  const path = LIFECYCLE.map((s, i) => `${i ? "L" : "M"}${cx(i)},${cy(s.lane)}`).join(" ");
  return (
    <div className="mt-8">
      <Card className="overflow-x-auto p-5">
        <div className="flex" style={{ width: width + 110 }}>
          <div className="w-[110px] shrink-0 pt-[34px]">
            {LANES.map((l) => (
              <div key={l} style={{ height: ROW, marginBottom: ROWGAP }} className="flex items-center pr-3 text-xs font-medium text-white/55">
                {LANE_LABEL[l]}
              </div>
            ))}
          </div>
          <div>
            <div className="mb-2 flex text-[11px] font-semibold tracking-wider uppercase" style={{ width }}>
              <div className="rounded-l border-b-2 border-[#7fb2ff]/60 pb-1 text-[#7fb2ff]" style={{ width: SPLIT }}>
                Set up · before message one
              </div>
              <div className="flex-1 rounded-r border-b-2 border-[#3fbf7f]/60 pb-1 text-[#3fbf7f]">Run · after go-live</div>
            </div>
            <div className="relative" style={{ width, height }}>
              {LANES.map((l, r) => (
                <div key={l} className="absolute inset-x-0 rounded-lg bg-white/[0.025]" style={{ top: r * (ROW + ROWGAP), height: ROW }} />
              ))}
              <svg className="absolute inset-0" width={width} height={height} aria-hidden>
                <path d={path} fill="none" stroke="white" strokeOpacity={0.22} strokeWidth={2} strokeDasharray="4 5" />
              </svg>
              {LIFECYCLE.map((s, i) => {
                const on = s.id === id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setId(s.id)}
                    aria-pressed={on}
                    className={`absolute flex flex-col justify-between rounded-lg border p-2 text-left transition ${on ? "border-[#3fbf7f] bg-[#10261c] shadow-[0_0_0_3px_rgba(63,191,127,0.18)]" : "border-white/15 bg-[#141821] hover:border-white/40"}`}
                    style={{ left: XS[i], top: LANES.indexOf(s.lane) * (ROW + ROWGAP), width: COL, height: ROW }}
                  >
                    <span className="text-[11.5px] leading-tight font-semibold text-white">
                      <span className="mr-1 font-mono text-white/40">{i + 1}</span>
                      {s.title}
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-white/50">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: BUILD_DOT[s.build] }} />
                      {s.build === "enforced" ? "enforced" : s.build === "partly" ? "partly built" : s.build === "simulated" ? "simulated" : "not built"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      <Card className="mt-4 grid gap-6 p-6 md:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="text-xs tracking-wider text-white/45 uppercase">{LANE_LABEL[sel.lane]}</p>
          <h3 className="mt-1 text-xl font-semibold text-white">{sel.title}</h3>
          <p className="mt-3 leading-relaxed text-white/75">{sel.what}</p>
          <p className="mt-4 text-sm text-white/55">
            <span className="font-semibold text-white/80">Leaves behind: </span>
            {sel.produces}
          </p>
        </div>
        <div className="rounded-lg bg-black/25 p-4">
          <BuildTag build={sel.build} />
          <p className="mt-2 text-sm leading-relaxed text-white/70">{sel.prototype}</p>
        </div>
      </Card>
    </div>
  );
}
