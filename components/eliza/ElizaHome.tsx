"use client";
// Workspace home. For the onboarding lead, a Teams message is the trigger and the
// "Onboard new agent" button is the entry point; for others it points to their work.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useProto } from "../proto/Proto";
import { onboardingDone, type Notice, Shell } from "./Shell";
import { TeamsCard } from "./TeamsCard";

const TRIGGER: Notice = {
  id: "okafor",
  from: "Rachel Okafor · Relationship Manager, BNY",
  channel: "teams",
  at: "08:47 ET",
  title: "Can you onboard Goldman's fails agent this morning?",
  detail:
    "Goldman Sachs has applied to connect its fails agent to our network, so their desk and our Settlement Ops can sort out failed trades agent to agent. They already have a rejected NVDA delivery with us today. Could you take them through onboarding?",
};

export function ElizaHome() {
  const { persona } = useProto();
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(onboardingDone()), 0);
    return () => clearTimeout(t);
  }, []);
  const first = persona.name.split(" ")[0];
  const onboarding = persona.id === "chen";
  return (
    <Shell title="Home" notices={onboarding ? [TRIGGER] : []} pulseOnboard={onboarding && !done}>
      <div className="mx-auto flex max-w-3xl flex-col px-6 py-10">
        <h2 className="text-3xl font-semibold tracking-tight text-navy">Good morning, {first}.</h2>
        <p className="mt-1 text-muted">What would you like to work on?</p>

        {onboarding ? (
          <div className="mt-8 space-y-6">
            <TeamsCard n={TRIGGER} />
            {done ? (
              <div className="rounded-lg border border-ok/30 bg-ok-soft px-5 py-4">
                <p className="font-semibold text-ok">Goldman&apos;s agent is live on the network.</p>
                <p className="mt-1 text-sm text-ink">It can now ask BNY about failed trades, within the limits you set.</p>
                <Link href="/eliza/onboarding" className="mt-2 inline-block text-sm font-medium text-teal hover:underline">
                  Review the onboarding →
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3 rounded-lg border border-line bg-white p-6">
                <p className="text-sm text-ink">Start from the Network Onboarding Assistant. It walks through each security layer and records every check.</p>
                <Link href="/eliza/onboarding" className="halo inline-flex items-center gap-2 rounded-md bg-navy px-6 py-3 text-base font-semibold text-white hover:bg-teal">
                  <span aria-hidden>＋</span> Onboard new agent
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link href={persona.home} className="rounded-lg border border-line bg-white p-4 hover:border-teal">
              <p className="text-sm font-semibold text-navy">{persona.task}</p>
              <p className="mt-1 text-sm text-ink">{persona.taskLine}</p>
            </Link>
            <Link href="/eliza/audit" className="rounded-lg border border-line bg-white p-4 hover:border-teal">
              <p className="text-sm font-semibold text-navy">Safety and audit</p>
              <p className="mt-1 text-sm text-ink">Every step, message and approval, and the controls that guard them.</p>
            </Link>
          </div>
        )}
      </div>
    </Shell>
  );
}
