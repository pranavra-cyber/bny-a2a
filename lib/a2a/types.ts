// Shapes that mirror A2A v1.0 concepts (Agent Card, Task, Message, Part, Artifact).
// This is an in-process simulation; nothing here goes over a real network.

export type TaskState = "submitted" | "working" | "input-required" | "completed" | "failed" | "rejected" | "canceled";

export type TextPart = { kind: "text"; text: string };
export type DataPart = { kind: "data"; data: Record<string, unknown> };
export type Part = TextPart | DataPart;

/** A citation of one row the sender owns: table + record id, optionally with field values claimed. */
export type SourceRef = {
  firm: string;
  table: string;
  id: string;
  fields?: { name: string; value: string }[];
};

export type Message = {
  messageId: string;
  taskId: string;
  contextId: string;
  role: "user" | "agent";
  parts: Part[];
  metadata: {
    from: string;
    to: string;
    skill: string;
    sentAt: string;
    sourceRecords: SourceRef[];
  };
};

export type Artifact = { artifactId: string; name: string; parts: Part[] };

export type Task = {
  id: string;
  contextId: string;
  status: { state: TaskState; timestamp: string; reason?: string };
  history: Message[];
  artifacts: Artifact[];
};

export type AgentSkill = {
  id: string;
  name: string;
  description: string;
  inputModes: string[];
  outputModes: string[];
};

export type AgentCard = {
  name: string;
  description: string;
  provider: { organization: string; url: string };
  url: string;
  version: string;
  capabilities: { streaming: boolean; pushNotifications: boolean; stateTransitionHistory: boolean };
  skills: AgentSkill[];
  securitySchemes: Record<string, { type: string; flows?: Record<string, unknown>; description?: string }>;
  signature: { alg: string; keyId: string; value: string };
  // Prototype-only annotations used by the registry screen.
  "x-prototype": {
    id: string;
    firm: "bny" | "goldman" | "allianzgi";
    owner: string;
    kind: "LLM + tools" | "Deterministic" | "Deterministic + LLM summary" | "Human";
    visibility: "network" | "internal";
    canRead: string[];
    canDo: string[];
  };
};

export type MembershipRecord = {
  firm: "bny" | "goldman" | "allianzgi";
  legalName: string;
  lei: string;
  kycStatus: "VERIFIED" | "PENDING" | "FAILED";
  domain: string;
  domainAttestation: "ATTESTED" | "PENDING" | "FAILED";
  role: "network-operator" | "counterparty" | "client";
  dtcParticipant: string | null;
  onboardedOn: string;
  agents: { agentId: string; clientId: string; approvedSkills: string[] }[];
};

export type GatewayCheck = { id: string; label: string; ok: boolean; detail: string };
