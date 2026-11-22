"use client";
// "The A2A journey": one scrolling page that explains how A2A plays out when BNY connects to the
// outside world: the setup nobody sees, the connection and where trust sits, a live case as an A2A
// task, what goes wrong, and what the protocol gives BNY versus what BNY must build. Dark prototype
// look, like the Secured stage.
import Link from "next/link";
import { useEffect, useState } from "react";
import type { DrillRun } from "@/lib/drillCatalog";
import { SECTIONS } from "@/lib/journey";
import { PersonaDock } from "../proto/PersonaDock";
import { CaseTask } from "./CaseTask";
import { Controls } from "./Controls";
import { Drills } from "./Drills";
import { Lifecycle } from "./Lifecycle";
import { SectionHead } from "./parts";
import { TrustMap } from "./TrustMap";

const LEADS: Record<(typeof SECTIONS)[number]["id"], string> = {
  lifecycle: "The first message is the last step of a long process. Most of the work is agreements, verification and key exchange, owned by people outside operations. Click any step.",
  map: "Four zones, and a hop-by-hop path through them. Trust is established before the request arrives and re-checked on every message; nothing inside BNY takes a counterparty's word for anything.",
  case: "The prototype's case follows one A2A task through its states. The shape to notice: agents work for minutes, then the task waits on people for hours, because the client sits outside the network.",
  drills: "A clean run teaches little. These are the ordinary failures a live connection will see, each run through BNY's real gateway where the prototype can.",
  controls: "A2A standardises how agents talk. It does not decide who may join, what may be shared or how a firm is cut off; those are BNY's design and BNY's to own. Every control below is sorted that way.",
};

export function Journey({ drills }: { drills: DrillRun[] }) {
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: "-20% 0px -70% 0px" });
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, []);

  return (
    <div className="proto min-h-svh bg-[#0b0d12] font-sans text-[#d7dde8]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b0d12]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-2.5">
          <span className="font-mono text-sm font-semibold tracking-wide text-[#3fbf7f]">journey</span>
          <nav aria-label="Sections" className="flex flex-1 gap-1 overflow-x-auto">
            {SECTIONS.map((s, i) => (
              <a key={s.id} href={`#${s.id}`} aria-current={active === s.id ? "true" : undefined} className={`shrink-0 rounded-md px-2.5 py-1 text-sm transition ${active === s.id ? "bg-white/12 font-semibold text-white" : "text-white/55 hover:text-white/85"}`}>
                <span className="mr-1.5 font-mono text-xs text-white/35">{i + 1}</span>
                {s.label}
              </a>
            ))}
          </nav>
          <Link href="/" className="text-xs text-white/50 hover:text-white/80">
            Prototype overview
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-32">
        <section className="pt-14">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-[#8fd3c7] uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3fbf7f]" /> How A2A plays out in the real world
          </p>
          <h1 className="mt-5 max-w-4xl text-5xl leading-[1.05] font-semibold tracking-tight text-white sm:text-6xl">
            From the first agreement to the audit trail: connecting BNY to the outside world.
          </h1>
          <p className="mt-5 max-w-3xl text-xl leading-relaxed text-white/70">
            The settlement-fail case is one request. This page shows everything around it: the setup that makes it possible, how trust is checked, how a case behaves as an A2A task, what goes wrong, and what BNY has to
            build.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href="#lifecycle" className="rounded-md bg-[#3fbf7f] px-6 py-3 text-base font-semibold text-[#06140d] transition hover:bg-white">
              Start the journey ↓
            </a>
            <Link href="/secured" className="rounded-md bg-white/10 px-5 py-3 text-base font-medium text-white hover:bg-white/20">
              Watch the connection as a chat
            </Link>
            <Link href="/attack" className="rounded-md bg-white/10 px-5 py-3 text-base font-medium text-white hover:bg-white/20">
              Try to break in
            </Link>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ["Real", "BNY's gateway, registry, filter, suspension and audit run as code, on synthetic data.", "#3fbf7f"],
              ["Simulated", "mTLS, message signatures, nonces and JWT signing show the experience; no real cryptography runs.", "#f0c674"],
              ["Not built", "The agreement, sandbox tests, rate limiting and push updates are described, not built.", "#7b8494"],
            ].map(([k, v, c]) => (
              <div key={k} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold" style={{ color: c }}>
                  {k}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-white/65">{v}</p>
              </div>
            ))}
          </div>
        </section>

        <SectionHead n={1} id="lifecycle" label={SECTIONS[0].label} title={SECTIONS[0].title}>
          {LEADS.lifecycle}
        </SectionHead>
        <Lifecycle />

        <SectionHead n={2} id="map" label={SECTIONS[1].label} title={SECTIONS[1].title}>
          {LEADS.map}
        </SectionHead>
        <TrustMap />

        <SectionHead n={3} id="case" label={SECTIONS[2].label} title={SECTIONS[2].title}>
          {LEADS.case}
        </SectionHead>
        <CaseTask />

        <SectionHead n={4} id="drills" label={SECTIONS[3].label} title={SECTIONS[3].title}>
          {LEADS.drills}
        </SectionHead>
        <Drills runs={drills} />

        <SectionHead n={5} id="controls" label={SECTIONS[4].label} title={SECTIONS[4].title}>
          {LEADS.controls}
        </SectionHead>
        <Controls />

        <p className="mt-16 text-xs text-white/40">All firms, people and data in the prototype are synthetic. Task states are those of the A2A protocol; the case timeline is the prototype&apos;s recorded run.</p>
      </main>
      <PersonaDock />
    </div>
  );
}
