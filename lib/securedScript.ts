// The "Secured" walkthrough: a legitimate Goldman connection to BNY, established and secured end to
// end, as a chat between Goldman's agent and BNY's systems. It is an illustrative walkthrough of the
// target pipeline with synthetic values. Each bubble carries what the prototype does with that step:
// enforced in code, partly enforced, or simulated (no real crypto), so nothing is passed off as more
// than it is. Names that also appear in the prototype's data (the client, fund, account, trade
// reference, onboarding date) are the data's own values. Text only: safe for client components.

export type Speaker = "goldman" | "card" | "auth" | "tls" | "gate" | "registry" | "bny" | "orchestrator" | "audit";

export const SPEAKER_LABEL: Record<Speaker, string> = {
  goldman: "Goldman Agent",
  card: "BNY Agent Card",
  auth: "BNY Auth Server",
  tls: "BNY TLS Gateway",
  gate: "BNY Security Gate",
  registry: "BNY Registry",
  bny: "BNY → Goldman",
  orchestrator: "Settlement Fails Orchestrator",
  audit: "Audit Log",
};

/** What the prototype does for this step. */
export type Provenance = "enforced" | "partly" | "simulated" | "illustrative";
export const PROVENANCE_LABEL: Record<Provenance, string> = {
  enforced: "enforced in the prototype's code",
  partly: "partly enforced in code",
  simulated: "simulated, no real crypto",
  illustrative: "illustrative example",
};

export type SecuredMessage = {
  id: string;
  speaker: Speaker;
  /** A phase heading shown before this bubble. */
  phase?: string;
  provenance: Provenance;
  text?: string;
  /** Lines revealed one at a time inside the bubble (the handshake, the entitlement questions). */
  steps?: string[];
  code?: { lang: "json" | "yaml" | "http"; body: string };
  caption?: string;
  /** The outbound filter: what goes to Goldman, and what BNY holds back. */
  split?: { shared: string; withheld: string[] };
};

// Values from the prototype's data, for the case the walkthrough follows.
export const TRADE_REF = "GS-EQ-20261118-448213"; // Goldman's trade reference on the DK'd delivery
export const DTC_REF = "DTC-DO-20261119-000318";
export const CLIENT_NAME = "Allianz Global Investors GmbH";
export const ACCOUNT = "4471-AGI-GLEQ";
export const FUND = "AllianzGI Global Equity Fund (synthetic)";
export const ONBOARDED = "2026-11-02"; // when the registry onboarded Goldman

const SHARED = { trade_ref: TRADE_REF, settlement_status: "input-required", missing_field_name: "beneficiary_account", instruction_status: "client re-instruction needed", expected_fix_time: "within 1 hour" };
const json = (o: unknown) => JSON.stringify(o, null, 2);

const REGISTRY_YAML = `# BNY Eliza — Client Registry
# This is what BNY wrote when it onboarded Goldman.
# Goldman never sees or controls this.

firm: "Goldman Sachs"
client_id: "gs-markets-agent"
status: active
onboarded: ${ONBOARDED}

allowed_skills:
  - "resolve-settlement-fail"

scope:
  counterparties: ["GOLDMAN_SACHS"]    # only their own trades
  trade_types: ["settlement", "dk"]

fields_allowed_outbound:
  - trade_ref
  - settlement_status
  - missing_field_name
  - instruction_status
  - expected_fix_time

fields_blocked_outbound:
  - client_name
  - account_number
  - fund_name
  - internal_notes
  - full_ledger

human_review_trigger:
  - "cross-client data requested"
  - "amount > $50M"
  - "regulatory flag present"`;

export const SECURED: SecuredMessage[] = [
  { id: "s1", speaker: "goldman", phase: "Phase 1 · Discovery", provenance: "illustrative", text: "Fetching BNY Eliza's Agent Card from https://eliza.bny.com/.well-known/agent-card.json" },
  {
    id: "s2",
    speaker: "card",
    provenance: "illustrative",
    code: {
      lang: "json",
      body: json({
        name: "BNY Eliza",
        url: "https://eliza.bny.com/a2a",
        skills: [
          { id: "resolve-settlement-fail", description: "Investigate and resolve settlement failures" },
          { id: "position-inquiry", description: "Query current position status" },
        ],
        securitySchemes: { oauth2: { type: "oauth2", tokenUrl: "https://auth.bny.com/oauth/token", scopes: ["settlement.read", "settlement.dk-inquiry"] } },
        authentication: "required",
        protocol: "A2A over HTTPS (JSON-RPC 2.0)",
      }),
    },
    caption: "This is public. It tells Goldman HOW to connect. It grants no access.",
  },
  {
    id: "s3",
    speaker: "goldman",
    phase: "Phase 2 · Token request: Goldman proves identity",
    provenance: "simulated",
    text: "Requesting OAuth token from BNY's auth server...",
    code: { lang: "http", body: `POST https://auth.bny.com/oauth/token\n${json({ grant_type: "client_credentials", client_id: "gs-markets-agent", client_secret: "••••••••••••", scope: "settlement.dk-inquiry" })}` },
  },
  {
    id: "s4",
    speaker: "auth",
    provenance: "simulated",
    text: "Token issued.",
    code: { lang: "json", body: json({ access_token: "eyJhbGciOiJSUzI1NiIs...", token_type: "Bearer", expires_in: 300, scope: "settlement.dk-inquiry" }) },
    caption: "Short-lived (5 min). Narrow scope (one skill only). Bound to Goldman's mTLS certificate.",
  },
  {
    id: "s5",
    speaker: "goldman",
    phase: "Phase 3 · mTLS handshake",
    provenance: "simulated",
    text: "Opening mTLS connection to eliza.bny.com...",
    steps: ["Presenting client certificate: CN=gs-markets-agent, O=Goldman Sachs, issuer=GS-Internal-CA", "Verifying BNY server certificate: CN=eliza.bny.com, O=BNY Mellon, issuer=DigiCert"],
  },
  {
    id: "s6",
    speaker: "tls",
    provenance: "simulated",
    text: "Mutual TLS established.",
    steps: ["Client cert verified ✓", "Certificate chain valid ✓", "Thumbprint matches registered client ✓", "Connection encrypted: TLS 1.3, AES-256-GCM"],
  },
  {
    id: "s7",
    speaker: "goldman",
    phase: "Phase 4 · The request crosses the boundary",
    provenance: "illustrative",
    text: "Sending A2A request over the secured channel...",
    code: {
      lang: "json",
      body: json({
        jsonrpc: "2.0",
        method: "tasks/send",
        params: {
          skill: "resolve-settlement-fail",
          message: { role: "user", parts: [{ text: `Please explain the quantity mismatch on DK ${DTC_REF} and confirm whether we should redeliver before cutoff.` }] },
          metadata: { trade_ref: TRADE_REF, counterparty: "GOLDMAN_SACHS" },
        },
      }),
    },
  },
  { id: "s8", speaker: "gate", phase: "Phase 5 · BNY Security Gate: the six checks", provenance: "enforced", text: "Running inbound security checks..." },
  { id: "s9", speaker: "gate", provenance: "simulated", text: "① mTLS Certificate → Thumbprint matches gs-markets-agent in registry ✓" },
  { id: "s10", speaker: "gate", provenance: "simulated", text: "② JWT Signature → Verified against BNY JWKS, algorithm RS256 ✓" },
  { id: "s11", speaker: "gate", provenance: "partly", text: "③ JWT Claims → issuer: auth.bny.com ✓ | audience: eliza ✓ | exp: 5 min from now ✓" },
  { id: "s12", speaker: "gate", provenance: "enforced", text: "④ Registry Lookup → Loading Goldman's permissions..." },
  { id: "s13", speaker: "registry", provenance: "illustrative", code: { lang: "yaml", body: REGISTRY_YAML }, caption: "BNY wrote this. Goldman can't change it. The gate reads it on every request." },
  {
    id: "s14",
    speaker: "gate",
    provenance: "partly",
    text: "⑤ Entitlement Check →",
    steps: ["May Goldman use resolve-settlement-fail? ✓", "May Goldman ask about GOLDMAN_SACHS trades? ✓", `Trade ref ${TRADE_REF} belongs to GOLDMAN_SACHS? ✓`],
  },
  { id: "s15", speaker: "gate", provenance: "simulated", text: "⑥ Rate Limit → Goldman: 12 of 100 requests this hour ✓" },
  { id: "s16", speaker: "gate", provenance: "illustrative", text: "All six checks passed. Request forwarded to the Settlement Fails Orchestrator." },
  { id: "s17", speaker: "orchestrator", phase: "Phase 6 · The orchestrator, and the response", provenance: "illustrative", text: "Task created: task-7f3a9c. Investigating..." },
  { id: "s18", speaker: "orchestrator", provenance: "illustrative", text: "Investigation complete. Preparing response." },
  {
    id: "s19",
    speaker: "gate",
    provenance: "enforced",
    text: "Outbound filter applied to response.",
    split: {
      shared: json(SHARED),
      withheld: [`client_name: "${CLIENT_NAME}"`, `account: "${ACCOUNT}"`, `fund: "${FUND}"`, `internal_note: "Client ops team notified, re-instruction pending"`, "full_ledger: { ... 47 fields ... }"],
    },
  },
  { id: "s20", speaker: "bny", provenance: "illustrative", text: "Response sent over A2A.", code: { lang: "json", body: json({ task_id: "task-7f3a9c", status: "input-required", result: SHARED }) } },
  { id: "s21", speaker: "goldman", provenance: "illustrative", text: "Received. Providing the missing field...", code: { lang: "json", body: json({ task_id: "task-7f3a9c", message: { parts: [{ text: "beneficiary_account: GS-44812" }] } }) } },
  { id: "s22", speaker: "gate", provenance: "enforced", text: "Inbound update on task-7f3a9c. Re-running checks... ✓ all passed." },
  { id: "s23", speaker: "orchestrator", provenance: "illustrative", text: "Field received. Task completed." },
  {
    id: "s24",
    speaker: "audit",
    provenance: "enforced",
    text: "Full exchange logged.",
    code: {
      lang: "json",
      body: json({
        task_id: "task-7f3a9c",
        requesting_firm: "Goldman Sachs",
        skill: "resolve-settlement-fail",
        trade_ref: TRADE_REF,
        fields_shared: Object.keys(SHARED),
        fields_withheld: ["client_name", "account", "fund", "internal_note", "full_ledger"],
        human_review: false,
        outcome: "completed",
        duration: "4.2s",
        timestamp: "2026-11-19T14:23:17Z",
      }),
    },
  },
];
