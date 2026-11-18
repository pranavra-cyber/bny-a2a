"use client";
// Onboarding Goldman's agent: one security layer at a time, as steps (not a chat).
// Each check runs on the server against reference data. When a check finds a
// problem, the step shows how to resolve it and checks again. Progress is kept
// in this browser, so leaving and coming back picks up where you were.
import { useEffect, useState } from "react";
import type { CheckResult } from "@/lib/onboarding";
import { FIXES, LAYERS, ONBOARDING_CONTACT, ONBOARDING_STAGES, PERMISSIONS, type Problem } from "@/lib/onboardingGuide";
import { useProto } from "../proto/Proto";
import { Expandable, Pill } from "../ui";
import { Shell } from "./Shell";

type State = {
  results: Partial<Record<string, CheckResult>>;
  fixes: Problem[];
  asked: Problem[];
  skills: string[];
  current: number;
  done: boolean;
};

const KEY = "a2a.onboarding";
const initial = (): State => ({ results: {}, fixes: [], asked: [], skills: PERMISSIONS.filter((p) => p.recommended).map((p) => p.id), current: 0, done: false });

function load(): State {
  try {
    return { ...initial(), ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return initial();
  }
}

export function OnboardingFlow() {
  const { snack } = useProto();
  const [st, setSt] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSt(load()), 0);
    return () => clearTimeout(t);
  }, []);
  const save = (next: State) => {
    setSt(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  };
  if (!st) return <Shell title="Onboard new agent">{null}</Shell>;

  const shown = view ?? st.current;
  const stage = ONBOARDING_STAGES[shown];
  const result = st.results[stage.id];
  const isCurrent = shown === st.current && !st.done;

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/onboarding/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: stage.id, fixes: st.fixes, approvedSkills: st.skills }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "check failed");
      save({ ...st, results: { ...st.results, [stage.id]: d } });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const next = () => {
    const last = st.current === ONBOARDING_STAGES.length - 1;
    save({ ...st, current: last ? st.current : st.current + 1, done: last });
    setView(null);
    if (last) snack("Goldman's agent is live on the network");
  };
  const ask = (p: Problem) => {
    save({ ...st, asked: [...st.asked, p] });
    snack(`Request sent to ${ONBOARDING_CONTACT}`);
    setTimeout(() => {
      const cur = load();
      const upd = { ...cur, fixes: [...new Set([...cur.fixes, p])], results: { ...cur.results, [stage.id]: undefined } };
      setSt(upd);
      try {
        localStorage.setItem(KEY, JSON.stringify(upd));
      } catch {}
      snack("Goldman resubmitted the application");
    }, 1800);
  };
  const restart = () => {
    save(initial());
    setView(null);
  };

  const doneCount = ONBOARDING_STAGES.filter((s) => st.results[s.id]?.ok).length;

  return (
    <Shell title="Onboard new agent · Goldman Sachs" subtitle="Network Onboarding Assistant · BNY AI Hub" right={<span className="hidden text-xs text-muted sm:block">{doneCount} of {ONBOARDING_STAGES.length} checks passed</span>}>
      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-6 pb-24 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Onboarding steps" className="lg:sticky lg:top-6 lg:self-start">
          <ol className="space-y-4">
            {LAYERS.map((layer) => (
              <li key={layer}>
                <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">{layer}</p>
                <ol className="mt-1.5 space-y-0.5">
                  {ONBOARDING_STAGES.map((s, i) => {
                    if (s.layer !== layer) return null;
                    const r = st.results[s.id];
                    const reachable = i <= st.current;
                    const state = r?.ok ? "done" : r && !r.ok ? "problem" : i === st.current && !st.done ? "current" : "todo";
                    return (
                      <li key={s.id}>
                        <button
                          disabled={!reachable}
                          onClick={() => setView(i)}
                          aria-current={i === shown ? "step" : undefined}
                          className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm disabled:cursor-default ${i === shown ? "bg-white shadow-sm ring-1 ring-line" : reachable ? "hover:bg-white" : ""}`}
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                              state === "done" ? "bg-ok text-white" : state === "problem" ? "bg-bad text-white" : state === "current" ? "bg-navy text-white" : "border border-line text-muted"
                            }`}
                          >
                            {state === "done" ? "✓" : state === "problem" ? "!" : i + 1}
                          </span>
                          <span className={reachable ? "text-ink" : "text-muted"}>{s.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </li>
            ))}
          </ol>
          {(doneCount > 0 || st.done) && (
            <button onClick={restart} className="mt-6 text-xs text-muted hover:text-bad hover:underline">
              Start the onboarding again
            </button>
          )}
        </nav>

        <section className="min-w-0">
          {st.done && shown === st.current ? (
            <div className="rounded-xl border border-ok/30 bg-white p-6">
              <Pill tone="ok">Live</Pill>
              <h2 className="mt-3 text-2xl font-semibold text-navy">Goldman&apos;s fails agent is on the network</h2>
              <p className="mt-2 text-ink">
                Every layer checked: who they are, how they settle, their agent&apos;s identity, what it may do, and a tested link. Goldman&apos;s agent can now ask BNY about failed
                trades within the limits you set; every message still passes BNY&apos;s gateway.
              </p>
              <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                {ONBOARDING_STAGES.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <span className="text-ok">✓</span> {s.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <article className="rounded-xl border border-line bg-white">
              <header className="border-b border-line px-6 py-4">
                <p className="text-xs text-muted">
                  Step {shown + 1} of {ONBOARDING_STAGES.length} · {stage.layer} · checked by {stage.owner}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-navy">{stage.label}</h2>
              </header>
              <div className="space-y-4 px-6 py-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-muted">What we check</p>
                    <p className="mt-1 text-sm text-ink">{stage.what}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">Why it matters</p>
                    <p className="mt-1 text-sm text-ink">{stage.why}</p>
                  </div>
                </div>

                {stage.id === "permissions" && isCurrent && !result && (
                  <fieldset className="rounded-lg border border-line p-4">
                    <legend className="px-1 text-xs font-semibold text-muted">Goldman asks for four permissions</legend>
                    <ul className="space-y-2.5">
                      {PERMISSIONS.map((p) => (
                        <li key={p.id}>
                          <label className="flex items-start gap-3 text-sm">
                            <input
                              type="checkbox"
                              className="mt-0.5 accent-teal"
                              checked={st.skills.includes(p.id)}
                              onChange={(e) => save({ ...st, skills: e.target.checked ? [...st.skills, p.id] : st.skills.filter((x) => x !== p.id) })}
                            />
                            <span>
                              <span className="font-medium text-ink">{p.label}</span>
                              {!p.recommended && (
                                <span className="ml-2">
                                  <Pill tone="warn">not recommended</Pill>
                                </span>
                              )}
                              <span className="block text-xs text-muted">{p.note}</span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </fieldset>
                )}

                {result && (
                  <div className={`rounded-lg border-l-4 px-4 py-3 ${result.ok ? "border-ok bg-ok-soft/60" : "border-bad bg-bad-soft/60"}`}>
                    <p className={`text-sm font-semibold ${result.ok ? "text-ok" : "text-bad"}`}>{result.ok ? "Passed" : "Problem found"}</p>
                    <p className="mt-1 text-sm text-ink">{result.result}</p>
                    <Expandable label="Technical detail">
                      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 rounded-md bg-white p-3 text-xs">
                        <dt className="text-muted">source</dt>
                        <dd className="font-mono break-all">{result.technical.source}</dd>
                        {Object.entries(result.technical.detail).map(([k, v]) => (
                          <div key={k} className="contents">
                            <dt className="text-muted">{k}</dt>
                            <dd className="font-mono break-all">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </Expandable>
                  </div>
                )}

                {result && !result.ok && result.problem && isCurrent && <Resolve problem={result.problem} asked={st.asked.includes(result.problem)} onAsk={() => ask(result.problem!)} />}

                {err && (
                  <p role="alert" className="text-sm text-bad">
                    Couldn&apos;t run the check: {err}
                  </p>
                )}

                {isCurrent && (
                  <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                    {!result && (
                      <button onClick={run} disabled={busy || (stage.id === "permissions" && st.skills.length === 0)} className="rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal disabled:opacity-50">
                        {busy ? "Checking…" : stage.action}
                      </button>
                    )}
                    {result?.ok && (
                      <button onClick={next} className="rounded-md bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy">
                        {st.current === ONBOARDING_STAGES.length - 1 ? "Finish: put the agent live" : "Continue to the next check →"}
                      </button>
                    )}
                    {result && !result.ok && !result.problem && (
                      <button onClick={() => save({ ...st, results: { ...st.results, [stage.id]: undefined } })} className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-canvas">
                        Change and check again
                      </button>
                    )}
                  </div>
                )}
                {!isCurrent && view !== null && (
                  <button onClick={() => setView(null)} className="text-sm font-medium text-teal hover:underline">
                    Back to the current step →
                  </button>
                )}
              </div>
            </article>
          )}
        </section>
      </div>
    </Shell>
  );
}

function Resolve({ problem, asked, onAsk }: { problem: Problem; asked: boolean; onAsk: () => void }) {
  const f = FIXES[problem];
  return (
    <div className="rounded-lg border border-line p-4">
      <p className="text-sm font-semibold text-navy">How to resolve it: {f.title.toLowerCase()}</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink">
        {f.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <div className="mt-3 rounded-md bg-canvas px-3 py-2 text-sm">
        <p className="text-xs text-muted">Message to {ONBOARDING_CONTACT}</p>
        <p className="mt-0.5 text-ink">“{f.ask}”</p>
        {asked && <p className="mt-2 border-t border-line pt-2 text-ink">Reply: “{f.reply}”</p>}
      </div>
      {!asked && (
        <button onClick={onAsk} className="mt-3 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-teal">
          {f.label}
        </button>
      )}
      {asked && <p className="mt-2 text-xs text-muted">Waiting for Goldman to resubmit, then check again.</p>}
    </div>
  );
}
