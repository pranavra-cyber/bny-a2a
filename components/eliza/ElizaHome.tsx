"use client";
// Workspace home. For the onboarding lead, a Teams message (a desktop notification,
// not part of Eliza) is the trigger and the "Onboard new agent" button in the
// sidebar is the entry point; for others it points to their work.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useProto } from "../proto/Proto";
import { ONBOARDING_STAGES } from "@/lib/onboardingGuide";
import { loadOnboarding, type OnboardingState } from "./onboardingState";
import { ONBOARD_HREF, onboardingDone, type Notice, Shell } from "./Shell";

const TRIGGER: Notice = {
  id: "okafor",
  from: "Rachel Okafor · Relationship Manager, BNY",
  channel: "teams",
  at: "08:47 ET",
  title: "Goldman's connection request has come in",
  detail:
    "Hi David, Goldman Sachs just submitted its request to connect its fails agent to our network, so their desk and our Settlement Ops can sort out failed trades agent to agent. They already have a rejected NVDA delivery with us today. Could you take them through onboarding this morning?",
};

export function ElizaHome() {
  const { persona, toast, hydrated } = useProto();
  const [done, setDone] = useState(false);
  const [ob, setOb] = useState<OnboardingState | null>(null);
  useEffect(() => {
    // Wait until we know who this is, or David's notification reaches everyone.
    if (!hydrated) return;
    const t = setTimeout(() => {
      const d = onboardingDone();
      setDone(d);
      const st = loadOnboarding();
      setOb(st);
      // Rachel's ask comes in on Teams (a desktop notification, not Eliza's), until David acts on it.
      if (persona.id === "chen" && !st.started) toast({ key: "okafor", app: "teams", from: "Rachel Okafor · Relationship Manager", title: TRIGGER.title, body: TRIGGER.detail, href: ONBOARD_HREF, repeat: true }, 1200);
    }, 0);
    return () => clearTimeout(t);
  }, [hydrated, persona.id, toast]);
  const first = persona.name.split(" ")[0];

  if (persona.id === "chen")
    return (
      <Shell title="Home" pulseOnboard={!done}>
        <OnboardingHome first={first} ob={ob} done={done} />
      </Shell>
    );

  return (
    <Shell title="Home">
      <div className="mx-auto flex max-w-3xl flex-col px-6 py-10">
        <h2 className="text-3xl font-semibold tracking-tight text-navy">Good morning, {first}.</h2>
        <p className="mt-1 text-muted">What would you like to work on?</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link href={persona.home} className="rounded-lg border border-line bg-white p-4 hover:border-teal">
            <p className="text-sm font-semibold text-navy">{persona.task}</p>
            <p className="mt-1 text-sm text-ink">{persona.taskLine}</p>
          </Link>
          {persona.firm === "BNY" && (
            <Link href="/eliza/audit" className="rounded-lg border border-line bg-white p-4 hover:border-teal">
              <p className="text-sm font-semibold text-navy">Safety and audit</p>
              <p className="mt-1 text-sm text-ink">Every step, message and approval, in the audit log.</p>
            </Link>
          )}
        </div>
      </div>
    </Shell>
  );
}

const SUGGESTIONS = ["Onboard Goldman Sachs' fails agent", "Where is my onboarding up to?", "Which firms are connected to our network?"];

/** David's home: ask Eliza, like any assistant. In the prototype it understands onboarding. */
function OnboardingHome({ first, ob, done }: { first: string; ob: OnboardingState | null; done: boolean }) {
  const router = useRouter();
  const { snack } = useProto();
  const [text, setText] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const inProgress = !!ob?.started && !ob.done;

  const send = (q: string) => {
    const t = q.trim();
    if (!t) return;
    setAsked(t);
    setText("");
    const l = t.toLowerCase();
    if (/onboard|connect|application|set up|add .*agent|new agent/.test(l) && !/which|what firms|list/.test(l)) {
      if (inProgress) {
        setReply(`You have an onboarding under way: “${ob!.title}”, at step ${ob!.current + 1} of ${ONBOARDING_STAGES.length}. Opening it where you left off.`);
        setTimeout(() => router.push("/eliza/onboarding"), 1200);
      } else {
        setReply("Goldman Sachs & Co. LLC applied to connect its fails agent this morning. Opening a new agent onboarding for you.");
        setTimeout(() => router.push("/eliza/onboarding?new=1"), 1200);
      }
      return;
    }
    if (/status|progress|up to|where am i|how far/.test(l)) {
      setReply(
        done
          ? `“${ob?.title}” is complete: Goldman's agent is live on the network.`
          : inProgress
            ? `“${ob!.title}” is at step ${ob!.current + 1} of ${ONBOARDING_STAGES.length}: ${ONBOARDING_STAGES[ob!.current].label}.`
            : "No onboarding is under way. Goldman Sachs has an application waiting for review.",
      );
      return;
    }
    if (/which|connected|network|firms|counterpart/.test(l)) {
      setReply(`Connected agent to agent: Morgan Stanley and J.P. Morgan.${done ? " Goldman Sachs went live today." : " Goldman Sachs has applied and is waiting for onboarding."}`);
      return;
    }
    setReply("In this prototype I can help with agent onboarding. Try “Onboard Goldman Sachs' fails agent”.");
    snack("Free-form requests beyond onboarding are out of scope for this prototype.", "proto");
  };

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal to-navy text-lg font-semibold text-white shadow-lg shadow-teal/20">E</span>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-navy">What would you like to do today, {first}?</h2>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
          className="mt-8 flex items-end gap-2 rounded-3xl border border-line bg-white p-2 pl-5 shadow-[0_8px_30px_rgb(0_36_62/0.08)] focus-within:border-teal focus-within:ring-4 focus-within:ring-teal/10"
        >
          <label htmlFor="ask-eliza" className="sr-only">
            Ask Eliza
          </label>
          <textarea
            id="ask-eliza"
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            placeholder="Ask Eliza…"
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-[15px] text-ink outline-none placeholder:text-muted"
          />
          <button type="submit" disabled={!text.trim()} aria-label="Send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-white hover:bg-teal disabled:bg-line">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </form>

        {asked && reply ? (
          <div className="mt-5 space-y-3" aria-live="polite">
            <p className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-navy px-4 py-2.5 text-[15px] text-white">{asked}</p>
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal to-navy text-xs font-semibold text-white">E</span>
              <p className="dock-in pt-0.5 text-[15px] text-ink">{reply}</p>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm text-ink hover:border-teal hover:text-navy">
                {s}
              </button>
            ))}
          </div>
        )}

        {(inProgress || done) && (
          <Link
            href="/eliza/onboarding"
            className={`mt-10 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${done ? "border-ok/30 bg-ok-soft" : "border-line bg-white"} hover:border-teal`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${done ? "bg-ok" : "animate-pulse bg-warn"}`} />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-navy">{ob?.title}</span>
              <span className="block text-xs text-muted">
                {done ? "Complete · Goldman's agent is live on the network" : `In progress · step ${ob!.current + 1} of ${ONBOARDING_STAGES.length}: ${ONBOARDING_STAGES[ob!.current].label}`}
              </span>
            </span>
            <span className="text-teal">→</span>
          </Link>
        )}
      </div>
    </div>
  );
}
