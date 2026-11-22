"use client";
// Prototype overview: sets the scene and the cast before the prototype starts.
// Its dark look marks it as part of the prototype, not the product.
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DISCLAIMER } from "@/lib/constants";
import { CLIENT, type Persona, PERSONAS } from "@/lib/personas";
import { useProto } from "./Proto";

const by = (section: Persona["section"]) => PERSONAS.filter((p) => p.section === section);

function PersonCard({ p, n, note }: { p: Persona; n?: string; note?: string }) {
  const { setPersona } = useProto();
  return (
    <button
      onClick={() => setPersona(p.id)}
      className="group flex w-full items-start gap-3 rounded-lg bg-white/[0.06] p-3 text-left ring-1 ring-white/10 transition hover:bg-white/[0.12] hover:ring-teal short:py-2"
    >
      <Image src={p.photo} alt={`Illustrated portrait of ${p.name}`} width={48} height={48} className="h-12 w-12 shrink-0 rounded-full short:h-10 short:w-10" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          {n && <span className="text-xs font-semibold text-teal">{n}</span>}
          <span className="font-semibold text-white">{p.name}</span>
          <span className="text-xs text-white/60">
            {p.role} · {p.firm}
          </span>
        </span>
        <span className="mt-1 block text-sm font-semibold text-teal-soft">{p.task}</span>
        <span className="block text-sm leading-snug text-white/75 short:text-[13px]">{p.taskLine}</span>
        {note && <span className="mt-1 block text-xs text-warn-soft short:hidden">{note}</span>}
      </span>
      <span aria-hidden className="self-center text-lg text-white/30 transition group-hover:text-teal">
        →
      </span>
    </button>
  );
}

export function Overview() {
  const router = useRouter();
  const { setPersona } = useProto();
  const live = by("Live A2A case");
  return (
    <div className="proto min-h-svh bg-navy text-white">
      <div className="mx-auto grid min-h-svh max-w-7xl items-center gap-10 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:px-10 short:py-5">
        <section>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-teal-soft uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-teal" /> Prototype overview · setting the scene
          </p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight short:text-4xl">Eliza A2A Prototype</h1>
          <p className="mt-3 text-xl text-white/85 short:text-lg">How BNY&apos;s Eliza agents and Goldman Sachs&apos; agents could resolve a failed trade together, with people approving every step that matters.</p>
          <div className="mt-6 rounded-lg border-l-4 border-teal bg-white/[0.06] px-5 py-4 text-lg leading-relaxed text-white/90 short:mt-4 short:py-3 short:text-base">
            <p className="text-xs font-semibold tracking-wide text-teal uppercase">The scenario · 19 Nov 2026, 09:02 ET</p>
            <p className="mt-1.5">
              AllianzGI, a BNY client, bought 10,000 NVDA from Goldman Sachs. Overnight AllianzGI raised the trade from 8,000, but its corrected instruction never reached BNY. Goldman
              delivered 10,000, and BNY&apos;s system rejected it. Only AllianzGI can fix its instruction, and it must do so by 11:30 ET.
            </p>
          </div>
          <p className="mt-4 text-base text-white/70 short:mt-3 short:text-sm">
            This page sets the stage; it isn&apos;t part of the product. In the prototype you step into each person&apos;s Eliza workspace, in order, and switch people from the
            Prototype button in the bottom-right corner.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 short:mt-4">
            <button
              onClick={() => {
                setPersona("chen", false);
                router.push("/eliza");
              }}
              className="inline-flex items-center gap-2 rounded-md bg-teal px-8 py-3.5 text-lg font-semibold text-white shadow-lg transition-colors hover:bg-white hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Start prototype <span aria-hidden>→</span>
            </button>
            <span className="text-sm text-white/60">About 8 minutes · synthetic data · no setup needed</span>
          </div>
        </section>

        <section aria-label="Who you'll be" className="space-y-4 short:space-y-2">
          <div>
            <h2 className="text-xs font-semibold tracking-[0.14em] text-white/60 uppercase">1 · Onboarding</h2>
            <div className="mt-2">{by("Onboarding").map((p) => <PersonCard key={p.id} p={p} />)}</div>
          </div>
          <div>
            <h2 className="text-xs font-semibold tracking-[0.14em] text-white/60 uppercase">2 · Live A2A case: three people, two firms</h2>
            <p className="mt-1 text-xs text-white/60 short:hidden">It starts at Goldman Sachs, then moves to BNY. Each person works it in their own assistant.</p>
            <ol className="mt-2 space-y-2 short:space-y-1.5">
              {live.map((p, i) => (
                <li key={p.id}>
                  <PersonCard p={p} n={`${String.fromCharCode(97 + i)}`} note={i === 0 ? "The case starts here, at Goldman Sachs." : undefined} />
                </li>
              ))}
            </ol>
            <div className="mt-2 flex items-center gap-3 rounded-lg border border-dashed border-white/20 px-3 py-2">
              <Image src={CLIENT.photo} alt="" width={32} height={32} className="h-8 w-8 rounded-full opacity-80" />
              <p className="text-xs text-white/70">
                <span className="font-semibold text-white">{CLIENT.name}</span>, {CLIENT.role} at {CLIENT.firm}: the client. Outside the network, so reached only by email. That&apos;s where time is lost.
              </p>
            </div>
          </div>
          <div>
            <h2 className="text-xs font-semibold tracking-[0.14em] text-white/60 uppercase">3 · Oversight</h2>
            <div className="mt-2">{by("Oversight").map((p) => <PersonCard key={p.id} p={p} />)}</div>
          </div>
          <div>
            <h2 className="text-xs font-semibold tracking-[0.14em] text-white/60 uppercase">4 · Security tests: try to break in</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {by("Security tests").map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPersona(p.id)}
                  className="group flex items-center gap-3 rounded-lg bg-[#e0484c]/[0.08] p-2.5 text-left ring-1 ring-[#e0484c]/25 transition hover:bg-[#e0484c]/[0.16] hover:ring-[#e0484c]/60"
                >
                  <Image src={p.photo} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">{p.name}</span>
                    <span className="block truncate text-xs text-white/60">{p.task}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <Link href="/secured" className="group flex items-center gap-3 rounded-lg bg-[#3fbf7f]/[0.08] p-2.5 text-left ring-1 ring-[#3fbf7f]/25 transition hover:bg-[#3fbf7f]/[0.16] hover:ring-[#3fbf7f]/60">
            <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#3fbf7f]/20 text-[#3fbf7f]">
              ✓
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-white">Secured: how a legitimate connection is made safe</span>
              <span className="block text-xs text-white/60">Watch Goldman discover, authenticate and cross BNY&apos;s gateway, step by step, as a conversation.</span>
            </span>
          </Link>
          <p className="text-[11px] text-white/40 short:hidden">{DISCLAIMER}</p>
        </section>
      </div>
    </div>
  );
}
