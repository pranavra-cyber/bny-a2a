// The two diagrams on the front page. One: connecting to the outside world, i.e. how trust is
// established before any request is answered. Two: what happens inside BNY once it is: the
// orchestrator, the agents, the tools and databases they use, and which actions wait for a person.
// Geometry is in SVG units. Text and data only: safe for client components.

export type Box = { x: number; y: number; w: number; h: number };

// ---------------------------------------------------------------------------------------------
// 1. Connecting to the outside world

export type OutNode = Box & { id: string; title: string; sub: string; side: "goldman" | "bny"; /** Simulated in the prototype. */ dashed?: boolean };
export const OUT_ZONES: (Box & { id: string; label: string; tone: "goldman" | "net" | "bny" })[] = [
  { id: "counterparty", label: "Counterparty (Goldman Sachs)", x: 15, y: 30, w: 200, h: 380, tone: "goldman" },
  { id: "internet", label: "Public internet", x: 215, y: 30, w: 115, h: 380, tone: "net" },
  { id: "edge", label: "BNY edge", x: 330, y: 30, w: 375, h: 380, tone: "bny" },
  { id: "internal", label: "BNY internal", x: 715, y: 30, w: 270, h: 380, tone: "bny" },
];
export const OUT_NODES: OutNode[] = [
  { id: "gs", title: "Goldman's agent", sub: "outside BNY, any A2A agent", x: 30, y: 150, w: 170, h: 100, side: "goldman" },
  { id: "card", title: "Agent Card", sub: "BNY's public profile", x: 350, y: 50, w: 130, h: 70, side: "bny" },
  { id: "mtls", title: "mTLS edge", sub: "encrypted, identified", x: 350, y: 190, w: 130, h: 90, side: "bny", dashed: true },
  { id: "token", title: "Token service", sub: "OAuth, scoped token", x: 350, y: 330, w: 130, h: 70, side: "bny" },
  { id: "gate", title: "Intake Gateway", sub: "six checks, no model", x: 540, y: 190, w: 140, h: 90, side: "bny" },
  { id: "registry", title: "Registry", sub: "who may ask what", x: 540, y: 330, w: 140, h: 70, side: "bny" },
  { id: "inside", title: "BNY's agents", sub: "cleaned request goes inward", x: 745, y: 190, w: 210, h: 90, side: "bny" },
];

export type Hop = { n?: number; path: [number, number][]; caption?: string };
export const OUT_HOPS: Hop[] = [
  { n: 1, caption: "Goldman's agent reads BNY's Agent Card", path: [[200, 165], [275, 165], [275, 85], [350, 85]] },
  { n: 2, caption: "It gets a token limited to the skills BNY approved", path: [[200, 235], [275, 235], [275, 365], [350, 365]] },
  { n: 3, caption: "It opens a mutual-TLS connection", path: [[200, 205], [350, 205]] },
  { n: 4, caption: "It sends the signed request", path: [[480, 235], [540, 235]] },
  { n: 5, caption: "The gateway asks the registry who this is", path: [[610, 280], [610, 330]] },
  { n: 6, caption: "Admitted: only the cleaned request goes inward", path: [[680, 235], [745, 235]] },
  { path: [[540, 365], [480, 365]] },
  { path: [[610, 446], [610, 400]] },
];

/** Done once per counterparty, before any message. */
export const ONBOARDING = ["Agreement", "KYC & LEI", "Domain attested", "Keys exchanged", "Skills approved", "Go live"];
export const ONBOARDING_BAND: Box = { x: 330, y: 418, w: 655, h: 82 };
export const ONBOARDING_CHIPS: Box[] = ONBOARDING.map((_, i) => ({ x: 342 + i * 106, y: 452, w: 96, h: 34 }));

// ---------------------------------------------------------------------------------------------
// 2. Inside BNY: the same map as the first, with the BNY internal zone opened up

export type Item = {
  title: string;
  sub: string;
  /** read: the agent reads it on its own. person: a named person approves first. addable: could be connected next. */
  kind: "read" | "person" | "addable";
  /** Tables or documents in the prototype's data this reads. */
  sources?: string[];
};
export type Group = { id: string; agentId?: string; title: string[]; sub: string; state: "built" | "addable"; items: Item[] };

export const INSIDE: Group[] = [
  {
    id: "ops",
    agentId: "bny-settlement-agent",
    title: ["Settlement", "Ops Agent"],
    sub: "finds the cause",
    state: "built",
    items: [
      { kind: "read", title: "Settlement instructions", sub: "what BNY expects to receive", sources: ["bny/settlement_instructions"] },
      { kind: "read", title: "DTC activity feed", sub: "what the depository shows", sources: ["dtc/settlement_activity"] },
      { kind: "read", title: "Fails & exceptions log", sub: "open fails and deadlines", sources: ["bny/fails_exceptions"] },
      { kind: "read", title: "Procedures & SSI data", sub: "runbooks, counterparty details", sources: ["docs/settlement_operations_procedures.md", "bny/ssi_counterparties"] },
    ],
  },
  {
    id: "client",
    agentId: "bny-client-team",
    title: ["Client Team", "Agent"],
    sub: "drafts for the client",
    state: "built",
    items: [
      { kind: "read", title: "Client accounts", sub: "terms and contacts", sources: ["bny/client_accounts"] },
      { kind: "person", title: "Client email", sub: "Daniel Kim approves each one" },
    ],
  },
  {
    id: "system",
    agentId: "bny-settlement-system",
    title: ["Settlement", "system"],
    sub: "no model, releases to DTC",
    state: "built",
    items: [
      { kind: "person", title: "Release to DTC", sub: "an analyst approves" },
      { kind: "person", title: "Late exceptions", sub: "Priya Sharma approves" },
    ],
  },
  {
    id: "more",
    title: ["Any agent,", "once connected"],
    sub: "could be added next",
    state: "addable",
    items: [
      { kind: "addable", title: "Cash ledger & positions", sub: "already in BNY's dataset", sources: ["bny/cash_ledger", "bny/positions"] },
      { kind: "addable", title: "Sanctions screening", sub: "a new connection" },
    ],
  },
];

export const IN_ZONES: (Box & { id: string; label: string; tone: "goldman" | "bny" })[] = [
  { id: "counterparty", label: "Counterparty", x: 15, y: 30, w: 140, h: 550, tone: "goldman" },
  { id: "edge", label: "BNY edge", x: 165, y: 30, w: 210, h: 550, tone: "bny" },
  { id: "internal", label: "BNY internal", x: 385, y: 30, w: 605, h: 550, tone: "bny" },
];
const ITEM = { x: 745, w: 240, h: 34, step: 44, top: 55, groupGap: 24 };

export type PlacedGroup = { group: Group; agent: Box; items: (Item & { box: Box })[] };
export function layoutInside() {
  let k = 0;
  const groups = INSIDE.map((g, gi): PlacedGroup => {
    const items = g.items.map((it) => ({ ...it, box: { x: ITEM.x, y: ITEM.top + k++ * ITEM.step + gi * ITEM.groupGap, w: ITEM.w, h: ITEM.h } }));
    const cy = (items[0].box.y + items.at(-1)!.box.y + ITEM.h) / 2;
    return { group: g, agent: { x: 565, y: cy - 40, w: 135, h: 80 }, items };
  });
  const cy = groups.reduce((a, g) => a + g.agent.y + g.agent.h / 2, 0) / groups.length;
  return {
    groups,
    cy,
    gs: { x: 28, y: 150, w: 114, h: 90 } as Box,
    edge: { x: 180, y: 160, w: 180, h: 70 } as Box,
    gate: { x: 180, y: cy - 40, w: 180, h: 80 } as Box,
    outbound: { x: 180, y: 470, w: 180, h: 70 } as Box,
    orch: { x: 405, y: cy - 65, w: 120, h: 130 } as Box,
  };
}

/** Numbered hops of the second diagram, with the sentence under the diagram. */
export const IN_CAPTIONS = [
  "Goldman's agent opens the mTLS connection",
  "The edge passes the request to the gateway",
  "The gateway admits a cleaned request, nothing else",
  "The orchestrator hands the case to BNY's agents",
  "Agents read BNY's systems on their own",
  "Sending to the client, releasing an instruction or making an exception waits for a named person",
  "The reply is drafted and passed to the outbound filter",
  "Only approved fields leave, back to Goldman",
];
export const INSIDE_HEIGHT = 600;
