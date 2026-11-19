"use client";
// Onboarding Goldman's agent: one security layer at a time, as steps (not a chat).
// In each step the onboarding lead uploads what Goldman sent (mimicked), types in
// the details from the application (click a box and it fills in), runs the system's checks
// against BNY's reference data, and ticks off what only a person can check. When a
// check finds a problem, the step shows how to resolve it and checks again.
import { useCallback, useEffect, useRef, useState } from "react";
import { APPROVALS, FIXES, LAYERS, LIMITS, type LimitId, ONBOARDING_CONTACT, ONBOARDING_STAGES, PERMISSIONS, type Problem, REPLY_FIELDS, STAGE_WORK, type InputSpec, type UploadSpec } from "@/lib/onboardingGuide";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { store, useProto } from "../proto/Proto";
import { Expandable, Pill } from "../ui";
import { AgentCardOverlay } from "./AgentCardOverlay";
import { initialOnboarding, loadOnboarding, NEW_CONNECTION_KEY, nowStamp, type OnboardingState, saveOnboarding, type Upload } from "./onboardingState";
import { Shell } from "./Shell";


export function OnboardingFlow() {
  const { snack } = useProto();
  const router = useRouter();
  // "Onboard new agent" in the sidebar: start a new onboarding unless one is under way.
  const wantsNew = useSearchParams().get("new") === "1";
  const [st, setSt] = useState<OnboardingState | null>(null);
  const [app, setApp] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<UploadSpec | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSt(loadOnboarding()), 0);
    return () => clearTimeout(t);
  }, []);
  const fixKey = st?.fixes.join(",");
  useEffect(() => {
    if (fixKey === undefined) return;
    fetch(`/api/onboarding/check?fixes=${fixKey}`)
      .then((r) => r.json())
      .then(setApp)
      .catch(() => setApp(null));
  }, [fixKey]);
  const save = useCallback((next: OnboardingState) => {
    setSt(next);
    saveOnboarding(next);
  }, []);

  const shownIdx = view ?? st?.current ?? 0;
  const stage = ONBOARDING_STAGES[shownIdx];
  const result = st?.results[stage.id];
  const work = STAGE_WORK[stage.id];

  // Reveal the system's checks one by one after a run.
  const shownChecks = result ? (revealed[stage.id] ?? work.system.length) : 0;
  useEffect(() => {
    if (!result || (revealed[stage.id] ?? work.system.length) >= work.system.length) return;
    const t = setTimeout(() => setRevealed((r) => ({ ...r, [stage.id]: (r[stage.id] ?? 0) + 1 })), 380);
    return () => clearTimeout(t);
  }, [result, revealed, stage.id, work.system.length]);

  // Resuming an onboarding under way: drop ?new=1 so finishing shows the success screen.
  useEffect(() => {
    if (wantsNew && st?.started && !st.done) router.replace("/eliza/onboarding");
  }, [wantsNew, st?.started, st?.done, router]);

  // The system's checks start by themselves once the step's document is uploaded and its
  // details are entered. Set limits is the exception: those are choices, so it waits for Save.
  const runRef = useRef<() => void>(() => {});
  const autoReady =
    !!st &&
    st.started &&
    !st.done &&
    shownIdx === st.current &&
    !result &&
    !busy &&
    !err &&
    stage.id !== "permissions" &&
    (!work.upload || (st.uploads[stage.id] ?? []).some((u) => !u.superseded)) &&
    (work.inputs ?? []).every((i) => !!st.inputs[i.id]);
  useEffect(() => {
    if (!autoReady) return;
    const t = setTimeout(() => runRef.current(), 600);
    return () => clearTimeout(t);
  }, [autoReady, stage.id]);

  if (!st) return <Shell title="Onboard new agent">{null}</Shell>;
  if (!st.started || (wantsNew && st.done))
    return (
      <Shell title="Onboard new agent" subtitle="Counterparty agent onboarding · BNY AI Hub">
        <StartOnboarding
          replacing={st.started && st.done}
          onStart={(title) => {
            store.set(NEW_CONNECTION_KEY, null);
            save({ ...initialOnboarding(), started: true, title, startedAt: nowStamp() });
            setView(null);
            setRevealed({});
            router.replace("/eliza/onboarding");
          }}
        />
      </Shell>
    );
  const isCurrent = shownIdx === st.current && !st.done;
  const uploads = st.uploads[stage.id] ?? [];
  const uploaded = !work.upload || uploads.some((u) => !u.superseded);
  const inputsDone = (work.inputs ?? []).every((i) => !!st.inputs[i.id]);
  const ready = uploaded && inputsDone && (stage.id !== "permissions" || st.skills.length > 0);
  const checksDone = !!result && shownChecks >= work.system.length;
  const manualDone = work.manual.every((m) => st.manual[stage.id]?.includes(m));
  const partsBefore = (work.upload ? 1 : 0) + (work.inputs ? 1 : 0) + (stage.id === "permissions" ? 1 : 0) + (work.showCredentials ? 1 : 0);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/onboarding/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: stage.id, fixes: st.fixes, approvedSkills: st.skills, passMinutes: parseInt(st.limits.pass ?? "10", 10) || 10 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "check failed");
      setRevealed((x) => ({ ...x, [stage.id]: 0 }));
      save({ ...st, results: { ...st.results, [stage.id]: d } });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  runRef.current = run;
  const next = () => {
    const last = st.current === ONBOARDING_STAGES.length - 1;
    if (last) store.set(NEW_CONNECTION_KEY, "1");
    save({ ...st, current: last ? st.current : st.current + 1, done: last, completedAt: { ...st.completedAt, [stage.id]: nowStamp() } });
    setView(null);
    if (last) window.scrollTo?.(0, 0);
  };
  const ask = (p: Problem) => {
    save({ ...st, asked: [...st.asked, p] });
    snack(`Request sent to ${ONBOARDING_CONTACT}`);
    setTimeout(() => {
      const cur = loadOnboarding();
      // The resubmitted application changes these values: they must be entered again.
      const reenter = p === "lei" ? ["lei"] : ["domain", "proofUrl"];
      const inputs = Object.fromEntries(Object.entries(cur.inputs).filter(([k]) => !reenter.includes(k)));
      const stageId = p === "lei" ? "company" : "domain";
      save({ ...cur, fixes: [...new Set([...cur.fixes, p])], inputs, results: { ...cur.results, [stageId]: undefined }, manual: { ...cur.manual, [stageId]: [] } });
      snack("Goldman resubmitted the application");
    }, 1800);
  };
  const upload = (spec: UploadSpec) => {
    const list = (st.uploads[stage.id] ?? []).map((u) => ({ ...u, superseded: true }));
    const u: Upload = { file: spec.file, size: spec.size, name: spec.name, sentBy: spec.sentBy, at: nowStamp() };
    save({ ...st, uploads: { ...st.uploads, [stage.id]: [...list, u] } });
  };
  const restart = () => {
    store.set(NEW_CONNECTION_KEY, null);
    save(initialOnboarding());
    setView(null);
    setRevealed({});
  };
  const doneCount = ONBOARDING_STAGES.filter((s) => st.results[s.id]?.ok).length;
  const checkState = (label: string, i: number): "ok" | "bad" | "pending" => {
    if (!result || i >= shownChecks) return "pending";
    if (result.ok) return "ok";
    const failing = work.failing ?? work.system[work.system.length - 1];
    return label === failing ? "bad" : work.system.indexOf(label) < work.system.indexOf(failing) ? "ok" : "pending";
  };

  return (
    <Shell title={`Onboard new agent · ${st.title || "Goldman Sachs"}`} subtitle="Counterparty agent onboarding · BNY AI Hub" right={<span className="hidden text-xs text-muted sm:block">{doneCount} of {ONBOARDING_STAGES.length} steps passed</span>}>
      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-6 pb-24 lg:grid-cols-[250px_minmax(0,1fr)]">
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
                    const state = st.completedAt[s.id] ? "done" : r && !r.ok ? "problem" : i === st.current && !st.done ? "current" : "todo";
                    return (
                      <li key={s.id}>
                        <button
                          disabled={!reachable}
                          onClick={() => setView(i)}
                          aria-current={i === shownIdx ? "step" : undefined}
                          className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm disabled:cursor-default ${i === shownIdx ? "bg-white shadow-sm ring-1 ring-line" : reachable ? "hover:bg-white" : ""}`}
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
          {st.done && view === null ? (
            <Success st={st} />
          ) : (
            <article className="rounded-xl border border-line bg-white">
              <header className="border-b border-line px-6 py-4">
                <p className="text-xs text-muted">
                  Step {shownIdx + 1} of {ONBOARDING_STAGES.length} · {stage.layer} · checked by {stage.owner}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-navy">{stage.label}</h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-muted">What we check</p>
                    <p className="mt-1 text-sm text-ink">{stage.what}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">Why it matters</p>
                    <p className="mt-1 text-sm text-ink">{stage.why}</p>
                  </div>
                </div>
              </header>
              <div className="space-y-5 px-6 py-5">
                {work.showCard && <CardPreview />}

                {work.showCredentials && (
                  <Part n={1} title="Credentials to register" done={!!result?.ok && checksDone}>
                    <Credentials st={st} detail={result?.ok ? result.technical.detail : undefined} />
                  </Part>
                )}

                {work.upload && (
                  <Part n={1} title={`Upload: ${work.upload.name.toLowerCase()}`} done={uploaded}>
                    <UploadBox spec={work.upload} uploads={uploads} locked={!isCurrent || !!result?.ok} onUpload={() => upload(work.upload!)} onView={() => setPreview(work.upload!)} />
                  </Part>
                )}

                {work.inputs && (
                  <Part n={work.upload ? 2 : 1} title="Enter the details from the application" done={inputsDone}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {work.inputs.map((i) => (
                        <ClickInput key={i.id} spec={i} value={st.inputs[i.id]} source={app?.[i.id]} fixes={st.fixes} locked={!isCurrent || !!result} onFill={(v) => save({ ...loadOnboarding(), inputs: { ...loadOnboarding().inputs, [i.id]: v } })} />
                      ))}
                    </div>
                  </Part>
                )}

                {stage.id === "permissions" && <Limits st={st} locked={!isCurrent || !!result} save={save} />}

                <Part n={partsBefore + 1} title="System checks" done={checksDone && !!result?.ok}>
                  <ul className="space-y-1.5">
                    {work.system.map((label, i) => {
                      const s = checkState(label, i);
                      return (
                        <li key={label} className="flex items-center gap-2.5 text-sm">
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${s === "ok" ? "bg-ok text-white" : s === "bad" ? "bg-bad text-white" : "border border-line text-muted"}`}
                          >
                            {s === "ok" ? "✓" : s === "bad" ? "✗" : busy || (result && i === shownChecks) ? "…" : ""}
                          </span>
                          <span className={s === "pending" ? "text-muted" : "text-ink"}>{label}</span>
                        </li>
                      );
                    })}
                  </ul>
                  {isCurrent && !result && (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {stage.id === "permissions" ? (
                        <button onClick={run} disabled={busy || !ready} className="rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal disabled:opacity-50">
                          {busy ? "Checking…" : stage.action}
                        </button>
                      ) : err ? (
                        <button onClick={run} disabled={busy} className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-canvas">
                          Run the checks again
                        </button>
                      ) : busy || ready ? (
                        <span role="status" className="flex items-center gap-2 text-sm text-ink">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-teal" /> Running the checks…
                        </span>
                      ) : null}
                      {!ready && (
                        <span className="text-xs text-muted">
                          {!uploaded ? "The checks start once the document is uploaded." : !inputsDone ? "The checks start once every detail is entered." : "Grant at least one permission."}
                        </span>
                      )}
                    </div>
                  )}
                  {checksDone && result && (
                    <div className={`mt-3 rounded-lg border-l-4 px-4 py-3 ${result.ok ? "border-ok bg-ok-soft/60" : "border-bad bg-bad-soft/60"}`}>
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
                </Part>

                {checksDone && result && !result.ok && result.problem && isCurrent && <Resolve problem={result.problem} asked={st.asked.includes(result.problem)} onAsk={() => ask(result.problem!)} />}

                {work.manual.length > 0 && (
                  <Part n={partsBefore + 2} title="Your checks" done={manualDone}>
                    <p className="mb-2 text-xs text-muted">The system can&apos;t check these. {work.upload ? "Open the document and confirm each one." : "Confirm each one."}</p>
                    <ul className="space-y-1.5">
                      {work.manual.map((m) => {
                        const ticked = !!st.manual[stage.id]?.includes(m);
                        const enabled = isCurrent && checksDone && !!result?.ok;
                        return (
                          <li key={m}>
                            <label className={`flex items-start gap-2.5 text-sm ${enabled ? "" : "text-muted"}`}>
                              <input
                                type="checkbox"
                                className="mt-0.5 accent-teal"
                                disabled={!enabled}
                                checked={ticked}
                                onChange={(e) => {
                                  const cur = st.manual[stage.id] ?? [];
                                  save({ ...st, manual: { ...st.manual, [stage.id]: e.target.checked ? [...cur, m] : cur.filter((x) => x !== m) } });
                                }}
                              />
                              {m}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                    {!checksDone && <p className="mt-2 text-xs text-muted">Available once the system checks pass.</p>}
                  </Part>
                )}

                {err && (
                  <p role="alert" className="text-sm text-bad">
                    Couldn&apos;t run the check: {err}
                  </p>
                )}

                {isCurrent && result?.ok && checksDone && (
                  <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                    <button onClick={next} disabled={!manualDone} className="rounded-md bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy disabled:opacity-50">
                      {st.current === ONBOARDING_STAGES.length - 1 ? "Finish: put the agent live" : "Continue to the next step →"}
                    </button>
                    {!manualDone && <span className="text-xs text-muted">Tick your checks first.</span>}
                  </div>
                )}
                {isCurrent && result && !result.ok && !result.problem && checksDone && (
                  <button onClick={() => save({ ...st, results: { ...st.results, [stage.id]: undefined } })} className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-canvas">
                    Change and check again
                  </button>
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
      {preview && <DocPreview spec={preview} onClose={() => setPreview(null)} />}
    </Shell>
  );
}

function Part({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy">
        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${done ? "bg-ok text-white" : "bg-canvas text-muted"}`}>{done ? "✓" : n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A mimicked upload: choosing the file shows it arriving, then it can be opened. */
function UploadBox({ spec, uploads, locked, onUpload, onView }: { spec: UploadSpec; uploads: Upload[]; locked: boolean; onUpload: () => void; onView: () => void }) {
  const [progress, setProgress] = useState<number | null>(null);
  useEffect(() => {
    if (progress === null) return;
    const t = setTimeout(() => {
      if (progress >= 100) {
        setProgress(null);
        onUpload();
      } else setProgress(progress + 20);
    }, 160);
    return () => clearTimeout(t);
  }, [progress, onUpload]);
  const current = uploads.filter((u) => !u.superseded).at(-1);
  return (
    <div>
      {current ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-canvas px-3 py-2.5 text-sm">
          <FileIcon />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink">{current.file}</p>
            <p className="text-xs text-muted">
              {current.size} · {spec.pages} page{spec.pages === 1 ? "" : "s"} · from {current.sentBy} · uploaded {current.at}
            </p>
          </div>
          <button onClick={onView} className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink hover:border-teal">
            View document
          </button>
        </div>
      ) : progress !== null ? (
        <div className="rounded-md bg-canvas px-3 py-3 text-sm">
          <p className="truncate text-ink">{spec.file}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">Uploading… {progress}%</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-md border-2 border-dashed border-line px-4 py-6 text-center">
          <FileIcon />
          <p className="text-sm text-ink">
            {spec.sentBy} sent <span className="font-medium">{spec.file}</span>
          </p>
          <button disabled={locked} onClick={() => setProgress(0)} className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-teal disabled:opacity-50">
            Choose file and upload
          </button>
          <p className="text-[11px] text-muted">Prototype: the file is simulated; nothing is read from your computer.</p>
        </div>
      )}
    </div>
  );
}

const FileIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0 text-muted" aria-hidden>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
  </svg>
);

/** An ordinary empty text box. Clicking it fills in the value from Goldman's
 *  application (synthetic), typed in as if by hand. */
function ClickInput({ spec, value, source, fixes, locked, onFill }: { spec: InputSpec; value?: string; source?: string; fixes: Problem[]; locked: boolean; onFill: (v: string) => void }) {
  const [typing, setTyping] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    if (typing === null || !target) return;
    if (typing.length >= target.length) {
      onFill(target);
      const t = setTimeout(() => setTyping(null), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setTyping(target.slice(0, typing.length + Math.max(1, Math.ceil(target.length / 18)))), 30);
    return () => clearTimeout(t);
  }, [typing, target, onFill]);
  const fill = async () => {
    if (locked || value || typing !== null) return;
    let v = source;
    // The application may not have loaded yet: fetch it now rather than ignore the click.
    if (!v) {
      try {
        const d = await (await fetch(`/api/onboarding/check?fixes=${fixes.join(",")}`)).json();
        v = d?.[spec.id];
      } catch {}
    }
    if (!v) return;
    setTarget(v);
    setTyping("");
  };
  const id = `in-${spec.id}`;
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {spec.label}
      </label>
      <input
        id={id}
        type="text"
        readOnly
        value={typing ?? value ?? ""}
        onClick={fill}
        onFocus={fill}
        disabled={locked && !value}
        className={`mt-1 h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 disabled:bg-canvas ${!value && !locked ? "cursor-text" : ""} ${spec.mono ? "font-mono text-[13px]" : ""}`}
      />
    </div>
  );
}

const SUGGESTED_TITLE = "Goldman Sachs · US equity fails agent";

/** The first screen of a new onboarding: pick the application, name it, start. */
function StartOnboarding({ replacing, onStart }: { replacing: boolean; onStart: (title: string) => void }) {
  const [picked, setPicked] = useState(false);
  const [title, setTitle] = useState("");
  return (
    <div className="mx-auto max-w-3xl px-5 py-8 pb-24">
      <p className="text-xs font-semibold tracking-wide text-teal uppercase">New agent onboarding</p>
      <h2 className="mt-1 text-2xl font-semibold text-navy">Connect another firm&apos;s agent to BNY&apos;s network</h2>
      <p className="mt-2 text-ink">
        You&apos;ll go through it one layer at a time: who they are, how they settle, their agent&apos;s identity, what it may do, and a tested link. The agent can&apos;t reach BNY until
        every step passes.
      </p>
      {replacing && (
        <p className="mt-4 rounded-md border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-ink">
          Goldman&apos;s agent was onboarded earlier in this browser. Starting again takes <span className="font-medium">BNY ⇄ Goldman Sachs</span> out of the sidebar until this
          onboarding finishes.
        </p>
      )}

      <section className="mt-6 rounded-xl border border-line bg-white p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-navy">
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${picked ? "bg-ok text-white" : "bg-canvas text-muted"}`}>{picked ? "✓" : 1}</span>
          Choose the application
        </h3>
        <p className="mt-1 text-xs text-muted">Applications waiting for review, from the network portal.</p>
        <button
          onClick={() => setPicked(true)}
          aria-pressed={picked}
          className={`mt-3 flex w-full items-start gap-3 rounded-lg border p-4 text-left transition ${picked ? "border-teal bg-teal-soft/50 ring-2 ring-teal/20" : "border-line hover:border-teal"}`}
        >
          <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${picked ? "border-teal" : "border-line"}`}>
            {picked && <span className="h-2 w-2 rounded-full bg-teal" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold text-navy">Goldman Sachs &amp; Co. LLC</span>
              <span className="text-xs text-muted">GS Counterparty Outreach Agent</span>
            </span>
            <span className="mt-1 block text-sm text-ink">Wants to ask BNY about failed and rejected deliveries, agent to agent.</span>
            <span className="mt-1 block text-xs text-muted">Submitted 18 Nov, 08:12 ET · contact: {ONBOARDING_CONTACT} · referred by Rachel Okafor</span>
          </span>
          <Pill tone="warn">Awaiting review</Pill>
        </button>
      </section>

      <section className={`mt-4 rounded-xl border border-line bg-white p-5 ${picked ? "" : "opacity-50"}`}>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-navy">
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${title.trim() ? "bg-ok text-white" : "bg-canvas text-muted"}`}>{title.trim() ? "✓" : 2}</span>
          Name this onboarding
        </h3>
        <label htmlFor="ob-title" className="mt-3 block text-xs font-medium text-muted">
          Title
        </label>
        <input
          id="ob-title"
          type="text"
          value={title}
          disabled={!picked}
          onChange={(e) => setTitle(e.target.value)}
          onClick={() => !title && setTitle(SUGGESTED_TITLE)}
          maxLength={80}
          className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 disabled:bg-canvas"
        />
        <p className="mt-1 text-xs text-muted">Shown on the onboarding, in Documents and in the audit trail.</p>
      </section>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={() => onStart(title.trim())}
          disabled={!picked || !title.trim()}
          className="rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal disabled:opacity-50"
        >
          Start onboarding →
        </button>
        {(!picked || !title.trim()) && <span className="text-xs text-muted">{!picked ? "Choose the application first." : "Give the onboarding a title."}</span>}
      </div>
    </div>
  );
}

const CONFETTI = ["#2b9cae", "#00243e", "#1f7a4d", "#f0b429", "#7399c6", "#e3f3f6"];

/** The end of onboarding: a moment worth marking. */
function Success({ st }: { st: OnboardingState }) {
  const problems = st.fixes.length;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-ok/30 bg-white p-8 shadow-sm">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {Array.from({ length: 42 }, (_, i) => (
          <span
            key={i}
            className="confetti"
            style={{
              left: `${(i * 37) % 100}%`,
              background: CONFETTI[i % CONFETTI.length],
              animationDelay: `${(i % 7) * 0.12}s`,
              animationDuration: `${2.2 + (i % 5) * 0.35}s`,
              width: i % 3 ? 8 : 6,
              height: i % 3 ? 12 : 6,
              borderRadius: i % 3 ? 2 : 999,
            }}
          />
        ))}
      </div>
      <div className="relative">
        <div className="success-pop flex h-16 w-16 items-center justify-center rounded-full bg-ok text-3xl text-white shadow-lg shadow-ok/30">✓</div>
        <p className="mt-5 text-sm font-semibold tracking-wide text-ok uppercase">Onboarding complete{st.title ? ` · ${st.title}` : ""}</p>
        <h2 className="mt-1 text-3xl font-semibold text-navy">Goldman Sachs is on the network</h2>
        <p className="mt-3 max-w-2xl text-ink">
          Goldman&apos;s fails agent passed every check: who they are, how they settle, the agent&apos;s identity, what it may do, and a tested link.
          {problems > 0 && ` You caught and resolved ${problems === 1 ? "one problem" : `${problems} problems`} along the way.`}
        </p>
        <dl className="mt-6 grid max-w-xl grid-cols-3 gap-3">
          {[
            [String(ONBOARDING_STAGES.length), "steps passed"],
            [String(problems), problems === 1 ? "problem resolved" : "problems resolved"],
            [String(st.skills.length), st.skills.length === 1 ? "permission granted" : "permissions granted"],
          ].map(([n, l]) => (
            <div key={l} className="rounded-lg bg-canvas px-4 py-3">
              <dt className="sr-only">{l}</dt>
              <dd className="text-2xl font-semibold text-navy tabular">{n}</dd>
              <dd className="text-xs text-muted">{l}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-teal/30 bg-teal-soft/60 px-4 py-3 text-sm text-ink">
          <span aria-hidden className="text-lg leading-none text-teal">←</span>
          <span>
            <span className="font-semibold text-navy">BNY ⇄ Goldman Sachs</span>{" "}is now in your sidebar under A2A connections. Cases appear there when Goldman&apos;s agent contacts BNY.
          </span>
        </div>
        <details className="mt-5 text-sm">
          <summary className="cursor-pointer text-muted hover:text-ink">What was checked</summary>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {ONBOARDING_STAGES.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <span className="text-ok">✓</span> {s.label}
                {st.completedAt[s.id] && <span className="text-xs text-muted">· {st.completedAt[s.id]}</span>}
              </li>
            ))}
          </ul>
        </details>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/eliza" className="rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal">
            Back to home
          </Link>
          <Link href="/eliza/documents" className="rounded-md border border-line px-5 py-2.5 text-sm font-medium text-ink hover:bg-canvas">
            See the documents and details
          </Link>
        </div>
      </div>
    </div>
  );
}

function DocPreview({ spec, onClose }: { spec: UploadSpec; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={spec.file} className="dock-in w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-line bg-canvas px-4 py-2">
          <span className="truncate font-mono text-xs text-ink">{spec.file}</span>
          <button onClick={onClose} autoFocus className="text-sm text-muted hover:text-navy">
            Close <span className="text-[11px]">(Esc)</span>
          </button>
        </header>
        <div className="space-y-2 bg-[#f4f4f2] p-6">
          <div className="mx-auto max-w-md space-y-2.5 bg-white px-8 py-8 font-serif text-[13px] leading-relaxed text-ink shadow">
            {spec.preview.map((l, i) => (
              <p key={i} className={i === 0 ? "font-sans text-xs font-bold tracking-wide" : ""}>
                {l}
              </p>
            ))}
            <p className="pt-3 text-center font-sans text-[10px] text-muted">
              Page 1 of {spec.pages} · synthetic document
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Goldman's Agent Card as submitted, with the full card one click away. */
/** What BNY registers with its auth server. Nothing to enter: each value is generated or carried over. */
function Credentials({ st, detail }: { st: OnboardingState; detail?: Record<string, string> }) {
  const cert = st.results.identity?.technical.detail;
  const rows: { label: string; value: React.ReactNode; from?: string; mono?: boolean }[] = [
    { label: "Client ID", value: detail?.client_id ?? <span className="text-muted">Generated when registered…</span>, from: "Generated by BNY", mono: !!detail },
    {
      label: "Certificate",
      value: (
        <>
          <span className="block">{cert?.certificate_subject ?? "CN=gs-outreach, O=Goldman Sachs & Co. LLC"}</span>
          {cert?.certificate_fingerprint && <span className="block font-mono text-[11px] text-muted">SHA-256 {cert.certificate_fingerprint.slice(0, 11)} … {cert.certificate_fingerprint.slice(-5)}</span>}
        </>
      ),
      from: "From the certificate request (step 8)",
    },
    { label: "Access pass lifetime", value: st.limits.pass ?? "10 min", from: "From Set limits (step 9)" },
    {
      label: "Permissions",
      value: `${st.skills.length} skill${st.skills.length === 1 ? "" : "s"}, read from the registry on every request`,
      from: "From Set limits (step 9)",
    },
  ];
  return (
    <div>
      <p className="text-xs text-muted">Nothing to enter: BNY generates the client ID and carries the rest over from earlier steps.</p>
      <dl className="mt-3 divide-y divide-line rounded-lg border border-line">
        {rows.map((r) => (
          <div key={r.label} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[10rem_1fr]">
            <dt className="text-sm text-muted">{r.label}</dt>
            <dd className="min-w-0 text-sm text-ink">
              <span className={r.mono ? "font-mono text-[13px]" : ""}>{r.value}</span>
              {r.from && <span className="mt-0.5 block text-[11px] text-muted">{r.from}</span>}
            </dd>
          </div>
        ))}
      </dl>
      {detail && (
        <Expandable label="Technical details">
          <dl className="space-y-1 rounded-md bg-canvas px-3 py-2 text-xs">
            {[
              ["Token endpoint", detail.token_endpoint],
              ["Grant type", detail.grant_type],
              ["Pass audience", detail.audience],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[8rem_1fr] gap-2">
                <dt className="text-muted">{k}</dt>
                <dd className="font-mono break-all text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          {detail.test_pass && (
            <>
              <p className="mt-3 text-xs font-medium text-ink">Test pass, decoded</p>
              <pre className="mt-1 overflow-x-auto rounded-md bg-navy px-3 py-2 font-mono text-[11px] leading-relaxed text-white">{detail.test_pass}</pre>
              <p className="mt-1 text-[11px] text-muted">
                No permissions in it: the gateway looks them up by client ID. <span className="font-mono">cnf</span> holds the certificate&apos;s fingerprint, so a copied pass is useless without Goldman&apos;s private key.
              </p>
            </>
          )}
        </Expandable>
      )}
    </div>
  );
}

function CardPreview() {
  const [open, setOpen] = useState(false);
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-lg border border-gs/30 bg-gs-soft/40 p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gs-dark font-serif text-sm text-white">GS</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">Agent Card submitted by Goldman</p>
        <p className="font-semibold text-navy">GS Counterparty Outreach Agent · v1.0.0</p>
        <p className="font-mono text-xs text-muted">https://gs.example/agents/outreach · skill: outreach.contact</p>
      </div>
      <button onClick={() => setOpen(true)} className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink hover:border-teal">
        View the full card
      </button>
      {open && <AgentCardOverlay agentId="gs-outreach" onClose={() => setOpen(false)} />}
    </section>
  );
}

function Limits({ st, locked, save }: { st: OnboardingState; locked: boolean; save: (s: OnboardingState) => void }) {
  const toggle = (list: string[], id: string, on: boolean) => (on ? [...list, id] : list.filter((x) => x !== id));
  return (
    <div className="space-y-4">
      <fieldset disabled={locked} className="rounded-lg border border-line p-4">
        <legend className="px-1 text-xs font-semibold text-muted">What it may ask BNY (Goldman asked for four)</legend>
        <ul className="space-y-2.5">
          {PERMISSIONS.map((p) => (
            <li key={p.id}>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 accent-teal" checked={st.skills.includes(p.id)} onChange={(e) => save({ ...st, skills: toggle(st.skills, p.id, e.target.checked) })} />
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

      <fieldset disabled={locked} className="rounded-lg border border-line p-4">
        <legend className="px-1 text-xs font-semibold text-muted">Limits</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {(Object.keys(LIMITS) as LimitId[]).map((id) => (
            <label key={id} className="block text-sm">
              <span className="font-medium text-ink">{LIMITS[id].label}</span>
              <select value={st.limits[id]} onChange={(e) => save({ ...st, limits: { ...st.limits, [id]: e.target.value } })} className="mt-1 block w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm">
                {LIMITS[id].options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              <span className="mt-0.5 block text-xs text-muted">{LIMITS[id].note}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset disabled={locked} className="rounded-lg border border-line p-4">
          <legend className="px-1 text-xs font-semibold text-muted">A BNY person approves</legend>
          <ul className="space-y-1.5">
            {APPROVALS.map((a) => (
              <li key={a.id}>
                <label className="flex items-center gap-2.5 text-sm">
                  <input type="checkbox" className="accent-teal" disabled={a.locked} checked={a.locked || st.approvals.includes(a.id)} onChange={(e) => save({ ...st, approvals: toggle(st.approvals, a.id, e.target.checked) })} />
                  {a.label}
                  {a.locked && <span className="text-[11px] text-muted">always</span>}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <fieldset disabled={locked} className="rounded-lg border border-line p-4">
          <legend className="px-1 text-xs font-semibold text-muted">Fields BNY&apos;s replies may carry</legend>
          <ul className="space-y-1.5">
            {REPLY_FIELDS.map((f) => (
              <li key={f.id}>
                <label className="flex items-center gap-2.5 text-sm">
                  <input type="checkbox" className="accent-teal" disabled={f.locked} checked={f.locked || st.replyFields.includes(f.id)} onChange={(e) => save({ ...st, replyFields: toggle(st.replyFields, f.id, e.target.checked) })} />
                  {f.label}
                  <span className="font-mono text-[10px] text-muted">{f.id}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Client names, accounts and internal ids can never be added: they are blocked in code.</p>
        </fieldset>
      </div>
    </div>
  );
}

function Resolve({ problem, asked, onAsk }: { problem: Problem; asked: boolean; onAsk: () => void }) {
  const f = FIXES[problem];
  return (
    <div className="rounded-lg border border-bad/30 p-4">
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
      {asked && <p className="mt-2 text-xs text-muted">Waiting for Goldman to resubmit, then enter the corrected detail and check again.</p>}
    </div>
  );
}
