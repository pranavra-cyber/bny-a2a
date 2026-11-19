"use client";
// Workspace home. For the onboarding lead, a Teams message (a desktop notification,
// not part of Eliza) is the trigger and the "Onboard new agent" button in the
// sidebar is the entry point; for others it points to their work.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useProto } from "../proto/Proto";
import { onboardingDone, type Notice, Shell } from "./Shell";

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
  const { persona, toast } = useProto();
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      const d = onboardingDone();
      setDone(d);
      if (persona.id === "chen" && !d) toast({ key: "okafor", app: "teams", from: "Rachel Okafor · Relationship Manager", title: TRIGGER.title, body: TRIGGER.detail }, 900);
    }, 0);
    return () => clearTimeout(t);
  }, [persona.id, toast]);
  const first = persona.name.split(" ")[0];
  const onboarding = persona.id === "chen";
  return (
    <Shell title="Home" notices={onboarding ? [TRIGGER] : []} pulseOnboard={onboarding && !done}>
      <div className="mx-auto flex max-w-3xl flex-col px-6 py-10">
        <h2 className="text-3xl font-semibold tracking-tight text-navy">Good morning, {first}.</h2>
        <p className="mt-1 text-muted">What would you like to work on?</p>

        {onboarding ? (
          <div className="mt-8 space-y-6">
            {done ? (
              <div className="rounded-lg border border-ok/30 bg-ok-soft px-5 py-4">
                <p className="font-semibold text-ok">Goldman&apos;s agent is live on the network.</p>
                <p className="mt-1 text-sm text-ink">It can now ask BNY about failed trades, within the limits you set.</p>
                <Link href="/eliza/onboarding" className="mt-2 inline-block text-sm font-medium text-teal hover:underline">
                  Review the onboarding →
                </Link>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-line bg-white p-6 text-sm text-muted">
                <p>No agent onboardings in progress.</p>
                <p className="mt-1">To connect another firm&apos;s agent to BNY&apos;s network, use <span className="font-medium text-ink">Onboard new agent</span> at the bottom of the sidebar.</p>
              </div>
            )}
          </div>
        ) : (
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
        )}
      </div>
    </Shell>
  );
}
