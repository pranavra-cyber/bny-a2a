"use client";
// Analytics: where this case's time went, and the same case handled three ways.
// Each benchmark metric is labeled measured, scripted or assumed.
import { useEffect, useState } from "react";
import type { BenchmarkResult, BenchmarkRow, Metric } from "@/lib/engine/benchmark";
import { fmtDuration } from "@/lib/time";
import { useProto } from "../proto/Proto";
import { useRun } from "../useRun";
import { Shell } from "./Shell";

// Validated categorical palette (light surface): fixed order, never cycled.
const HUE: Record<BenchmarkRow["mode"], string> = { manual: "#d0802e", single: "#8a63d2", a2a: "#1d9bb0" };
const BASIS_TONE = { measured: "bg-ok-soft text-ok", scripted: "bg-teal-soft text-navy", assumed: "bg-warn-soft text-warn" };

type Key = keyof BenchmarkRow["metrics"];
const METRICS: { key: Key; label: string; fmt: (v: number) => string; chart?: boolean }[] = [
  { key: "minutesToResolution", label: "Time to resolution (from DK 08:16 ET)", fmt: (v) => fmtDuration(v * 60000), chart: true },
  { key: "turns", label: "Turns", fmt: String, chart: true },
  { key: "toolCalls", label: "Tool calls", fmt: String },
  { key: "humanApprovals", label: "Human approvals", fmt: String },
  { key: "escalations", label: "Escalations", fmt: String },
  { key: "fieldsShared", label: "Fields shared across the boundary", fmt: String, chart: true },
  { key: "tokens", label: "Tokens", fmt: (v) => v.toLocaleString("en-US") },
  { key: "costUsd", label: "Model cost", fmt: (v) => `$${v.toFixed(4)}`, chart: true },
];

function Basis({ m }: { m: Metric }) {
  return <span className={`ml-1.5 rounded-full px-1.5 py-px text-[10px] font-medium ${BASIS_TONE[m.basis]}`}>{m.basis}</span>;
}

function Bars({ rows, metric }: { rows: BenchmarkRow[]; metric: (typeof METRICS)[number] }) {
  const max = Math.max(...rows.map((r) => r.metrics[metric.key].value), 1e-9);
  return (
    <figure className="rounded-lg border border-line bg-white p-4">
      <figcaption className="mb-2 text-sm font-semibold text-navy">{metric.label}</figcaption>
      <div className="space-y-[2px]">
        {rows.map((r) => {
          const m = r.metrics[metric.key];
          return (
            <div key={r.mode} className="group grid grid-cols-[9rem_1fr_6rem] items-center gap-2 py-1 text-xs" title={`${r.label}: ${metric.fmt(m.value)} (${m.basis})${m.note ? ` · ${m.note}` : ""}`}>
              <span className="truncate text-ink">{r.label}</span>
              <div className="h-3.5 border-l border-line">
                <div className="h-full rounded-r-[4px] group-hover:opacity-80" style={{ width: `${(m.value / max) * 100}%`, minWidth: m.value > 0 ? 2 : 0, background: HUE[r.mode] }} />
              </div>
              <span className="tabular text-right text-ink">{metric.fmt(m.value)}</span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

function CaseTimes() {
  const { runId } = useProto();
  const { summary: s, events } = useRun(runId, "bny");
  if (!runId || !s) return null;
  const at = (p: string) => events.find((e) => e.title.startsWith(p))?.at;
  const sent = at("Email sent to Emily Carter");
  const reply = at("Email from Emily Carter");
  const ms = (a?: string, b?: string) => (a && b ? new Date(b).getTime() - new Date(a).getTime() : 0);
  const total = ms(s.scenarioStart, s.clock);
  const waiting = ms(sent, reply ?? s.clock);
  const tiles: [string, string, string][] = [
    ["Case time so far", fmtDuration(total), `09:02 → ${new Date(new Date(s.clock).getTime() - 5 * 3600_000).toISOString().slice(11, 16)} ET`],
    ["Waiting on the client", waiting ? fmtDuration(waiting) : "–", "manual: email"],
    ["Share of case time", total && waiting ? `${Math.round((waiting / total) * 100)}%` : "–", "waiting on a person outside the network"],
    ["Model cost", `$${s.budget.spentUsd.toFixed(4)}`, `${s.budget.calls} calls · cap $0.20`],
  ];
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-navy">This case</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        {tiles.map(([k, v, n]) => (
          <div key={k} className="rounded-lg border border-line bg-white p-4">
            <div className="text-xs text-muted">{k}</div>
            <div className="mt-1 text-xl font-semibold text-navy tabular">{v}</div>
            <div className="mt-1 text-[11px] text-muted">{n}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">The agents take minutes; most of the time goes on reaching the client by hand. That is where an agent on the client&apos;s side would help next.</p>
    </section>
  );
}

export function AnalyticsPage() {
  const { mode } = useProto();
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    fetch("/api/benchmark")
      .then((r) => r.json())
      .then((d) => setResult(d.result))
      .catch(() => setErr("Couldn't load the last benchmark. Press Run benchmark to make a new one."))
      .finally(() => setLoaded(true));
  }, []);
  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/benchmark", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }) });
      const d = await r.json();
      if (r.ok) setResult(d.result);
      else setErr(`The benchmark didn't run: ${d.error ?? `HTTP ${r.status}`}`);
    } catch (e) {
      setErr(`The benchmark didn't run: ${(e as Error).message}. Check the dev server is up and try again.`);
    } finally {
      setBusy(false);
    }
  };
  const rows = result?.rows ?? [];
  return (
    <Shell title="Analytics" subtitle="Where the time went, and the same case handled three ways">
      <div className="mx-auto max-w-6xl px-5 py-6 pb-24">
        <CaseTimes />
        <h2 className="text-lg font-semibold text-navy">Benchmark: the same case three ways</h2>
        <p className="mt-1 text-sm text-muted">
          <span className={`rounded-full px-1.5 ${BASIS_TONE.measured}`}>measured</span> from a run, <span className={`rounded-full px-1.5 ${BASIS_TONE.scripted}`}>scripted</span> scenario-clock
          anchors, <span className={`rounded-full px-1.5 ${BASIS_TONE.assumed}`}>assumed</span> from interviews.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button onClick={run} disabled={busy} className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-teal disabled:opacity-50">
            {busy ? "Running…" : `Run benchmark (${mode})`}
          </button>
          {busy && <span role="status" className="text-xs text-muted">Running all three approaches on the golden case…</span>}
          {result && (
            <span className="text-xs text-muted">
              Last run {result.createdAt.slice(0, 16).replace("T", " ")} UTC · {result.mode} · {result.model}
            </span>
          )}
        </div>
        {err && (
          <p role="alert" className="mt-2 text-sm whitespace-pre-wrap text-bad">
            {err}
          </p>
        )}
        {rows.length > 0 && (
          <>
            <div className="mt-6 flex flex-wrap gap-4 text-xs">
              {rows.map((r) => (
                <span key={r.mode} className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm" style={{ background: HUE[r.mode] }} />
                  {r.label}
                </span>
              ))}
            </div>
            <div className="mt-2 grid gap-4 md:grid-cols-2">
              {METRICS.filter((m) => m.chart).map((m) => (
                <Bars key={m.key} rows={rows} metric={m} />
              ))}
            </div>
            <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-white">
              <table className="w-full text-sm">
                <thead className="bg-canvas text-left text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Metric</th>
                    {rows.map((r) => (
                      <th key={r.mode} className="px-4 py-2.5 font-medium">
                        {r.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {METRICS.map((m) => (
                    <tr key={m.key} className="align-top">
                      <td className="px-4 py-3 font-medium text-navy">{m.label}</td>
                      {rows.map((r) => (
                        <td key={r.mode} className="px-4 py-3">
                          <span className="tabular">{m.fmt(r.metrics[m.key].value)}</span>
                          <Basis m={r.metrics[m.key]} />
                          {r.metrics[m.key].note && <div className="mt-0.5 text-[11px] text-muted">{r.metrics[m.key].note}</div>}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="align-top">
                    <td className="px-4 py-3 font-medium text-navy">Fields that crossed</td>
                    {rows.map((r) => (
                      <td key={r.mode} className="px-4 py-3 font-mono text-[11px]">
                        {r.fieldsSharedList.join(", ")}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            {rows.map((r) => (
              <p key={r.mode} className="mt-2 text-xs text-muted">
                <b>{r.label}:</b> {r.description}
              </p>
            ))}
            {result?.emails?.map((m, i) => (
              <div key={m.subject} className="mt-4 rounded-lg border border-line bg-white p-4 text-sm">
                <div className="text-xs font-semibold text-muted">Single agent&apos;s draft {i === 0 ? "to the client" : "to the counterparty (what would leave BNY)"}</div>
                <div className="mt-1 text-xs text-muted">To: {m.to}</div>
                <div className="mt-1 font-medium">{m.subject}</div>
                <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
              </div>
            ))}
          </>
        )}
        {!rows.length && <p className="mt-6 text-sm text-muted">{loaded ? "No benchmark yet. Press Run benchmark to compare manual, single-agent and A2A handling." : "Loading the last benchmark…"}</p>}
      </div>
    </Shell>
  );
}
