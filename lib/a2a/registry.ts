// Closed-network registry operated by BNY: membership records, Agent Cards and
// issued credentials. A card describes capabilities; it grants no permission.
// Permissions are the approvedSkills on the membership, enforced by the gateway.
import "server-only";
import crypto from "node:crypto";
import { scopeFor } from "../data/scope";
import { issueToken } from "./auth";
import type { AgentCard, AgentSkill, MembershipRecord } from "./types";

export const SKILLS = {
  dkInquiry: "settlement.dk-inquiry",
  status: "settlement.status",
  redeliveryNotice: "settlement.redelivery-notice",
} as const;

const skill = (id: string, name: string, description: string): AgentSkill => ({
  id,
  name,
  description,
  inputModes: ["application/json", "text/plain"],
  outputModes: ["application/json", "text/plain"],
});

const mockSig = (id: string) => ({
  alg: "HS256",
  keyId: "registry-2026-11",
  value: crypto.createHash("sha256").update(`card:${id}`).digest("base64url").slice(0, 43),
});

const oauth = {
  oauth2: {
    type: "oauth2",
    flows: { clientCredentials: { tokenUrl: "https://registry.a2a-network.example/oauth/token", scopes: {} } },
    description: "Mock client-credentials flow; tokens are HMAC-signed by the network registry.",
  },
};

type CardSpec = Omit<AgentCard, "provider" | "version" | "capabilities" | "securitySchemes" | "signature" | "url"> & {
  path: string;
};

const ORGS = {
  bny: { organization: "BNY (synthetic)", url: "https://bny.example" },
  goldman: { organization: "Goldman Sachs & Co. LLC (synthetic)", url: "https://gs.example" },
  allianzgi: { organization: "Allianz Global Investors (synthetic)", url: "https://agi.example" },
};

function card(spec: CardSpec): AgentCard {
  const { path, ...rest } = spec;
  const org = ORGS[spec["x-prototype"].firm];
  return {
    ...rest,
    provider: org,
    url: `${org.url}${path}`,
    version: "1.0.0",
    capabilities: { streaming: true, pushNotifications: false, stateTransitionHistory: true },
    securitySchemes: oauth,
    signature: mockSig(spec["x-prototype"].id),
  };
}

export const AGENT_CARDS: AgentCard[] = [
  card({
    name: "BNY Intake Gateway",
    description: "BNY's single network entry point for counterparty agents. Verifies identity and scope, scans input, enforces field allowlists and turn limits.",
    path: "/a2a/gateway",
    skills: [
      skill(SKILLS.dkInquiry, "Settlement DK inquiry", "Ask why a delivery to BNY was DK'd and how to resolve it before cutoff."),
      skill(SKILLS.status, "Settlement status", "Ask for the status of an open settlement inquiry."),
      skill(SKILLS.redeliveryNotice, "Redelivery notice", "Notify BNY that a redelivery is on its way."),
    ],
    "x-prototype": {
      id: "bny-gateway",
      firm: "bny",
      owner: "BNY Security",
      kind: "Deterministic",
      visibility: "network",
      canRead: ["Registry", "Network membership", "Approved scopes"],
      canDo: ["Verify identity and scope", "Scan and sanitize input", "Enforce field allowlists", "Rate and turn limits", "Write audit"],
    },
  }),
  card({
    name: "Settlement Fails Orchestrator",
    description: "BNY's Eliza digital employee for settlement fails. Routes the case between agents and people, and asks people for approvals in their chat.",
    path: "/agents/orchestrator",
    skills: [skill("case.route", "Route a case", "Hand a case to the right agent or person and track it to close.")],
    "x-prototype": {
      id: "bny-orchestrator",
      firm: "bny",
      owner: "BNY Settlement Ops",
      kind: "LLM + tools",
      visibility: "internal",
      canRead: ["Case record", "Agent activity"],
      canDo: ["Route the case", "Ask people for approval", "Notify by Teams"],
    },
  }),
  card({
    name: "BNY Settlement Ops Agent",
    description: "Works a settlement fail: compares BNY's records with the counterparty's, finds who must act, and keeps the counterparty informed.",
    path: "/agents/settlement-ops",
    skills: [skill("case.triage", "Find the cause", "Compare details and find which side differs."), skill("case.reply", "Counterparty update", "Write to the counterparty using approved fields only.")],
    "x-prototype": {
      id: "bny-settlement-agent",
      firm: "bny",
      owner: "BNY Settlement Ops",
      kind: "LLM + tools",
      visibility: "internal",
      canRead: ["bny/settlement_instructions", "dtc/settlement_activity (0901 rows)", "bny/fails_exceptions", "bny/client_accounts", "bny/ssi_counterparties"],
      canDo: ["Find the cause", "Rank urgency", "Hand to Client Service", "Update the counterparty"],
    },
  }),
  card({
    name: "BNY Client Team Agent",
    description: "Drafts messages to BNY's client for Client Service to approve and send, and passes the client's answers back to Settlement Ops.",
    path: "/agents/client-team",
    skills: [skill("client.request", "Client request", "Draft a request for the client to check and re-instruct.")],
    "x-prototype": {
      id: "bny-client-team",
      firm: "bny",
      owner: "BNY Client Service",
      kind: "LLM + tools",
      visibility: "internal",
      canRead: ["Case record", "bny/client_accounts", "Client service terms"],
      canDo: ["Draft client messages (a person sends them)", "Pass expected times to Settlement Ops"],
    },
  }),
  card({
    name: "BNY Settlement System (mock)",
    description: "Releases an approved instruction to DTC and emits the new status.",
    path: "/systems/settlement",
    skills: [skill("instruction.release", "Release instruction", "Release an analyst-approved instruction.")],
    "x-prototype": {
      id: "bny-settlement-system",
      firm: "bny",
      owner: "BNY Platform",
      kind: "Deterministic",
      visibility: "internal",
      canRead: [],
      canDo: ["Release approved instruction", "Emit DTC status"],
    },
  }),
  card({
    name: "GS Fails Monitor",
    description: "Detects DKs on Goldman deliveries, opens the fail and hands it to Outreach.",
    path: "/agents/fails-monitor",
    skills: [skill("fails.detect", "Detect fail", "Detect DK'd deliveries and open fails.")],
    "x-prototype": {
      id: "gs-fails-monitor",
      firm: "goldman",
      owner: "GS Ops",
      kind: "Deterministic + LLM summary",
      visibility: "internal",
      canRead: ["goldman/deliveries", "goldman/fails", "dtc/settlement_activity (0005 rows)"],
      canDo: ["Detect the DK", "Open the fail", "Hand to Outreach"],
    },
  }),
  card({
    name: "GS Counterparty Outreach Agent",
    description: "Contacts the receiving custodian's agent about a fail, follows up and proposes redelivery.",
    path: "/agents/outreach",
    skills: [skill("outreach.contact", "Counterparty outreach", "Open an A2A request with a counterparty about a fail.")],
    "x-prototype": {
      id: "gs-outreach",
      firm: "goldman",
      owner: "GS Settlements",
      kind: "LLM + tools",
      visibility: "network",
      canRead: ["goldman/trade_blotter", "goldman/allocations_confirms", "goldman/fails", "goldman/deliveries", "goldman/inventory"],
      canDo: ["Send A2A request", "Follow up", "Propose redelivery"],
    },
  }),
];

export const HUMANS = [
  { id: "bny-ops-lead", name: "Priya Sharma", firm: "bny", canDo: "Supervise the Settlement Ops Agent; approve late-instruction exceptions" },
  { id: "bny-client-service", name: "Daniel Kim", firm: "bny", canDo: "Approve and send messages to the client" },
  { id: "gs-ops-approver", name: "Michael Torres", firm: "goldman", canDo: "Approve redelivery" },
  { id: "agi-trade-ops", name: "Emily Carter", firm: "allianzgi", canDo: "Check the trade with the broker and re-instruct (outside the network)" },
] as const;

export const cardById = (id: string) => AGENT_CARDS.find((c) => c["x-prototype"].id === id);

function goldmanLei(): string {
  // BNY operates the registry, so entity verification uses BNY's own reference data.
  const ssi = scopeFor("bny")
    .read("bny/ssi_counterparties")
    .find((s) => s.counterparty_name === "Goldman Sachs & Co. LLC" && s.status === "ACTIVE" && s.counterparty_lei);
  if (!ssi?.counterparty_lei) throw new Error("Goldman LEI not found in BNY SSI reference data");
  return ssi.counterparty_lei;
}

type Registry = { members: MembershipRecord[]; tokens: Map<string, string> };
const g = globalThis as unknown as { __a2aRegistry?: Registry };

export function registry(): Registry {
  if (g.__a2aRegistry) return g.__a2aRegistry;
  const members: MembershipRecord[] = [
    {
      firm: "bny",
      legalName: "The Bank of New York Mellon (synthetic)",
      lei: "5493BNYSYNTH00000901",
      kycStatus: "VERIFIED",
      domain: "bny.example",
      domainAttestation: "ATTESTED",
      role: "network-operator",
      dtcParticipant: "0901",
      onboardedOn: "2026-09-01",
      agents: [{ agentId: "bny-gateway", clientId: "bny-gw-01", approvedSkills: [] }],
    },
    {
      firm: "goldman",
      legalName: "Goldman Sachs & Co. LLC",
      lei: goldmanLei(),
      kycStatus: "VERIFIED",
      domain: "gs.example",
      domainAttestation: "ATTESTED",
      role: "counterparty",
      dtcParticipant: "0005",
      onboardedOn: "2026-11-02",
      agents: [
        { agentId: "gs-outreach", clientId: "gs-outreach-01", approvedSkills: [SKILLS.dkInquiry, SKILLS.status, SKILLS.redeliveryNotice] },
      ],
    },
    {
      firm: "allianzgi",
      legalName: "Allianz Global Investors GmbH",
      lei: "5493AGISYNTH00000773",
      kycStatus: "VERIFIED",
      domain: "agi.example",
      domainAttestation: "ATTESTED",
      role: "client",
      dtcParticipant: null,
      onboardedOn: "2026-10-12",
      agents: [],
    },
  ];
  const tokens = new Map<string, string>();
  for (const m of members)
    for (const a of m.agents)
      tokens.set(a.agentId, issueToken({ sub: a.agentId, clientId: a.clientId, firm: m.firm, scopes: a.approvedSkills }, 24 * 3600));
  g.__a2aRegistry = { members, tokens };
  return g.__a2aRegistry;
}

export function membershipFor(agentId: string): { member: MembershipRecord; agent: MembershipRecord["agents"][number] } | null {
  for (const member of registry().members) {
    const agent = member.agents.find((a) => a.agentId === agentId);
    if (agent) return { member, agent };
  }
  return null;
}

/** Discovery: which network-visible card serves a DTC participant. */
export function discoverByParticipant(participant: string): AgentCard | undefined {
  const firm = registry().members.find((m) => m.dtcParticipant === participant)?.firm;
  if (!firm) return undefined;
  return AGENT_CARDS.find((c) => c["x-prototype"].firm === firm && c["x-prototype"].visibility === "network");
}

export const tokenFor = (agentId: string) => registry().tokens.get(agentId) ?? null;
