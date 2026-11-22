"use client";
// The trust-boundary map: four zones, the systems in each, and the ten steps a request takes through
// them. Step through (or play) to light up each hop; click any box for what it does, what it would be
// in production, and where to see it in the prototype.
import Link from "next/link";
import { useEffect, useState } from "react";
import { FLOW, type ArchNode, NODES, type NodeId, ZONES } from "@/lib/journey";
import { BuildTag, btn, Card, LAYER_DOT, LayerTag } from "./parts";

const pts = (p: [number, number][]) => p.map(([x, y]) => `${x},${y}`).join(" ");
const d = (p: [number, number][]) => p.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
const ZONE_TONE: Record<string, string> = { counterparty: "#7fb2ff", internet: "#7b8494", dmz: "#f0c674", internal: "#3fbf7f" };

export function TrustMap() {
  const [step, setStep] = useState(0); // 0 = nothing lit; 1..n = that hop
  const [node, setNode] = useState<NodeId | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      if (step >= FLOW.length) setPlaying(false);
      else setStep(step + 1);
    }, step === 0 ? 300 : 3200);
    return () => clearTimeout(t);
  }, [playing, step]);

  const flow = FLOW.find((f) => f.n === step);
  const lit = new Set<NodeId>(flow ? [flow.from, flow.to] : []);
  const shown: ArchNode | undefined = node ? NODES.find((n) => n.id === node) : flow ? NODES.find((n) => n.id === flow.to) : undefined;
  const go = (n: number) => {
    setPlaying(false);
    setNode(null);
    setStep(Math.max(0, Math.min(FLOW.length, n)));
  };

  return (
    <div className="mt-8">
      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            className={btn}
            onClick={() => {
              setNode(null);
              if (step >= FLOW.length) setStep(0);
              setPlaying(!playing);
            }}
          >
            {playing ? "Pause" : step === 0 ? "▶ Follow a request" : step >= FLOW.length ? "↺ Replay" : "▶ Continue"}
          </button>
          <button className={btn} onClick={() => go(step - 1)} disabled={step <= 0}>
            ← Back
          </button>
          <button className={btn} onClick={() => go(step + 1)} disabled={step >= FLOW.length}>
            Next →
          </button>
          <span className="ml-auto flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/55">
            {(["protocol", "policy", "infra"] as const).map((l) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: LAYER_DOT[l] }} />
                {l === "protocol" ? "A2A protocol" : l === "policy" ? "BNY policy layer" : "Infrastructure"}
              </span>
            ))}
          </span>
        </div>

        <svg viewBox="0 0 1000 520" className="w-full" role="img" aria-label="Map of the connection between Goldman's agent and BNY's systems">
          <defs>
            {(["protocol", "policy", "infra"] as const).map((l) => (
              <marker key={l} id={`arrow-${l}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" fill={LAYER_DOT[l]} />
              </marker>
            ))}
          </defs>
          {ZONES.map((z) => (
            <g key={z.id}>
              <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={14} fill={ZONE_TONE[z.id]} fillOpacity={z.id === "internet" ? 0.03 : 0.06} stroke={ZONE_TONE[z.id]} strokeOpacity={0.35} strokeDasharray={z.id === "internet" ? "3 6" : undefined} />
              <text x={z.x + z.w / 2} y={z.y + 22} textAnchor="middle" fontSize="12" fontWeight="600" fill={ZONE_TONE[z.id]} fillOpacity={0.95}>
                {z.label}
              </text>
            </g>
          ))}

          <path d="M745,305 L745,395" stroke="white" strokeOpacity={0.25} strokeDasharray="4 5" fill="none" />
          <text x="752" y="352" fontSize="10.5" fill="white" fillOpacity={0.45}>
            everything is logged
          </text>

          {FLOW.map((f) => {
            const on = f.n === step;
            const past = f.n < step;
            const colour = LAYER_DOT[f.layer];
            const mid = f.path[Math.floor((f.path.length - 1) / 2)];
            const next = f.path[Math.floor((f.path.length - 1) / 2) + 1];
            const lx = (mid[0] + next[0]) / 2;
            const ly = (mid[1] + next[1]) / 2;
            return (
              <g key={f.n} opacity={on ? 1 : past ? 0.6 : 0.4}>
                <polyline points={pts(f.path)} fill="none" stroke={colour} strokeWidth={on ? 3 : 2} markerEnd={`url(#arrow-${f.layer})`} />
                {on && (
                  <circle r="5.5" fill="white" className="motion-reduce:hidden">
                    <animateMotion dur="1.8s" repeatCount="indefinite" path={d(f.path)} />
                  </circle>
                )}
                <g transform={`translate(${lx},${ly})`}>
                  <circle r="10" fill="#0b0d12" stroke={colour} strokeWidth="1.5" />
                  <text textAnchor="middle" y="4" fontSize="11" fontWeight="700" fill={colour}>
                    {f.n}
                  </text>
                </g>
              </g>
            );
          })}

          {NODES.map((n) => {
            const on = lit.has(n.id) || node === n.id;
            const colour = LAYER_DOT[n.layer];
            return (
              <g key={n.id} onClick={() => (setPlaying(false), setNode(n.id))} className="cursor-pointer" role="button" tabIndex={0} aria-label={`${n.label}: ${n.sub}`} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (setPlaying(false), setNode(n.id))}>
                <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={10} fill={on ? "#16211c" : "#141821"} stroke={colour} strokeWidth={on ? 2.5 : 1.2} strokeOpacity={on ? 1 : 0.6} strokeDasharray={n.build === "simulated" ? "5 4" : undefined} />
                <text x={n.x + n.w / 2} y={n.y + n.h / 2 - 3} textAnchor="middle" fontSize="13" fontWeight="600" fill="white">
                  {n.label}
                </text>
                <text x={n.x + n.w / 2} y={n.y + n.h / 2 + 14} textAnchor="middle" fontSize="10.5" fill="white" fillOpacity={0.55}>
                  {n.sub}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="mt-1 text-[11px] text-white/45">Dashed outline: simulated in the prototype. Click any box for details.</p>
      </Card>

      <Card className="mt-4 grid min-h-[170px] gap-6 p-6 md:grid-cols-2">
        <div>
          {flow ? (
            <>
              <p className="font-mono text-xs tracking-wider text-white/45 uppercase">
                Step {flow.n} of {FLOW.length}
              </p>
              <h3 className="mt-1 text-xl font-semibold text-white">{flow.title}</h3>
              <p className="mt-2 leading-relaxed text-white/75">{flow.detail}</p>
              <div className="mt-3 flex gap-2">
                <LayerTag layer={flow.layer} />
                <BuildTag build={flow.build} />
              </div>
            </>
          ) : (
            <>
              <h3 className="text-xl font-semibold text-white">Follow one request from Goldman to BNY and back</h3>
              <p className="mt-2 leading-relaxed text-white/75">
                Press <span className="font-semibold text-white">Follow a request</span>{" "}
                to see the ten hops in order. The coloured line shows who defines each hop: the A2A protocol, BNY&apos;s own policy layer, or ordinary
                infrastructure.
              </p>
            </>
          )}
        </div>
        <div className="rounded-lg bg-black/25 p-4">
          {shown ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-white">{shown.label}</span>
                <LayerTag layer={shown.layer} />
                <BuildTag build={shown.build} />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/75">{shown.does}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                <span className="font-semibold text-white/75">In production: </span>
                {shown.production}
              </p>
              {shown.see && (
                <Link href={shown.see.href} className="mt-2 inline-block text-sm font-medium text-[#3fbf7f] hover:underline">
                  {shown.see.label} →
                </Link>
              )}
            </>
          ) : (
            <p className="text-sm text-white/55">Click a box, or step through, to see what it is and what it would be in production.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
