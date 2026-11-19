"use client";
// Examine the A2A interaction, two ways. Security: where the trade is, who holds
// the ball, what crossed the boundary. Technical: the conversation trace, a map of
// who talked to whom, and each message's envelope.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ballText, statusText, statusTone } from "@/lib/engine/status";
import type { RunEvent, RunSummary } from "@/lib/engine/types";
import { fmtDuration, fmtEt } from "@/lib/time";
import { Shell } from "../eliza/Shell";
import { useProto } from "../proto/Proto";
import { ErrorNote, Json, Pill, RecordChips } from "../ui";
import { useRun } from "../useRun";
import { buildTrace, type Kind, milestones, type TraceItem } from "./model";

const hhmm = (iso: string) => fmtEt(iso).slice(0, 5);

export function A2AView() {
  const params = useSearchParams();
  const { runId: caseRun } = useProto();
  const runId = params.get("run") ?? caseRun;
  const [tab, setTab] = useState<"security" | "technical">(params.get("tab") === "technical" ? "technical" : "security");
  const [selected, setSelected] = useState<string | null>(null);
  const { summary, events, error } = useRun(runId, "network");
  const trace = useMemo(() => buildTrace(events), [events]);
  const open = (key: string) => {
    setSelected(key);
    setTab("technical");
  };
  return (
    <Shell
      title="Examine A2A interaction"
      subtitle={summary ? `${summary.scenario === "golden" ? "NVDA 10,000 · AllianzGI Global Equity" : `Safety test ${summary.scenario.toUpperCase()}`} · run ${summary.id}` : "Network view: both firms and the gateway"}
      right={
        <div role="tablist" aria-label="View" className="inline-flex rounded-md bg-canvas p-0.5 text-sm">
          {(["security", "technical"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded px-3 py-1.5 font-medium ${tab === t ? "bg-white text-navy shadow-sm" : "text-muted hover:text-ink"}`}>
              {t === "security" ? "Security view" : "Technical view"}
            </button>
          ))}
        </div>
      }
    >
      {!runId ? (
        <div className="p-8 text-sm text-muted">
          No case yet. <Link href="/eliza/case" className="font-medium text-teal hover:underline">Start the live case</Link>, or try to break in from the{" "}
          <Link href="/attack" className="font-medium text-teal hover:underline">attack console</Link>.
        </div>
      ) : (
        <>
          {error && <ErrorNote error={error} className="m-4" />}
          {tab === "security" ? <SecurityView s={summary} events={events} trace={trace} onOpen={open} /> : <TechnicalView trace={trace} selected={selected} setSelected={setSelected} />}
        </>
      )}
    </Shell>
  );
}

// ---------------- Security view: the case tracker ----------------

const WHO_DOT = { goldman: "bg-gs", bny: "bg-teal", client: "bg-muted", exception: "bg-bad" } as const;

function SecurityView({ s, events, trace, onOpen }: { s: RunSummary | null; events: RunEvent[]; trace: TraceItem[]; onOpen: (key: string) => void }) {
  const ms = milestones(events, s?.status ?? "");
  const current = ms.findIndex((m) => !m.done);
  const toCutoff = s ? new Date(s.cutoff).getTime() - new Date(s.clock).getTime() : 0;
  const last = [...events].reverse().find((e) => e.kind !== "model-call" && e.kind !== "notification" && e.kind !== "chat" && e.kind !== "checkpoint");
  const cross = trace.filter((t) => t.kind === "cross");
  const outs = cross.filter((t) => t.dir === "out");
  const shared = new Set(outs.flatMap((t) => Object.keys(t.fields ?? {})));
  const withheld = new Set(outs.flatMap((t) => t.withheld ?? []));
  const requested = events.filter((e) => e.kind === "approval-request").length;
  const obtained = events.filter((e) => e.kind === "approval" && e.decision?.outcome === "approved").length;
  const corrected = events.some((e) => e.title.startsWith("Client's corrected instruction received"));
  return (
    <div className="flex min-h-full flex-col">
      <section className="flex flex-wrap items-end justify-between gap-6 border-b border-line bg-white px-6 py-5">
        <div className="min-w-0">
          <p className="text-xs text-muted">Now</p>
          <h2 className="text-2xl font-semibold text-navy">{s ? ballText(s) : "Loading…"}</h2>
          {last && (
            <p className="mt-1 text-sm text-ink">
              Last: {last.title} · {hhmm(last.at)} ET {s && <Pill tone={statusTone(s)}>{statusText(s)}</Pill>}
            </p>
          )}
        </div>
        <div className="flex gap-8 text-right">
          <div>
            <div className="text-2xl font-semibold text-navy tabular">{!s ? "–" : s.status.startsWith("settled") ? "Met" : toCutoff > 0 ? fmtDuration(toCutoff) : "passed"}</div>
            <div className="text-xs text-muted">{s?.status.startsWith("settled") ? "settled before DTC close" : "to 11:30 ET client cutoff"}</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-navy">$1.86M</div>
            <div className="text-xs text-muted">at risk · tier-1 client</div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-canvas px-6 py-5">
        <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Journey across firms</h3>
        <ol className="mt-4 grid grid-cols-3 gap-y-5 sm:grid-cols-5 lg:grid-cols-9">
          {ms.map((m, i) => (
            <li key={m.label} className="relative flex flex-col items-center px-1 text-center">
              {i > 0 && <span aria-hidden className={`absolute top-4 right-1/2 hidden h-0.5 w-full lg:block ${m.done ? "bg-teal" : "bg-line"}`} />}
              <span
                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                  m.done ? `${m.human ? "bg-warn" : WHO_DOT[m.who]} text-white` : i === current ? "border-2 border-teal bg-white text-teal" : "border border-line bg-white text-muted"
                }`}
              >
                {m.human ? "★" : i + 1}
              </span>
              <span className={`mt-2 text-sm font-semibold ${m.done || i === current ? "text-navy" : "text-muted"}`}>{m.label}</span>
              <span className="text-[11px] leading-snug text-muted">{m.sub}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-gs" />Goldman</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-teal" />BNY</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-muted" />Client (outside the network)</span>
          <span><span className="mr-1 text-warn">★</span>human decision</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-bad" />exception</span>
        </p>
      </section>

      <div className="grid flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-3 px-6 pt-5 pb-24">
          <div className="flex justify-between text-xs font-semibold tracking-wide text-muted uppercase">
            <span>Goldman Sachs · Outreach Agent <span className="text-ok normal-case">✓ verified</span></span>
            <span>BNY · Settlement Ops Agent <span className="text-ok normal-case">✓ verified</span></span>
          </div>
          {trace.map((t) => {
            if (t.kind === "cross")
              return (
                <button
                  key={t.key}
                  onClick={() => onOpen(t.key)}
                  className={`block w-full max-w-[44rem] rounded-lg border p-4 text-left transition hover:border-teal ${t.dir === "out" ? "ml-auto border-teal/40 bg-teal-soft/50" : "border-line bg-white"} ${t.accepted === false ? "border-bad/50 bg-bad-soft/40" : ""}`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-white/80 px-1.5 py-0.5 font-semibold text-navy ring-1 ring-line">#{t.n} · {t.dir === "out" ? "BNY → GS" : "GS → BNY"}</span>
                    <span className="text-muted tabular">{hhmm(t.at)} ET</span>
                    <span className="font-medium text-ink">{t.title}</span>
                  </div>
                  {t.text && <p className="mt-2 text-[15px] text-ink">“{t.text}”</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Pill tone={t.accepted === false ? "bad" : "ok"}>{t.accepted === false ? "gateway ✗ rejected" : "gateway ✓"}</Pill>
                    <Pill>
                      {Object.keys(t.fields ?? {}).length} fields {t.dir === "out" ? "out" : "in"}
                    </Pill>
                    {(t.withheld?.length ?? 0) > 0 && <Pill tone="warn">{t.withheld!.length} withheld</Pill>}
                  </div>
                </button>
              );
            if (t.kind === "human")
              return (
                <div key={t.key} className={`flex flex-wrap items-center gap-3 rounded-lg px-4 py-2.5 text-sm ${t.side === "client" || t.event.flags?.includes("manual") ? "border border-dashed border-line bg-white" : "bg-warn-soft"}`}>
                  <span className="text-[11px] font-semibold tracking-wide text-warn uppercase">{t.event.flags?.includes("manual") ? "Manual · Teams / email" : "Human decision"}</span>
                  <span className="text-ink">{t.title}</span>
                  <span className="ml-auto text-xs text-muted tabular">{hhmm(t.at)} ET</span>
                </div>
              );
            if (t.event.actor.type === "AGENT" || t.event.kind === "escalation" || t.event.flags?.includes("blocked"))
              return (
                <p key={t.key} className={`px-2 text-xs ${t.side === "bny" ? "text-right" : ""} ${t.event.kind === "escalation" || t.event.flags?.includes("blocked") ? "text-bad" : "text-muted"}`}>
                  ▸ {t.event.actor.name}: {t.title} · {hhmm(t.at)}
                </p>
              );
            return null;
          })}
        </section>

        <aside className="space-y-6 border-l border-line bg-white px-5 pt-5 pb-24 text-sm">
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">What crossed the boundary</h3>
            <ul className="mt-2 space-y-1.5">
              {[...shared].map((f) => (
                <li key={f} className="flex justify-between gap-3">
                  <span className="font-mono text-xs text-ink">{f}</span>
                  <span className="text-xs font-medium text-ok">shared</span>
                </li>
              ))}
              {[...withheld].map((f) => (
                <li key={f} className="flex justify-between gap-3">
                  <span className="text-xs text-ink">{f}</span>
                  <span className="text-xs font-medium text-warn">withheld</span>
                </li>
              ))}
              <li className="flex justify-between gap-3">
                <span className="text-xs text-ink">client name, account, fund</span>
                <span className="text-xs font-medium text-warn">never shared</span>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Same trade, each firm&apos;s ID</h3>
            <dl className="mt-2 space-y-1 text-xs">
              {[
                ["BNY", corrected ? "BNYI-20261119-5531207 (was …5527301)" : "BNYI-20261118-5527301"],
                ["DTC", "DTC-DO-20261119-000318"],
                ["Goldman", "GS-FAIL-20261119-0091"],
                ["Client", "AGI-ORD-26-322-0773"],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <dt className="w-14 shrink-0 text-muted">{k}</dt>
                  <dd className="font-mono break-all text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Guardrails</h3>
            <dl className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between"><dt className="text-muted">Turn limit</dt><dd className="tabular">{s?.turns ?? 0} of 10</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Model cost</dt><dd className="tabular">${s?.budget.spentUsd.toFixed(3) ?? "0.000"} of $0.20</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Approvals</dt><dd className="tabular">{obtained} of {requested} obtained</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Usage terms</dt><dd>{outs.length} of {outs.length} outbound</dd></div>
            </dl>
          </div>
          <p className="text-xs text-muted">Click any message to open its envelope in the technical view: what it said, the records behind it, fields shared and withheld, and the gateway checks.</p>
        </aside>
      </div>
    </div>
  );
}

// ---------------- Technical view: the conversation trace ----------------

const FILTERS: { id: "all" | Kind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "cross", label: "Cross-firm" },
  { id: "internal", label: "Internal" },
  { id: "human", label: "Human" },
];

function TechnicalView({ trace, selected, setSelected }: { trace: TraceItem[]; selected: string | null; setSelected: (k: string) => void }) {
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const shown = trace.filter((t) => filter === "all" || t.kind === filter);
  const sel = trace.find((t) => t.key === selected) ?? trace.find((t) => t.kind === "cross");
  return (
    <div className="grid min-h-full lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.1fr)_minmax(0,0.95fr)]">
      <section className="border-r border-line bg-white">
        <div className="flex flex-wrap gap-1.5 border-b border-line p-3">
          {FILTERS.map((f) => {
            const count = f.id === "all" ? trace.length : trace.filter((t) => t.kind === f.id).length;
            return (
              <button key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className={`rounded-full px-3 py-1 text-xs font-medium ${filter === f.id ? "bg-navy text-white" : "bg-canvas text-ink hover:bg-teal-soft"}`}>
                {f.label} {count}
              </button>
            );
          })}
        </div>
        <ol className="divide-y divide-line/70 pb-24">
          {shown.map((t) => (
            <li key={t.key}>
              <button
                onClick={() => setSelected(t.key)}
                aria-current={sel?.key === t.key ? "true" : undefined}
                className={`grid w-full grid-cols-[1.75rem_3rem_minmax(0,1fr)_auto] items-start gap-2 px-3 py-2.5 text-left text-sm ${sel?.key === t.key ? "bg-teal-soft" : t.kind === "human" ? "bg-warn-soft/40 hover:bg-warn-soft" : "hover:bg-canvas"}`}
              >
                <span className={`font-semibold ${t.kind === "human" ? "text-warn" : "text-navy"}`}>{t.kind === "cross" ? t.n : t.kind === "human" ? "★" : "·"}</span>
                <span className="text-xs text-muted tabular">{hhmm(t.at)}</span>
                <span className={t.kind === "internal" ? "text-muted" : "text-ink"}>
                  {t.kind === "cross" && <span className="font-semibold">{t.dir === "out" ? "BNY → GS" : t.side === "network" ? "?? → BNY" : "GS → BNY"} · </span>}
                  {t.title}
                </span>
                <span className={`text-[11px] ${t.kind === "cross" ? (t.accepted === false ? "text-bad" : "text-teal") : t.kind === "human" ? "text-warn" : "text-muted"}`}>
                  {t.kind === "cross" ? (t.accepted === false ? "rejected" : t.dir) : t.kind === "human" ? "human" : "int."}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-r border-line bg-canvas p-4">
        <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Map · who talked to whom</h3>
        <TraceMap trace={trace} selected={sel} />
        <p className="mt-2 text-[11px] text-muted">Numbers match the transcript. Every cross-firm message passes the gateway; the client is reached by people, outside the network.</p>
      </section>

      <section className="bg-white p-5 pb-24">{sel ? <Envelope t={sel} /> : <p className="text-sm text-muted">Select a message.</p>}</section>
    </div>
  );
}

type Node = { id: string; label: string; x: number; y: number; tone: "bny" | "gs" | "human" | "gateway" | "client" };
const NODES: Node[] = [
  { id: "orch", label: "Fails Orchestrator", x: 130, y: 60, tone: "bny" },
  { id: "ops", label: "Settlement Ops Agent", x: 130, y: 190, tone: "bny" },
  { id: "ct", label: "Client Team Agent", x: 130, y: 300, tone: "bny" },
  { id: "priya", label: "Priya Sharma", x: 68, y: 400, tone: "human" },
  { id: "daniel", label: "Daniel Kim", x: 200, y: 400, tone: "human" },
  { id: "emily", label: "Emily Carter (client)", x: 150, y: 490, tone: "client" },
  { id: "gw", label: "Gateway", x: 300, y: 190, tone: "gateway" },
  { id: "mon", label: "GS Fails Monitor", x: 505, y: 60, tone: "gs" },
  { id: "out", label: "GS Outreach Agent", x: 505, y: 190, tone: "gs" },
  { id: "michael", label: "Michael Torres", x: 505, y: 400, tone: "human" },
];
const EDGES: [string, string, "solid" | "dashed"][] = [
  ["orch", "ops", "solid"],
  ["orch", "ct", "solid"],
  ["ops", "priya", "solid"],
  ["ct", "daniel", "solid"],
  ["daniel", "emily", "dashed"],
  ["mon", "out", "solid"],
  ["out", "michael", "solid"],
];
const TONE = {
  bny: "fill-white stroke-teal",
  gs: "fill-white stroke-gs",
  human: "fill-warn-soft stroke-warn",
  gateway: "fill-navy stroke-navy",
  client: "fill-white stroke-muted",
};

function TraceMap({ trace, selected }: { trace: TraceItem[]; selected?: TraceItem }) {
  const node = (id: string) => NODES.find((n) => n.id === id)!;
  const cross = trace.filter((t) => t.kind === "cross");
  const ins = cross.filter((t) => t.dir === "in");
  const outs = cross.filter((t) => t.dir === "out");
  const selIn = selected?.kind === "cross" && selected.dir === "in";
  const selOut = selected?.kind === "cross" && selected.dir === "out";
  const badges = (list: TraceItem[], x: number, y: number) =>
    list.slice(0, 8).map((t, i) => (
      <g key={t.key} transform={`translate(${x + (i % 4) * 20}, ${y + Math.floor(i / 4) * 20})`}>
        <circle r="9" className={selected?.key === t.key ? "fill-warn" : t.accepted === false ? "fill-bad" : "fill-navy-2"} />
        <text textAnchor="middle" dy="3.5" className="fill-white text-[9px] font-semibold">
          {t.n}
        </text>
      </g>
    ));
  return (
    <svg viewBox="0 0 600 530" className="mt-3 w-full" role="img" aria-label="Map of agents, the gateway and people">
      <text x="20" y="22" className="fill-muted text-[11px] font-semibold">BNY</text>
      <text x="580" y="22" textAnchor="end" className="fill-muted text-[11px] font-semibold">GOLDMAN SACHS</text>
      <line x1="300" y1="30" x2="300" y2="520" className="stroke-line" strokeDasharray="4 4" />
      {EDGES.map(([a, b, style]) => (
        <line key={a + b} x1={node(a).x} y1={node(a).y} x2={node(b).x} y2={node(b).y} className="stroke-line" strokeWidth={2} strokeDasharray={style === "dashed" ? "5 4" : undefined} />
      ))}
      <line x1={130} y1={190} x2={300} y2={190} className={selOut ? "stroke-warn" : "stroke-teal"} strokeWidth={2 + Math.min(outs.length, 6)} strokeOpacity={0.7} />
      <line x1={300} y1={190} x2={505} y2={190} className={selIn ? "stroke-warn" : "stroke-gs"} strokeWidth={2 + Math.min(ins.length, 6)} strokeOpacity={0.7} />
      {badges(outs, 175, 150)}
      {badges(ins, 370, 150)}
      {NODES.map((n) => (
        <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
          <rect x={-62} y={-17} width={124} height={34} rx={8} className={TONE[n.tone]} strokeWidth={1.5} strokeDasharray={n.tone === "client" ? "4 3" : undefined} />
          <text textAnchor="middle" dy="4" className={`text-[11px] font-semibold ${n.tone === "gateway" ? "fill-white" : "fill-navy"}`}>
            {n.label}
          </text>
        </g>
      ))}
      <text x="185" y="452" className="fill-muted text-[10px]">Teams / email</text>
    </svg>
  );
}

function Envelope({ t }: { t: TraceItem }) {
  const [raw, setRaw] = useState(false);
  if (t.kind !== "cross")
    return (
      <div>
        <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{t.kind === "human" ? "Human step" : "Internal step"}</h3>
        <p className="mt-2 text-lg font-semibold text-navy">{t.title}</p>
        <p className="text-xs text-muted">
          {t.event.actor.name} · {fmtEt(t.at)}
        </p>
        {t.text && <p className="mt-3 rounded-md bg-canvas p-3 text-sm whitespace-pre-wrap text-ink">{t.text}</p>}
        {t.checks && (
          <ul className="mt-3 space-y-1 text-xs">
            {t.checks.map((c) => (
              <li key={c.id}>
                <span className={c.ok ? "text-ok" : "text-bad"}>{c.ok ? "✓" : "✗"}</span> <span className="font-medium">{c.label}</span> <span className="text-muted">{c.detail}</span>
              </li>
            ))}
          </ul>
        )}
        <RecordChips records={t.event.records} />
      </div>
    );
  const fields = Object.entries(t.fields ?? {});
  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Envelope · message {t.n}</h3>
        <p className="mt-1 text-lg font-semibold text-navy">
          {t.from} → {t.to}
        </p>
        <p className="text-xs text-muted tabular">{fmtEt(t.at)}</p>
      </div>
      {t.text && <p className="rounded-md bg-canvas p-3 text-[15px] text-ink">“{t.text}”</p>}
      {t.basedOn && t.basedOn.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted uppercase">Based on</h4>
          <RecordChips records={t.basedOn} />
        </div>
      )}
      <div>
        <h4 className="text-xs font-semibold text-muted uppercase">{t.dir === "out" ? "Shared" : "Fields sent"}</h4>
        {fields.length ? (
          <dl className="mt-1 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-0.5 text-xs">
            {fields.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-mono text-ok">{k}</dt>
                <dd className="font-mono break-all text-ink">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-xs text-muted">none</p>
        )}
      </div>
      {t.dir === "out" && (
        <div>
          <h4 className="text-xs font-semibold text-muted uppercase">Withheld</h4>
          <p className="mt-1 text-xs text-warn">{t.withheld?.length ? t.withheld.join(" · ") : "nothing needed withholding"} · client name, account and fund are never sent</p>
        </div>
      )}
      <div>
        <h4 className="text-xs font-semibold text-muted uppercase">Gateway checks</h4>
        <ul className="mt-1 space-y-0.5 text-xs">
          {(t.checks ?? []).map((c) => (
            <li key={c.id}>
              <span className={c.ok ? "text-ok" : c.id === "injection" || c.id === "disclosure" ? "text-warn" : "text-bad"}>{c.ok ? "✓" : "✗"}</span> <span className="font-medium">{c.label}</span>{" "}
              <span className="text-muted">{c.detail}</span>
            </li>
          ))}
        </ul>
      </div>
      {t.why && (
        <div>
          <h4 className="text-xs font-semibold text-muted uppercase">Why the agent sent it</h4>
          <p className="mt-1 text-xs whitespace-pre-wrap text-ink">{t.why}</p>
        </div>
      )}
      <div className="border-t border-line pt-3 text-xs text-muted">
        Audit {t.messageId ?? "–"} · event {t.event.seq} ·{" "}
        <button onClick={() => setRaw(!raw)} className="font-medium text-teal hover:underline">
          {raw ? "hide raw A2A" : "view raw A2A"}
        </button>
        {raw && (
          <div className="mt-2">
            <Json value={t.envelope} />
          </div>
        )}
      </div>
    </div>
  );
}
