// The front page: two diagrams that explain how A2A plays out with the outside world, then a way
// into the prototype (the people and their workspaces). Same navy and teal as the prototype.
import Link from "next/link";
import { InsideDiagram, OutsideDiagram } from "./Diagrams";

const Section = ({ n, label, title, lead, children }: { n: number; label: string; title: string; lead: string; children: React.ReactNode }) => (
  <section className="mt-14">
    <h2 className="flex items-center gap-3 text-xs font-semibold tracking-[0.14em] text-white/60 uppercase">
      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-teal text-[11px] text-teal">{n}</span>
      {label}
    </h2>
    <p className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-white">{title}</p>
    <p className="mt-2 max-w-3xl text-base leading-relaxed text-white/70">{lead}</p>
    <div className="mt-5 rounded-xl bg-white/[0.045] p-4 ring-1 ring-white/10 sm:p-6">{children}</div>
  </section>
);

export function Landing() {
  return (
    <div className="proto min-h-svh bg-navy text-white">
      <div className="mx-auto max-w-7xl px-6 pt-8 pb-16 lg:px-10">
        <header className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-teal-soft uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-teal" /> Prototype · how A2A plays out in the real world
          </p>
          <Link
            href="/prototype"
            className="ml-auto inline-flex items-center gap-2 rounded-md bg-teal px-6 py-2.5 text-base font-semibold text-white shadow-lg transition-colors hover:bg-white hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Open the prototype <span aria-hidden>→</span>
          </Link>
        </header>

        <h1 className="mt-8 max-w-4xl text-5xl font-semibold tracking-tight">Eliza A2A Prototype</h1>
        <p className="mt-3 max-w-3xl text-xl text-white/85">How BNY&apos;s Eliza agents can work with agents at other firms: who is let in, and what happens next, with people approving every step that matters.</p>

        <Section n={1} label="Connecting to the outside world" title="Before any request is answered, BNY establishes who is asking and what they may ask." lead="Goldman's agent is outside BNY. It discovers BNY's Agent Card, gets a token, and opens a secure connection; BNY's gateway then checks it against the registry that onboarding built.">
          <OutsideDiagram />
        </Section>

        <Section n={2} label="Inside BNY, once trust is established" title="Inside, BNY's agents read BNY's own systems, and people approve what matters." lead="The orchestrator hands the case to agents. Reading is automatic; sending to the client, releasing an instruction and making an exception wait for a named person. Everything is logged.">
          <InsideDiagram />
        </Section>

        <div className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border-l-4 border-teal bg-white/[0.06] px-6 py-5">
          <p className="min-w-0 flex-1 text-lg leading-relaxed text-white/90">
            Now see it happen: step into each person&apos;s Eliza workspace, from Goldman&apos;s DK alert to the settled trade.
            <span className="mt-1 block text-sm text-white/60">About 8 minutes · synthetic data · no setup needed</span>
          </p>
          <Link
            href="/prototype"
            className="inline-flex items-center gap-2 rounded-md bg-teal px-8 py-3.5 text-lg font-semibold text-white shadow-lg transition-colors hover:bg-white hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Open the prototype <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
