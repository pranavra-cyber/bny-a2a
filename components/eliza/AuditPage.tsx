"use client";
// Safety and audit (Sarah Nguyen, Compliance): were approvals given, and was only
// permitted data shared? Two views. Security: where the case is now, its journey
// across the firms step by step, and the full audit log. Technical: the
// conversation trace. Attacks on the gateway are staged in the attack console.
import { useEffect, useMemo, useState } from "react";
import type { AuditEntry, RunSummary } from "@/lib/engine/types";
import { fmtEt } from "@/lib/time";
import { useProto } from "../proto/Proto";
import { CaseJourney, TechnicalView } from "../a2a/A2AView";
import { buildTrace } from "../a2a/model";
import { ErrorNote, TypeBadge } from "../ui";
import { useRun } from "../useRun";
import { Shell } from "./Shell";

export function AuditPage() {
  const { runId, setPersona } = useProto();
  const [data, setData] = useState<{ summary: RunSummary; audit: AuditEntry[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<"security" | "technical">("security");
  const [selected, setSelected] = useState<string | null>(null);
  const run = useRun(runId, "network");
  const trace = useMemo(() => buildTrace(run.events), [run.events]);

  useEffect(() => {
    if (!runId) return;
    const load = () =>
      fetch(`/api/runs/${runId}/audit`)
        .then((r) => {
          if (r.status === 404) throw new Error("This case was not found. The server may have restarted, which clears runs that weren't saved.");
          if (!r.ok) throw new Error(`Couldn't load the audit log (HTTP ${r.status}).`);
          return r.json();
        })
        .then((d) => {
          setData(d);
          setError(null);
        })
        .catch((e) => setError(e.message));
    load();
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [runId]);

  const audit = data?.audit ?? [];
  const rows = audit.filter((a) => !filter || JSON.stringify(a).toLowerCase().includes(filter.toLowerCase()));

  return (
    <Shell
      title="Safety and audit"
      subtitle="BNY Compliance · every step, message and approval"
      right={
        runId && (
          <div className="flex items-center gap-3">
            <div role="tablist" aria-label="View" className="inline-flex rounded-md bg-canvas p-0.5 text-sm">
              {(["security", "technical"] as const).map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded px-3 py-1.5 font-medium ${tab === t ? "bg-white text-navy shadow-sm" : "text-muted hover:text-ink"}`}>
                  {t === "security" ? "Security view" : "Technical view"}
                </button>
              ))}
            </div>
            {tab === "security" && (
              <a href={`/api/runs/${runId}/audit?format=csv`} download className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas">
                Export CSV
              </a>
            )}
          </div>
        )
      }
    >
      {runId && tab === "technical" ? (
        <TechnicalView trace={trace} selected={selected} setSelected={setSelected} />
      ) : (
      <>
      {runId && <CaseJourney s={run.summary} events={run.events} />}
      <div className="mx-auto max-w-6xl space-y-8 px-5 py-6 pb-24">
        {!runId && (
          <p className="text-sm text-muted">
            No case has run yet.{" "}
            <button onClick={() => setPersona("torres")} className="font-medium text-teal hover:underline">
              Start it as Michael Torres
            </button>
            .
          </p>
        )}
        {error && <ErrorNote error={error} />}
        {runId && (
          <section>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-navy">Audit log</h2>
                <p className="mt-1 text-sm text-muted">Every lookup, model call, gateway decision, approval and notification, in order. Scenario time, ET.</p>
              </div>
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by person, action, field…"
                aria-label="Filter audit entries"
                className="w-72 rounded-md border border-line px-3 py-1.5 text-sm"
              />
            </div>
            <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-white">
              <table className="w-full text-sm">
                <thead className="bg-canvas text-left text-xs text-muted">
                  <tr>
                    {["Time", "Who", "Action", "Decision", "Data", "Cost"].map((h) => (
                      <th key={h} className="px-4 py-2.5 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {rows.map((a) => (
                    <tr key={a.seq} className="align-top">
                      <td className="px-4 py-2.5 whitespace-nowrap text-muted tabular">{fmtEt(a.at).slice(0, 8)}</td>
                      <td className="px-4 py-2.5">
                        <div className="text-ink">{a.actor}</div>
                        <div className="text-[11px] text-muted">
                          <TypeBadge type={a.actorType} /> · {a.firm}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-ink">{a.action}</td>
                      <td className="max-w-sm px-4 py-2.5 text-ink">
                        {a.decision}
                        {a.approver && <div className="text-[11px] text-muted">by {a.approver}</div>}
                      </td>
                      <td className="max-w-xs px-4 py-2.5 text-[11px] text-muted">
                        {a.dataAccessed.length > 0 && <div className="break-all">read {a.dataAccessed.length}: {a.dataAccessed.slice(0, 3).join(", ")}{a.dataAccessed.length > 3 ? "…" : ""}</div>}
                        {a.fieldsShared.length > 0 && <div className="text-ok">shared: {a.fieldsShared.join(", ")}</div>}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-muted tabular">{a.costUsd !== undefined ? `$${a.costUsd.toFixed(4)}` : ""}</td>
                    </tr>
                  ))}
                  {data && rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted">
                        {filter ? (
                          <>
                            Nothing matches “{filter}”.{" "}
                            <button onClick={() => setFilter("")} className="font-medium text-teal hover:underline">Clear the filter</button>
                          </>
                        ) : (
                          "No entries yet."
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
      </>
      )}
    </Shell>
  );
}
