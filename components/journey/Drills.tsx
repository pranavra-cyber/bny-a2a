"use client";
// Ordinary operational failures. Pick one: the gateway's own checks (from a real run where the
// prototype can run it), what BNY's people and systems do next, and what the counterparty sees.
import { useState } from "react";
import { DRILLS, type DrillRun, REALITY_LABEL, type Reality } from "@/lib/drillCatalog";
import { Card } from "./parts";

const REALITY_STYLE: Record<Reality, string> = {
  real: "bg-[#3fbf7f]/15 text-[#3fbf7f]",
  simulated: "bg-[#f0c674]/15 text-[#f0c674]",
  illustrative: "bg-white/10 text-white/60",
};

export function Drills({ runs }: { runs: DrillRun[] }) {
  const [id, setId] = useState(DRILLS[0].id);
  const drill = DRILLS.find((d) => d.id === id)!;
  const run = runs.find((r) => r.id === id);
  return (
    <div className="mt-8 grid gap-4 lg:grid-cols-[300px_1fr]">
      <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
        {DRILLS.map((d) => (
          <button key={d.id} onClick={() => setId(d.id)} aria-pressed={d.id === id} className={`shrink-0 rounded-xl border p-3 text-left transition lg:shrink ${d.id === id ? "border-[#3fbf7f] bg-[#10261c]" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"}`}>
            <span className="block text-sm font-semibold text-white">{d.title}</span>
            <span className={`mt-1.5 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${REALITY_STYLE[d.reality]}`}>{d.reality === "real" ? "Real run" : d.reality === "simulated" ? "Simulated" : "Illustrative"}</span>
          </button>
        ))}
      </div>

      <Card className="p-6">
        <p className="text-xs tracking-wider text-white/45 uppercase">The situation</p>
        <h3 className="mt-1 text-2xl font-semibold text-white">{drill.title}</h3>
        <p className="mt-2 max-w-2xl leading-relaxed text-white/75">{drill.situation}</p>
        <span className={`mt-3 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${REALITY_STYLE[drill.reality]}`}>{REALITY_LABEL[drill.reality]}</span>

        {run && run.checks.length > 0 && (
          <div className="mt-5 rounded-lg bg-black/30 p-4">
            <p className="text-xs tracking-wider text-white/45 uppercase">What the gateway did</p>
            <ul className="mt-2 space-y-1.5">
              {run.checks.map((c) => (
                <li key={c.id} className="flex gap-3 text-sm">
                  <span className={`mt-0.5 w-4 shrink-0 text-center font-bold ${c.ok ? "text-[#3fbf7f]" : "text-[#e0848a]"}`}>{c.ok ? "✓" : "✕"}</span>
                  <span className="w-[150px] shrink-0 font-medium text-white/85">{c.label}</span>
                  <span className="text-white/60">{c.detail}</span>
                </li>
              ))}
            </ul>
            <p className={`mt-3 text-sm font-semibold ${run.accepted ? "text-[#3fbf7f]" : "text-[#e0848a]"}`}>{run.accepted ? "Accepted" : `Refused: ${run.reason?.replace(/^invalid credentials: /, "")}`}</p>
          </div>
        )}

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <p className="text-xs tracking-wider text-white/45 uppercase">What BNY does</p>
            <ul className="mt-2 space-y-2">
              {drill.bnyResponse.map((t) => (
                <li key={t} className="flex gap-2 text-sm leading-relaxed text-white/75">
                  <span className="text-[#3fbf7f]">›</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs tracking-wider text-white/45 uppercase">What the counterparty sees</p>
            <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 font-mono text-[13px] leading-relaxed text-white/80">{drill.counterpartySees}</p>
            <p className="mt-3 text-sm text-white/55">
              <span className="font-semibold text-white/75">Owner: </span>
              {drill.owner}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
