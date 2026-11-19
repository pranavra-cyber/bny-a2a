"use client";
// Documents and data sources: what was uploaded and entered during onboarding, and
// every data source the agents read, with the version in use and earlier versions.
// Reached from the folder icon in the header.
import { useEffect, useState } from "react";
import { sourcesFor } from "@/lib/data/sources";
import { LIMITS, type LimitId, ONBOARDING_STAGES, PERMISSIONS, STAGE_WORK } from "@/lib/onboardingGuide";
import { Pill } from "../ui";
import { loadOnboarding, type OnboardingState } from "./onboardingState";
import { Shell } from "./Shell";

const LABELS: Record<string, string> = Object.fromEntries(Object.values(STAGE_WORK).flatMap((w) => (w.inputs ?? []).map((i) => [i.id, i.label])));

export function DocumentsPage() {
  const [st, setSt] = useState<OnboardingState | null>(null);
  const [tab, setTab] = useState<"onboarding" | "sources">("onboarding");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setSt(loadOnboarding()), 0);
    return () => clearTimeout(t);
  }, []);
  const uploads = st ? ONBOARDING_STAGES.flatMap((s) => (st.uploads[s.id] ?? []).map((u) => ({ ...u, step: s.label }))) : [];
  const inputs = st ? Object.entries(st.inputs) : [];
  const pass = st?.results.pass?.technical.detail;
  const cert = st?.results.identity?.technical.detail;

  return (
    <Shell title="Documents and data sources" subtitle="What was uploaded, what was entered, and where every record comes from">
      <div className="mx-auto max-w-5xl px-5 py-6 pb-24">
        <div role="tablist" className="inline-flex rounded-md border border-line bg-white p-0.5 text-sm">
          {(
            [
              ["onboarding", `Onboarding: ${st?.title || "Goldman Sachs"}`],
              ["sources", "Data sources and versions"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded px-3 py-1.5 font-medium ${tab === id ? "bg-navy text-white" : "text-ink hover:bg-canvas"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "onboarding" ? (
          <div className="mt-5 space-y-6">
            <p className="text-sm text-muted">
              {!st?.started ? "No onboarding started yet. Use Onboard new agent in the sidebar." : st.done ? "Onboarding complete. Kept for audit with the agent's registry record." : "Onboarding in progress. Items appear here as each step is completed."}
            </p>
            <section>
              <h2 className="text-sm font-semibold text-navy">Uploaded documents</h2>
              {uploads.length ? (
                <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-canvas text-left text-xs text-muted">
                      <tr>
                        {["Document", "Step", "From", "Uploaded", ""].map((h) => (
                          <th key={h} className="px-4 py-2 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {uploads.map((u, i) => (
                        <tr key={i} className={u.superseded ? "text-muted" : ""}>
                          <td className="px-4 py-2.5">
                            <div className="font-medium">{u.name}</div>
                            <div className="font-mono text-[11px] text-muted">
                              {u.file} · {u.size}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">{u.step}</td>
                          <td className="px-4 py-2.5">{u.sentBy}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap tabular">{u.at}</td>
                          <td className="px-4 py-2.5">{u.superseded ? <Pill>superseded</Pill> : <Pill tone="ok">current</Pill>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">Nothing uploaded yet.</p>
              )}
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-line bg-white p-4">
                <h2 className="text-sm font-semibold text-navy">Details entered</h2>
                {inputs.length ? (
                  <dl className="mt-2 divide-y divide-line/70 text-sm">
                    {inputs.map(([k, v]) => (
                      <div key={k} className="grid grid-cols-[11rem_1fr] gap-3 py-1.5">
                        <dt className="text-muted">{LABELS[k] ?? k}</dt>
                        <dd className="font-mono text-xs break-all text-ink">{v}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-2 text-sm text-muted">Nothing entered yet.</p>
                )}
              </div>
              <div className="rounded-lg border border-line bg-white p-4">
                <h2 className="text-sm font-semibold text-navy">Granted</h2>
                {st && (
                  <dl className="mt-2 divide-y divide-line/70 text-sm">
                    <div className="grid grid-cols-[11rem_1fr] gap-3 py-1.5">
                      <dt className="text-muted">Permissions</dt>
                      <dd>{st.skills.map((s) => PERMISSIONS.find((p) => p.id === s)?.label ?? s).join("; ")}</dd>
                    </div>
                    {(Object.keys(LIMITS) as LimitId[]).map((id) => (
                      <div key={id} className="grid grid-cols-[11rem_1fr] gap-3 py-1.5">
                        <dt className="text-muted">{LIMITS[id].label}</dt>
                        <dd>{st.limits[id]}</dd>
                      </div>
                    ))}
                    {cert && (
                      <div className="grid grid-cols-[11rem_1fr] gap-3 py-1.5">
                        <dt className="text-muted">Certificate</dt>
                        <dd className="font-mono text-[11px] break-all">{cert.certificate_fingerprint}</dd>
                      </div>
                    )}
                    {pass && (
                      <div className="grid grid-cols-[11rem_1fr] gap-3 py-1.5">
                        <dt className="text-muted">Access pass</dt>
                        <dd className="text-xs">
                          {pass.scopes} · expires {pass.expires_utc} UTC
                        </dd>
                      </div>
                    )}
                  </dl>
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="mt-5">
            <p className="text-sm text-muted">
              Records change through the day: instructions are amended, SSIs re-verified, procedures revised. The agents read the version marked <span className="font-medium text-ink">in use</span>,
              and every record and answer in the case names it.
            </p>
            <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-white">
              {sourcesFor("bny").map((s) => (
                <li key={s.key}>
                  <button onClick={() => setOpen(open === s.key ? null : s.key)} aria-expanded={open === s.key} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left hover:bg-canvas">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium text-navy">{s.name}</span>
                        <span className="text-xs text-muted">{s.system}</span>
                      </span>
                      <span className="block font-mono text-[11px] text-muted">{s.file}</span>
                    </span>
                    <span className="text-right">
                      <Pill tone="teal">{s.version}</Pill>
                      <span className="block text-[11px] text-muted">{s.history.length} version{s.history.length === 1 ? "" : "s"}</span>
                    </span>
                  </button>
                  {open === s.key && (
                    <div className="border-t border-line bg-canvas/50 px-4 py-3 text-sm">
                      <p className="text-xs text-muted">
                        Owner: {s.owner} · Refresh: {s.refresh}
                      </p>
                      <ol className="mt-2 space-y-1.5">
                        {s.history.map((h) => (
                          <li key={h.version} className="grid grid-cols-[13rem_1fr] gap-3">
                            <span className={`font-medium ${h.version === s.version ? "text-navy" : "text-muted"}`}>
                              {h.version}
                              {h.version === s.version && <span className="ml-1.5 rounded bg-teal-soft px-1 text-[10px] text-navy">in use</span>}
                            </span>
                            <span className="text-ink">{h.change}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Shell>
  );
}
