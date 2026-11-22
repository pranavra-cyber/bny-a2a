// Builds the Supervision log: the scripted narration of BNY's reasoning, with the real
// events spliced in around it (the inquiry as it arrived, the gateway's inbound checks, and at a
// compose step the gateway's real outbound checks, shared and withheld fields, and what Goldman
// received). Each item says whether it is real or narration. Pure: safe for client components.
import type { GatewayCheck } from "@/lib/a2a/types";
import { type Phase, resolveStep, supervisionFor } from "@/lib/engine/supervision";
import type { RunEvent, Scenario } from "@/lib/engine/types";

export type LogLane = "goldman" | "gateway" | "orchestrator" | "tools";

export const LANES: { id: LogLane; label: string }[] = [
  { id: "goldman", label: "Goldman agent" },
  { id: "gateway", label: "BNY gateway" },
  { id: "orchestrator", label: "BNY orchestrator" },
  { id: "tools", label: "Tools and sub-agents" },
];

/** Where each kind of reasoning step shows: thinking, merging and replying are the orchestrator's; lookups and hand-offs go to tools and sub-agents. */
const LANE_OF_PHASE: Record<Phase, LogLane> = { think: "orchestrator", retrieve: "tools", merge: "orchestrator", handoff: "tools", compose: "orchestrator" };

export type LogItem = {
  key: string;
  lane: LogLane;
  /** "narration" is scripted text; "run" is read from the run's actual events. */
  source: "narration" | "run";
  phase?: Phase;
  title: string;
  text?: string;
  /** Gateway items: the checks as the real gateway returned them. */
  checks?: GatewayCheck[];
  /** Fields that crossed the boundary, and what the real outbound filter withheld. */
  shared?: string[];
  withheld?: string[];
  /** False until the run has reached this point. */
  ready: boolean;
};

const partsData = (envelope: unknown): Record<string, unknown> => {
  const parts = (envelope as { params?: { message?: { parts?: { kind: string; data?: Record<string, unknown> }[] } } })?.params?.message?.parts ?? [];
  return Object.assign({}, ...parts.filter((p) => p.kind === "data").map((p) => p.data ?? {}));
};

const after = (events: RunEvent[], from: RunEvent | undefined, pred: (e: RunEvent) => boolean) => (from ? events.slice(events.indexOf(from) + 1).find(pred) : undefined);

export function buildSupervisionLog(scenario: Scenario, events: RunEvent[]): { items: LogItem[]; available: number } | null {
  const script = supervisionFor(scenario);
  if (!script) return null;
  const items: LogItem[] = [];

  // The inquiry as Goldman's agent sent it, and the gateway's real inbound result.
  const sent = events.find((e) => e.kind === "message" && e.lane === "goldman" && !!e.flags?.includes("outbound"));
  const gateIn = after(events, sent, (e) => e.kind === "gateway");
  items.push({
    key: "in-sent",
    lane: "goldman",
    source: "run",
    title: sent ? sent.title.replace(/^Sent to BNY: /, "Sends ") : "Sends the inquiry",
    text: sent?.detail,
    shared: Object.keys(partsData(sent?.envelope)),
    ready: !!sent,
  });
  items.push({ key: "in-gate", lane: "gateway", source: "run", title: gateIn?.title ?? "Checks the inquiry", checks: gateIn?.checks, ready: !!gateIn });

  script.forEach((step, i) => {
    const r = resolveStep(step, events);
    items.push({ key: `n${i}`, lane: LANE_OF_PHASE[step.phase], source: "narration", phase: step.phase, title: step.phase, text: r.text, ready: r.ready });
    if (step.phase !== "compose") return;
    // The real outbound result for this reply, then what Goldman's agent received.
    const gate = after(events, r.event, (e) => e.kind === "gateway");
    items.push({ key: `n${i}-out`, lane: "gateway", source: "run", title: gate?.title ?? "Outbound filter", checks: gate?.checks, shared: r.shared, withheld: r.withheld, ready: r.ready });
    const got = after(events, gate, (e) => e.kind === "message" && e.lane === "goldman");
    items.push({ key: `n${i}-got`, lane: "goldman", source: "run", title: got ? `Receives ${got.title.replace(/^BNY: /, "")}` : "Receives the reply", text: got?.detail, ready: !!got });
  });

  // Reveal only up to the first point the run hasn't reached.
  const firstPending = items.findIndex((x) => !x.ready);
  return { items, available: firstPending === -1 ? items.length : firstPending };
}
