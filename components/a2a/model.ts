// Turns a run's network view into the A2A interaction: numbered cross-firm
// messages with their gateway results, internal agent steps, and human decisions.
// Pure: safe for client components.
import type { GatewayCheck } from "@/lib/a2a/types";
import type { ResolvedRecord, RunEvent } from "@/lib/engine/types";

export type Kind = "cross" | "internal" | "human";

export type TraceItem = {
  key: string;
  kind: Kind;
  /** Cross-firm messages are numbered 1..n in order. */
  n?: number;
  at: string;
  side: "bny" | "goldman" | "network" | "client";
  title: string;
  text?: string;
  event: RunEvent;
  // cross-firm only
  dir?: "in" | "out";
  from?: string;
  to?: string;
  accepted?: boolean;
  fields?: Record<string, unknown>;
  withheld?: string[];
  checks?: GatewayCheck[];
  envelope?: unknown;
  basedOn?: ResolvedRecord[];
  why?: string;
  messageId?: string;
};

const partsData = (envelope: unknown): Record<string, unknown> => {
  const parts = (envelope as { params?: { message?: { parts?: { kind: string; data?: Record<string, unknown> }[] } } })?.params?.message?.parts ?? [];
  return Object.assign({}, ...parts.filter((p) => p.kind === "data").map((p) => p.data ?? {}));
};
const messageIdOf = (envelope: unknown) => (envelope as { id?: string })?.id;

const withheldOf = (checks: GatewayCheck[] = []) =>
  checks
    .filter((c) => (c.id === "disclosure" || c.id === "labels") && !c.ok)
    .flatMap((c) => c.detail.replace(/^(withheld|blocked): /, "").split(", "))
    .filter(Boolean);

export function buildTrace(events: RunEvent[]): TraceItem[] {
  const items: TraceItem[] = [];
  let n = 0;
  const used = new Set<number>();
  events.forEach((e, i) => {
    if (used.has(e.seq)) return;
    if (e.kind === "message" && e.flags?.includes("outbound")) {
      const gateway = events.slice(i + 1).find((x) => x.kind === "gateway");
      if (gateway) used.add(gateway.seq);
      const out = e.lane === "bny";
      // The step that led to this message, on the sender's side.
      const prior = [...events.slice(0, i)].reverse().find((x) => x.lane === e.lane && x.kind === "step" && x.actor.type === "AGENT");
      const priorRecords = [...events.slice(0, i)].reverse().find((x) => x.lane === e.lane && x.records?.length);
      items.push({
        key: `m${e.seq}`,
        kind: "cross",
        n: ++n,
        at: e.at,
        side: out ? "bny" : e.lane === "goldman" ? "goldman" : "network",
        dir: out ? "out" : "in",
        title: e.title.replace(/^(Sent to BNY: |To Goldman: )/, ""),
        text: e.detail,
        event: e,
        from: out ? e.actor.name : e.actor.name,
        to: out ? "GS Counterparty Outreach Agent" : "BNY Intake Gateway",
        accepted: out ? true : gateway?.flags?.includes("accepted"),
        fields: out ? partsData(gateway?.envelope) : partsData(e.envelope),
        withheld: out ? withheldOf(gateway?.checks) : [],
        checks: gateway?.checks,
        envelope: gateway?.envelope ?? e.envelope,
        basedOn: priorRecords?.records,
        why: prior?.detail,
        messageId: messageIdOf(gateway?.envelope ?? e.envelope),
      });
      return;
    }
    if (e.kind === "approval" || e.flags?.includes("manual")) {
      items.push({ key: `h${e.seq}`, kind: "human", at: e.at, side: e.actor.firm === "allianzgi" ? "client" : e.lane === "goldman" ? "goldman" : "bny", title: e.title, text: e.detail, event: e });
      return;
    }
    if (e.kind === "gateway" && !used.has(e.seq)) {
      items.push({ key: `g${e.seq}`, kind: "internal", at: e.at, side: "network", title: e.title, event: e, checks: e.checks });
      return;
    }
    // Agent and system steps (the receiving side's echo of a message is already in the trace).
    if ((e.kind === "step" || e.kind === "status" || e.kind === "escalation") && (e.lane === "bny" || e.lane === "goldman" || e.lane === "network")) {
      items.push({ key: `s${e.seq}`, kind: "internal", at: e.at, side: e.lane, title: e.title, text: e.detail, event: e });
    }
  });
  return items;
}

/** Milestones of the case across firms (from the operations flow). */
export type Milestone = { label: string; sub: string; who: "goldman" | "bny" | "client" | "exception"; human?: boolean; done: boolean };

export function milestones(events: RunEvent[], status: string): Milestone[] {
  const find = (p: (e: RunEvent) => boolean) => events.find(p);
  const t = (e?: RunEvent) => (e ? new Date(new Date(e.at).getTime() - 5 * 3600_000).toISOString().slice(11, 16) : "");
  const ask = find((e) => e.kind === "gateway" && !!e.flags?.includes("accepted"));
  const cause = find((e) => e.title.startsWith("Cause found"));
  const clientAsk = find((e) => e.kind === "approval" && e.decision?.kind === "bny-client-message");
  const fix = find((e) => e.kind === "message" && e.lane === "bny" && /fix expected/.test(e.title));
  const reinstruct = find((e) => e.title.startsWith("Client's corrected instruction received"));
  const redeliver = find((e) => e.kind === "approval" && e.decision?.kind === "gs-redelivery");
  const settled = find((e) => e.kind === "status" && e.title.includes("SETTLED"));
  return [
    { label: "Client amends", sub: "AllianzGI · 23:40 CET · 8,000 → 10,000, not sent to BNY", who: "client", done: true },
    { label: "DK at DTC", sub: "08:16 ET · quantity mismatch", who: "exception", done: true },
    { label: "GS agent asks", sub: ask ? `${t(ask)} ET · via the gateway` : "pending", who: "goldman", done: !!ask },
    { label: "BNY finds the cause", sub: cause ? `${t(cause)} ET · client's side differs` : "pending", who: "bny", done: !!cause },
    { label: "Client asked", sub: clientAsk ? `${t(clientAsk)} ET · ${clientAsk.decision!.by}` : "pending · BNY Client Service", who: "bny", human: true, done: clientAsk?.decision?.outcome === "approved" },
    { label: "GS told the fix time", sub: fix ? `${t(fix)} ET · automatic` : "pending", who: "bny", done: !!fix },
    { label: "Client re-instructs", sub: reinstruct ? `${t(reinstruct)} ET · SWIFT MT541` : "pending · AllianzGI", who: "client", done: !!reinstruct },
    { label: "GS redelivers", sub: redeliver ? `${t(redeliver)} ET · ${redeliver.decision!.by}` : "pending · GS Ops", who: "goldman", human: true, done: redeliver?.decision?.outcome === "approved" },
    { label: "Settled", sub: settled ? `${t(settled)} ET · case closed` : status.startsWith("settled") ? "settled" : "pending", who: "bny", done: !!settled },
  ];
}
