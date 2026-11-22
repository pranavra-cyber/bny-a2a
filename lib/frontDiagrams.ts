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
// 2. Inside BNY: the same map as the first, with the BNY internal zone opened up as a tool layer

export type Connector = "mcp" | "api" | "mail";
export const CONNECTOR_LABEL: Record<Connector, string> = { mcp: "MCP server", api: "REST API", mail: "Mail API" };

/** How far the prototype takes a tool. */
export type ToolStatus = "working" | "partly" | "described" | "addable";
export const TOOL_STATUS_LABEL: Record<ToolStatus, string> = {
  working: "Working in the prototype",
  partly: "Partly working in the prototype",
  described: "Described, not built",
  addable: "Could be added next",
};

export type Tool = {
  id: string;
  title: string;
  sub: string;
  connector: Connector;
  /** auto: reads or acts on its own. person: a named person approves first. */
  human: { by: "auto" } | { by: "person"; who: string };
  status: ToolStatus;
  usedBy: string;
  /** How a call looks on the wire: illustrative, with the prototype's own values. */
  call: string;
  returns: string;
  access: string;
  prototype: string;
  production: string;
  /** The function in the prototype that does this, if there is one. */
  fn?: { file: string; name: string; /** The name the call is logged under, if different. */ logged?: string };
  /** Values used in the example, each with a data file that contains it. */
  facts?: [file: string, value: string][];
};

const rpc = (name: string, args: Record<string, string>) => JSON.stringify({ jsonrpc: "2.0", method: "tools/call", params: { name, arguments: args } }, null, 2);
const json = (o: unknown) => JSON.stringify(o, null, 2);

export const TOOLS: Tool[] = [
  {
    id: "instruction",
    title: "Settlement instructions",
    sub: "what BNY expects to receive",
    connector: "mcp",
    human: { by: "auto" },
    status: "working",
    usedBy: "Settlement Ops Agent",
    call: rpc("get_settlement_instruction", { dtc_reference: "DTC-DO-20261119-000318" }),
    returns: json({ instruction_id: "BNYI-20261118-5527301", quantity: 8000, status: "SENT_TO_DTC", settle_date: "2026-11-19" }),
    access: "Read-only. The agent may call this tool and no other write or read of this table.",
    prototype: "The lookup getInstruction, inside investigateDelivery in lib/tools/bny.ts, reads the table in-process. DataScope limits which tables BNY's agents may read, and every call is written to the audit log.",
    production: "The same tool exposed by an MCP server in front of the settlement platform, called with a service identity and a read-only scope.",
    fn: { file: "lib/tools/bny.ts", name: "investigateDelivery", logged: "getInstruction" },
    facts: [["data/bny/settlement_instructions.csv", "BNYI-20261118-5527301,2026-11-18 14:58:41,SWIFT_MT541,4471-AGI-GLEQ,AGI-ORD-26-322-0773,RVP,US67066G1040,8000"]],
  },
  {
    id: "dtc",
    title: "DTC activity feed",
    sub: "what the depository shows",
    connector: "mcp",
    human: { by: "auto" },
    status: "working",
    usedBy: "Settlement Ops Agent",
    call: rpc("get_dtc_events", { dtc_reference: "DTC-DO-20261119-000318" }),
    returns: json([{ event: "INSTRUCTED", quantity: 10000 }, { event: "DK", quantity: 10000, reason_code: "QTY_MISMATCH" }]),
    access: "Read-only, scoped to BNY's own participant rows.",
    prototype: "The lookup getDtcEvents, inside investigateDelivery in lib/tools/bny.ts, over a synthetic feed.",
    production: "An MCP server wrapping BNY's DTC connectivity, or its internal copy of the feed.",
    fn: { file: "lib/tools/bny.ts", name: "investigateDelivery", logged: "getDtcEvents" },
    facts: [["data/dtc/settlement_activity.csv", "DTC-DO-20261119-000318,2026-11-19T08:16:02-05:00,0005,0901,US67066G1040,10000,1862600,DVP,DK,QTY_MISMATCH"]],
  },
  {
    id: "exception",
    title: "Fails & exceptions log",
    sub: "open fails and deadlines",
    connector: "api",
    human: { by: "auto" },
    status: "working",
    usedBy: "Settlement Ops Agent",
    call: "GET /v1/exceptions?dtc_reference=DTC-DO-20261119-000318\nAuthorization: Bearer <service token, scope exceptions:read>",
    returns: json({ exception_id: "EXC-20261119-0907", fail_reason: "DK_QTY_MISMATCH", status: "OPEN" }),
    access: "Read-only.",
    prototype: "The lookup getException, inside investigateDelivery in lib/tools/bny.ts, over a synthetic table.",
    production: "A REST call to the exceptions system BNY already runs; no new system is needed, only a scoped service credential.",
    fn: { file: "lib/tools/bny.ts", name: "investigateDelivery", logged: "getException" },
    facts: [["data/bny/fails_exceptions.csv", "EXC-20261119-0907,BNYI-20261118-5527301,DTC-DO-20261119-000318"]],
  },
  {
    id: "ssi",
    title: "SSI reference data",
    sub: "counterparty settlement details",
    connector: "mcp",
    human: { by: "auto" },
    status: "working",
    usedBy: "Settlement Ops Agent",
    call: rpc("get_counterparty_ssi", { counterparty: "Goldman Sachs & Co. LLC", market: "US", asset_class: "EQUITY" }),
    returns: json({ ssi_id: "SSI-GS-US-EQ-0005", dtc_participant: "0005", status: "ACTIVE" }),
    access: "Read-only.",
    prototype: "The lookup getCounterpartySsi, inside investigateDelivery in lib/tools/bny.ts.",
    production: "An MCP server over the reference-data service that owns standing settlement instructions.",
    fn: { file: "lib/tools/bny.ts", name: "investigateDelivery", logged: "getCounterpartySsi" },
    facts: [["data/bny/ssi_counterparties.csv", "SSI-GS-US-EQ-0005"]],
  },
  {
    id: "procedures",
    title: "Procedures & runbooks",
    sub: "cutoffs and who must approve",
    connector: "mcp",
    human: { by: "auto" },
    status: "working",
    usedBy: "Settlement Ops Agent",
    call: rpc("search_procedures", { query: "same-day client instruction cutoff" }),
    returns: json({ source: "settlement_operations_procedures", row: "Client instructions for same-day (S) DVP settlement", cutoff: "11:30" }),
    access: "Read-only, approved documents only.",
    prototype: "proceduresExcerpt in lib/tools/bny.ts reads the procedures document.",
    production: "An MCP server over BNY's document store, so answers cite the current approved version.",
    fn: { file: "lib/tools/bny.ts", name: "proceduresExcerpt" },
    facts: [["data/bny/docs/settlement_operations_procedures.md", "Client instructions for same-day (S) DVP settlement | 11:30"]],
  },
  {
    id: "client",
    title: "Client accounts",
    sub: "terms and contacts",
    connector: "mcp",
    human: { by: "auto" },
    status: "working",
    usedBy: "Client Team Agent",
    call: rpc("get_client_account", { account_id: "4471-AGI-GLEQ" }),
    returns: json({ client_legal_name: "Allianz Global Investors GmbH", client_tier: "1", service_executive: "K. Brennan" }),
    access: "Read-only. Client fields never leave BNY: the outbound filter blocks them.",
    prototype: "The lookup getClientAccount, inside investigateDelivery in lib/tools/bny.ts.",
    production: "An MCP server over the client master, read-only, with client fields labelled so the filter can block them.",
    fn: { file: "lib/tools/bny.ts", name: "investigateDelivery", logged: "getClientAccount" },
    facts: [["data/bny/client_accounts.csv", "4471-AGI-GLEQ,Allianz Global Investors GmbH,AGI,AllianzGI Global Equity Fund (synthetic),CUSTODY,EUR,1,R. Okafor,K. Brennan"]],
  },
  {
    id: "email",
    title: "Client email",
    sub: "Daniel Kim approves each one",
    connector: "mail",
    human: { by: "person", who: "Daniel Kim" },
    status: "partly",
    usedBy: "Client Team Agent",
    call: "POST /v1/mail/send\n{ \"to\": \"Emily Carter (AllianzGI)\", \"about\": \"DTC-DO-20261119-000318\", \"approved_by\": \"Daniel Kim\" }",
    returns: json({ status: "sent", approved_by: "Daniel Kim" }),
    access: "Write. Only callable with an approval from the named person; the agent drafts, it cannot send.",
    prototype: "The agent drafts (draftClientRequest in lib/agents/bny.ts), Daniel approves in his workspace, and the send is simulated: no mail leaves the prototype.",
    production: "A mail or messaging API call that carries the approver's identity, so the send is attributable to a person.",
    fn: { file: "lib/agents/bny.ts", name: "draftClientRequest" },
  },
  {
    id: "release",
    title: "Release to DTC",
    sub: "an analyst approves",
    connector: "api",
    human: { by: "person", who: "an analyst" },
    status: "described",
    usedBy: "Settlement system",
    call: "POST /v1/instructions/BNYI-20261119-5531207/release\n{ \"approved_by\": \"<analyst>\" }",
    returns: json({ status: "SENT_TO_DTC" }),
    access: "Write. Needs a named approver.",
    prototype: "In the recorded case the client's corrected MT541 is applied automatically (applyClientInstruction); an analyst gate on a manual release is the design here, not something the prototype enforces.",
    production: "The settlement platform's release API, callable only with an approver's identity attached.",
    fn: { file: "lib/tools/bny.ts", name: "applyClientInstruction" },
    facts: [["lib/tools/bny.ts", "BNYI-20261119-5531207"]],
  },
  {
    id: "late",
    title: "Late exceptions",
    sub: "Priya Sharma approves",
    connector: "api",
    human: { by: "person", who: "Priya Sharma" },
    status: "described",
    usedBy: "Settlement Ops Agent",
    call: "POST /v1/exceptions/EXC-20261119-0907/late-approval\n{ \"requested_by\": \"bny-settlement-agent\" }",
    returns: json({ status: "pending approval", approver: "Priya Sharma" }),
    access: "Write. The agent can ask; only the approver can grant.",
    prototype: "The registry names Priya as the approver of late-instruction exceptions. There is no call behind it yet.",
    production: "A request to the exceptions queue that stays pending until the approver acts on it.",
    facts: [["data/bny/fails_exceptions.csv", "EXC-20261119-0907"]],
  },
  {
    id: "positions",
    title: "Positions",
    sub: "already in BNY's dataset",
    connector: "mcp",
    human: { by: "auto" },
    status: "addable",
    usedBy: "Any agent, once connected",
    call: rpc("get_position", { account_id: "4471-AGI-GLEQ", isin: "US67066G1040" }),
    returns: json({ quantity: 0, pending_receipts: 8000 }),
    access: "Read-only.",
    prototype: "The table exists in the prototype's data, but no agent reads it yet.",
    production: "An MCP server over the positions service. It would let an agent confirm what the client actually holds before it recommends anything.",
    facts: [["data/bny/positions.csv", "2026-11-18,4471-AGI-GLEQ,US67066G1040,0,8000,0,0"]],
  },
  {
    id: "sanctions",
    title: "Sanctions screening",
    sub: "a new connection",
    connector: "api",
    human: { by: "auto" },
    status: "addable",
    usedBy: "Any agent, once connected",
    call: "POST /v1/screen\n{ \"name\": \"Goldman Sachs & Co. LLC\", \"lei\": \"5493VQMLGW286LLGYZ19\" }",
    returns: json({ result: "no match" }),
    access: "Read-only.",
    prototype: "Not built.",
    production: "A call to the screening service BNY already uses, run before a firm is onboarded and on a schedule after.",
    facts: [["data/bny/ssi_counterparties.csv", "5493VQMLGW286LLGYZ19"]],
  },
];

export const IN_ZONES: (Box & { id: string; label: string; tone: "goldman" | "bny" })[] = [
  { id: "counterparty", label: "Counterparty", x: 15, y: 30, w: 140, h: 550, tone: "goldman" },
  { id: "edge", label: "BNY edge", x: 165, y: 30, w: 210, h: 550, tone: "bny" },
  { id: "internal", label: "BNY internal", x: 385, y: 30, w: 605, h: 550, tone: "bny" },
];
const CARD = { x: 705, w: 280, h: 36, step: 42, top: 68, gap: 14 };

export type PlacedTool = Tool & { box: Box };
/** Tools run top to bottom: reads, then approvals, then what could be added, with a gap between. */
export function layoutInside() {
  const phase = (t: Tool) => (t.status === "addable" ? 2 : t.human.by === "person" ? 1 : 0);
  const tools = TOOLS.map((t, i): PlacedTool => ({ ...t, box: { x: CARD.x, y: CARD.top + i * CARD.step + phase(t) * CARD.gap, w: CARD.w, h: CARD.h } }));
  const cy = (tools[0].box.y + tools.at(-1)!.box.y + CARD.h) / 2;
  return {
    tools,
    cy,
    gs: { x: 28, y: 150, w: 114, h: 90 } as Box,
    edge: { x: 180, y: 160, w: 180, h: 70 } as Box,
    gate: { x: 180, y: cy - 40, w: 180, h: 80 } as Box,
    outbound: { x: 180, y: 470, w: 180, h: 70 } as Box,
    orch: { x: 405, y: cy - 70, w: 115, h: 140 } as Box,
    hub: { x: 560, y: cy - 55, w: 100, h: 110 } as Box,
  };
}

/** The numbered hops of the second diagram, with the sentence under it. */
export const IN_CAPTIONS = [
  "Goldman's agent opens the mTLS connection",
  "The edge passes the request to the gateway",
  "The gateway admits a cleaned request, nothing else",
  "The orchestrator and its agents ask the tool layer for what they need",
  "The tool layer calls each system, by MCP or API, read-only unless noted, and logs every call",
  "Sending to the client, releasing an instruction or making an exception waits for a named person",
  "The reply is drafted and passed to the outbound filter",
  "Only approved fields leave, back to Goldman",
];
export const INSIDE_HEIGHT = 600;
