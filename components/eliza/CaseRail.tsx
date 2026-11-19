"use client";
// The case dashboard's right side: the two agents talking, the case record, and
// summaries of safety and analytics that open the deeper views.
import Link from "next/link";
import type { Seat } from "@/lib/engine/guide";
import { ballText, statusText, statusTone } from "@/lib/engine/status";
import type { RunEvent, RunSummary } from "@/lib/engine/types";
import { fmtDuration, fmtEt, fmtUtc } from "@/lib/time";
import { useState } from "react";
import { Pill } from "../ui";
import { AgentCardOverlay } from "./AgentCardOverlay";

function Card({ title, href, cta, children }: { title: string; href?: string; cta?: string; children: React.ReactNode }) {
  const body = (
    <>
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
        {href && <span className="text-xs font-medium text-teal group-hover:underline">{cta ?? "Open"} →</span>}
      </header>
      <div className="mt-3">{children}</div>
    </>
  );
  return href ? (
    <Link href={href} className="group block rounded-lg border border-line bg-white p-4 transition hover:border-teal">
      {body}
    </Link>
  ) : (
    <section className="rounded-lg border border-line bg-white p-4">{body}</section>
  );
}

function AgentCard({ id, firm, name, line, verified }: { id: string; firm: "BNY" | "Goldman Sachs"; name: string; line: string; verified: boolean }) {
  const gs = firm === "Goldman Sachs";
  const [open, setOpen] = useState(false);
  return (
    <>
    {open && <AgentCardOverlay agentId={id} onClose={() => setOpen(false)} />}
    <button onClick={() => setOpen(true)} title="Show the full Agent Card" className="min-w-0 flex-1 rounded-md bg-canvas p-3 text-left ring-teal transition hover:ring-1">
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold text-white ${gs ? "bg-gs-dark font-serif" : "bg-gradient-to-br from-teal to-navy"}`}>{gs ? "GS" : "BNY"}</span>
        <span className="truncate text-[11px] font-medium text-muted">{firm}</span>
      </div>
      <p className="mt-2 text-sm leading-snug font-semibold text-navy">{name}</p>
      <p className="mt-0.5 text-xs text-muted">{line}</p>
      {verified && <p className="mt-2 text-[11px] font-medium text-ok">✓ Signed card, verified</p>}
      <p className="mt-1 text-[11px] font-medium text-teal">View card →</p>
    </button>
    </>
  );
}

const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-3 py-1.5">
    <dt className="shrink-0 text-xs text-muted">{k}</dt>
    <dd className="min-w-0 text-right text-sm text-ink">{children}</dd>
  </div>
);

export function CaseRail({ seat, summary: s, events }: { seat: Seat; summary: RunSummary | null; events: RunEvent[] }) {
  const gs = seat === "goldman";
  const tz = gs ? fmtUtc : fmtEt;
  const toBny = events.filter((e) => e.kind === "message" && e.flags?.includes("outbound") && e.lane === "goldman").length;
  const fromBny = events.filter((e) => e.kind === "message" && e.shared?.from === "BNY").length;
  const crossFirm = gs ? toBny + fromBny : events.filter((e) => e.kind === "gateway").length;
  const corrected = events.some((e) => e.title.startsWith("Client's corrected instruction received"));
  const gateways = events.filter((e) => e.kind === "gateway");
  const checks = gateways.flatMap((e) => e.checks ?? []);
  const blocked = gateways.filter((e) => e.flags?.includes("rejected") || e.flags?.includes("blocked") || e.flags?.includes("withheld")).length + events.filter((e) => e.flags?.includes("injection-blocked")).length;
  const approvals = events.filter((e) => e.kind === "approval");
  const sharedOut = new Set(events.filter((e) => e.kind === "gateway" && e.title.startsWith("Outbound")).flatMap((e) => (e.checks?.find((c) => c.id === "fields")?.detail ?? "").split(", ").filter((x) => x && x !== "none")));
  const sentAt = events.find((e) => e.title.startsWith("Email sent to Emily Carter"))?.at;
  const replyAt = events.find((e) => e.title.startsWith("Email from Emily Carter"))?.at;
  const waitedMs = sentAt && replyAt ? new Date(replyAt).getTime() - new Date(sentAt).getTime() : sentAt && s ? new Date(s.clock).getTime() - new Date(sentAt).getTime() : 0;
  const elapsed = s ? new Date(s.clock).getTime() - new Date(s.scenarioStart).getTime() : 0;
  const toCutoff = s ? new Date(s.cutoff).getTime() - new Date(s.clock).getTime() : 0;

  return (
    <div className="space-y-4">
      <Card title="A2A connection">
        <div className="flex items-stretch gap-2">
          {gs ? (
            <>
              <AgentCard id="gs-outreach" firm="Goldman Sachs" name="GS Counterparty Outreach Agent" line="Ours: contacts the custodian" verified={false} />
              <Arrows n={crossFirm} />
              <AgentCard id="bny-gateway" firm="BNY" name="BNY Intake Gateway" line="Their entry point" verified={toBny > 0} />
            </>
          ) : (
            <>
              <AgentCard id="bny-settlement-agent" firm="BNY" name="BNY Settlement Ops Agent" line="Ours: behind the gateway" verified={false} />
              <Arrows n={crossFirm} />
              <AgentCard id="gs-outreach" firm="Goldman Sachs" name="GS Counterparty Outreach Agent" line="Registered counterparty agent" verified={crossFirm > 0} />
            </>
          )}
        </div>
      </Card>

      <Card title="Case record">
        <dl className="divide-y divide-line/70">
          {gs ? (
            <>
              <Row k="Fail">GS-FAIL-20261119-0091</Row>
              <Row k="Delivery">DTC-DO-20261119-000318</Row>
              <Row k="Security">NVDA · 10,000</Row>
              <Row k="Receiver">BNY (DTC 0901)</Row>
              <Row k="Our confirm">CTM affirmed at 10,000</Row>
              <Row k="Exposure">$1,862,600</Row>
            </>
          ) : (
            <>
              <Row k="Exception">EXC-20261119-0907</Row>
              <Row k="Client">AllianzGI Global Equity · tier 1</Row>
              <Row k="Security">NVDA · US67066G1040</Row>
              <Row k="Client instruction">{corrected ? "10,000 (corrected)" : "8,000"}</Row>
              <Row k="Goldman delivered">10,000</Row>
              <Row k="Value">$1,862,600</Row>
            </>
          )}
          <Row k="Status">{s ? <Pill tone={statusTone(s)}>{statusText(s)}</Pill> : "…"}</Row>
          <Row k="With">{s ? ballText(s).replace(/^With /, "") : "…"}</Row>
          <Row k="Clock">{s ? tz(s.clock) : "…"}</Row>
          <Row k="Client cutoff">{s ? (toCutoff > 0 ? `11:30 ET · ${fmtDuration(toCutoff)} left` : "11:30 ET · passed") : "11:30 ET"}</Row>
        </dl>
      </Card>

      <Card title="Safety and audit" href="/eliza/audit" cta="Audit view">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat n={gs ? toBny + fromBny : checks.filter((c) => c.ok).length} label={gs ? "messages" : "checks passed"} />
          <Stat n={gs ? approvals.length : blocked} label={gs ? "approvals" : "blocked or withheld"} tone={!gs && blocked ? "warn" : undefined} />
          <Stat n={gs ? 0 : sharedOut.size} label={gs ? "client fields seen" : "fields sent out"} />
        </div>
        <p className="mt-3 text-xs text-muted">
          {gs ? "BNY's gateway checks our identity and signature on every message." : "Usage terms on every outbound message: this case only, 30 days, no model training."}
        </p>
      </Card>

      <Card title="Analytics" href="/eliza/analytics" cta="Analytics">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat n={fmtDuration(elapsed)} label="since 09:02 ET" />
          <Stat n={waitedMs ? fmtDuration(waitedMs) : "–"} label="waiting on client" tone={waitedMs > 30 * 60000 ? "warn" : undefined} />
          <Stat n={s ? `$${s.budget.spentUsd.toFixed(3)}` : "–"} label="model cost" />
        </div>
        <p className="mt-3 text-xs text-muted">Manual baseline for this case: settled about 13:40 ET.</p>
      </Card>

      <Link href="/eliza/a2a" className="flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-3 text-sm font-semibold text-white hover:bg-teal">
        Examine A2A interaction <span aria-hidden>→</span>
      </Link>
    </div>
  );
}

function Arrows({ n }: { n: number }) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center px-1 text-muted" title={`${n} cross-firm messages`}>
      <span aria-hidden className="text-lg leading-none">⇄</span>
      <span className="mt-1 text-[10px] tabular">{n}</span>
    </div>
  );
}

function Stat({ n, label, tone }: { n: number | string; label: string; tone?: "warn" }) {
  return (
    <div className="rounded-md bg-canvas px-2 py-2">
      <div className={`text-lg font-semibold tabular ${tone === "warn" ? "text-warn" : "text-navy"}`}>{n}</div>
      <div className="text-[11px] leading-tight text-muted">{label}</div>
    </div>
  );
}
