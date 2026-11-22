// The two diagrams on the front page. One: connecting to the outside world, i.e. how trust is
// established before any request is answered. Two: what happens inside BNY once it is: the
// orchestrator, the agents, the tools and databases they use, and which actions wait for a person.
// Geometry is in SVG units. Text and data only: safe for client components.

export type Box = { x: number; y: number; w: number; h: number };
const mid = (b: Box): [number, number] => [b.x + b.w / 2, b.y + b.h / 2];

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
const out = (id: string) => OUT_NODES.find((n) => n.id === id)!;

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
// 2. Inside BNY

export type Human = { by: "auto" } | { by: "person"; who: string };
export type Row = {
  tool: string;
  data: { title: string; sub: string };
  human: Human;
  /** "built": in the prototype. "addable": could be connected next. */
  state: "built" | "addable";
  /** Table or document in the prototype's data this row reads, if any. */
  source?: string;
};
export type Group = { id: string; agentId?: string; title: string; sub: string; state: "built" | "addable"; rows: Row[] };

export const INSIDE: Group[] = [
  {
    id: "ops",
    agentId: "bny-settlement-agent",
    title: "Settlement Ops Agent",
    sub: "finds the cause",
    state: "built",
    rows: [
      { tool: "Find the DK'd instruction", data: { title: "Settlement instructions", sub: "what BNY expects to receive" }, human: { by: "auto" }, state: "built", source: "bny/settlement_instructions" },
      { tool: "Check DTC activity", data: { title: "DTC activity feed", sub: "what the depository shows" }, human: { by: "auto" }, state: "built", source: "dtc/settlement_activity" },
      { tool: "Look up fail & exception", data: { title: "Fails & exceptions log", sub: "open fails and deadlines" }, human: { by: "auto" }, state: "built", source: "bny/fails_exceptions" },
      { tool: "Check receiving details", data: { title: "SSI reference data", sub: "counterparty settlement details" }, human: { by: "auto" }, state: "built", source: "bny/ssi_counterparties" },
      { tool: "Search the procedures", data: { title: "Procedures library", sub: "runbooks and policies" }, human: { by: "auto" }, state: "built", source: "docs/settlement_operations_procedures.md" },
    ],
  },
  {
    id: "client",
    agentId: "bny-client-team",
    title: "Client Team Agent",
    sub: "drafts for the client",
    state: "built",
    rows: [
      { tool: "Look up client & terms", data: { title: "Client accounts", sub: "service terms and contacts" }, human: { by: "auto" }, state: "built", source: "bny/client_accounts" },
      { tool: "Draft the client email", data: { title: "Email to the client", sub: "Daniel Kim approves each one" }, human: { by: "person", who: "Daniel Kim" }, state: "built" },
    ],
  },
  {
    id: "system",
    agentId: "bny-settlement-system",
    title: "Settlement system",
    sub: "no model, releases to DTC",
    state: "built",
    rows: [
      { tool: "Release the instruction", data: { title: "Settlement system → DTC", sub: "an analyst approves the release" }, human: { by: "person", who: "an analyst" }, state: "built" },
      { tool: "Request a late exception", data: { title: "Exceptions queue", sub: "Priya Sharma approves" }, human: { by: "person", who: "Priya Sharma" }, state: "built" },
    ],
  },
  {
    id: "more",
    title: "Any agent, once connected",
    sub: "could be added next",
    state: "addable",
    rows: [
      { tool: "Check cash & positions", data: { title: "Cash ledger & positions", sub: "already in BNY's dataset" }, human: { by: "auto" }, state: "addable", source: "bny/cash_ledger" },
      { tool: "Check the repair queue", data: { title: "Repair queue", sub: "already in BNY's dataset" }, human: { by: "auto" }, state: "addable", source: "bny/repair_queue" },
      { tool: "Screen the counterparty", data: { title: "Sanctions & watchlists", sub: "a new connection" }, human: { by: "auto" }, state: "addable" },
    ],
  },
];

export const IN = { row: 40, top: 125, groupGap: 16, boxH: 32 };
export type Placed = { group: Group; agent: Box; band: Box; rows: (Row & { y: number; tool_: Box; pill: Box; data_: Box })[] };

/** Positions every box. Rows run top to bottom with a gap between groups. */
export function layoutInside(): { groups: Placed[]; orch: Box; gateway: Box; outbound: Box; audit: Box } {
  let k = 0;
  const groups = INSIDE.map((g, gi): Placed => {
    const ys = g.rows.map(() => IN.top + k++ * IN.row + gi * IN.groupGap);
    const first = ys[0];
    const last = ys[ys.length - 1];
    return {
      group: g,
      agent: { x: 295, y: first - 20, w: 135, h: last - first + 40 },
      band: { x: 285, y: first - 26, w: 710, h: last - first + 52 },
      rows: g.rows.map((r, i) => ({
        ...r,
        y: ys[i],
        tool_: { x: 460, y: ys[i] - IN.boxH / 2, w: 180, h: IN.boxH },
        pill: { x: 650, y: ys[i] - 10, w: 108, h: 20 },
        data_: { x: 762, y: ys[i] - IN.boxH / 2, w: 225, h: IN.boxH },
      })),
    };
  });
  const lastY = groups.at(-1)!.rows.at(-1)!.y;
  const cy = (IN.top + lastY) / 2;
  return {
    groups,
    orch: { x: 150, y: cy - 66, w: 115, h: 132 },
    gateway: { x: 10, y: cy - 40, w: 100, h: 80 },
    outbound: { x: 295, y: 25, w: 135, h: 50 },
    audit: { x: 150, y: lastY + 38, w: 845, h: 36 },
  };
}
export const INSIDE_HEIGHT = layoutInside().audit.y + 36 + 20;
export { mid };
export const outNode = out;
