"use client";
// Safety and audit (Sarah Nguyen, Compliance): were approvals given, and was only
// permitted data shared? The full audit log of the case. Attacks on the gateway
// are staged separately, in the attack console.
import { useEffect, useState } from "react";
import type { AuditEntry, RunSummary } from "@/lib/engine/types";
import { fmtEt } from "@/lib/time";
import { useProto } from "../proto/Proto";
import { ErrorNote, TypeBadge } from "../ui";
import { Shell } from "./Shell";

export function AuditPage() {
  const { runId, setPersona } = useProto();
  const [data, setData] = useState<{ summary: RunSummary; audit: AuditEntry[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

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
    <Shell title="Safety and audit" subtitle="BNY Compliance · every step, message and approval" right={runId && <a href={`/api/runs/${runId}/audit?format=csv`} download className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas">Export CSV</a>}>
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
    </Shell>
  );
}
