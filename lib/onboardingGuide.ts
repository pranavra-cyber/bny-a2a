// Copy and steps for onboarding Goldman's agent, in plain language. One flow, one
// layer of security at a time; if a check finds a problem, the step shows how to
// resolve it. Types and text only: safe to import from client components.

export type Problem = "lei" | "domain";
export type OnboardingStage = "application" | "agreement" | "company" | "account" | "ssi" | "swift" | "domain" | "identity" | "permissions" | "credentials" | "test";

export const PERMISSIONS: { id: string; label: string; recommended: boolean; note: string }[] = [
  { id: "settlement.dk-inquiry", label: "Ask why a delivery was rejected", recommended: true, note: "Needed to chase a failed trade." },
  { id: "settlement.status", label: "Check the status of an inquiry", recommended: true, note: "Lets the agent follow up without starting over." },
  { id: "settlement.redelivery-notice", label: "Tell BNY a redelivery is coming", recommended: true, note: "Lets the agent close the loop once it redelivers." },
  {
    id: "settlement.instruction-details",
    label: "See BNY's instruction details",
    recommended: false,
    note: "Not recommended: instructions name BNY's client and its accounts. Goldman can resolve a fail without them.",
  },
];

export type StageCopy = {
  id: OnboardingStage;
  /** Security layer this step belongs to. */
  layer: string;
  label: string;
  /** Who owns this check at BNY (from the deck). */
  owner: string;
  what: string;
  why: string;
  action: string;
};

export const LAYERS = ["Application", "Who they are", "How they settle", "Their agent", "What it may do", "Go live"] as const;

export const ONBOARDING_STAGES: StageCopy[] = [
  {
    id: "application",
    layer: "Application",
    label: "Read the application",
    owner: "AI Hub",
    what: "Who is applying, which agent they want to connect, and what it wants to do.",
    why: "Every later check compares against what the applicant claims here.",
    action: "Open the application",
  },
  {
    id: "agreement",
    layer: "Application",
    label: "Firm agreement",
    owner: "Legal, Risk, Compliance",
    what: "Has Goldman signed BNY's agent data-sharing terms, and who is accountable on each side?",
    why: "BNY has no contract with most trading counterparties: the broker contract sits with the client. Agents need their own agreement on what may be shared and how it may be used.",
    action: "Check the agreement",
  },
  {
    id: "company",
    layer: "Who they are",
    label: "Confirm the company",
    owner: "Reference Data",
    what: "Is the company ID on the application (the LEI) one BNY already knows, with due diligence complete?",
    why: "Matching the LEI to BNY's own records proves the applicant is Goldman Sachs and not a look-alike.",
    action: "Check the company",
  },
  {
    id: "account",
    layer: "Who they are",
    label: "Confirm the DTC account",
    owner: "Reference Data",
    what: "Does Goldman hold an active account at DTC, where its deliveries to BNY settle?",
    why: "The agent will talk about deliveries at DTC. A firm with no active account there has no business sending those messages.",
    action: "Check the DTC account",
  },
  {
    id: "ssi",
    layer: "How they settle",
    label: "Confirm settlement instructions (SSI)",
    owner: "Reference Data",
    what: "Is there one active, verified SSI on file for Goldman's US equities, and does it match the DTC account?",
    why: "The agent will discuss deliveries that settle against these instructions. An old or unverified SSI is how deliveries go to the wrong place.",
    action: "Check the SSIs",
  },
  {
    id: "swift",
    layer: "How they settle",
    label: "Confirm the SWIFT link",
    owner: "Network / messaging",
    what: "Can BNY and Goldman already exchange SWIFT messages (an authorised relationship for the agent BIC on the SSI)?",
    why: "Agent messages sit alongside the existing SWIFT channel; they don't replace it. A working SWIFT link is the fallback if the agent link is down.",
    action: "Check the SWIFT link",
  },
  {
    id: "domain",
    layer: "Their agent",
    label: "Confirm they own the agent's address",
    owner: "Technology, Security",
    what: "Has Goldman published the code BNY gave it on the web address the agent runs from?",
    why: "Only the real owner of an address can publish on it. This stops someone else running an agent that claims to be Goldman's.",
    action: "Check the web address",
  },
  {
    id: "identity",
    layer: "Their agent",
    label: "Issue certificate and sign the Agent Card",
    owner: "AI Hub, Security",
    what: "BNY issues the agent a certificate, registers Goldman's signing key, and checks the Agent Card is signed with it.",
    why: "The certificate is what the agent proves itself with from now on. The gateway rejects any card or message not signed with Goldman's key, even if it uses Goldman's name.",
    action: "Issue and sign",
  },
  {
    id: "permissions",
    layer: "What it may do",
    label: "Set limits",
    owner: "Settlement Operations",
    what: "Which requests the agent may send BNY on its own, and which BNY people approve the rest.",
    why: "Grant only what the job needs. Every permission is something BNY's gateway will let through.",
    action: "Save the limits",
  },
  {
    id: "credentials",
    layer: "What it may do",
    label: "Issue credentials",
    owner: "AI Hub, Security",
    what: "Register Goldman's agent with BNY's auth server: a client ID tied to the certificate from step 8. The agent then fetches its own short-lived access pass whenever it calls.",
    why: "A pass expires in minutes, so none is handed over here. It only proves who is calling; what the agent may do is read from the registry on every request, so a change or revocation applies at once.",
    action: "Register credentials",
  },
  {
    id: "test",
    layer: "Go live",
    label: "Test the link and go live",
    owner: "Technology, Security",
    what: "Send a test message through the gateway, confirm every check passes, and record who to call if the agent gets stuck.",
    why: "A connection is only live once it has been tested end to end, with named people on both sides.",
    action: "Run the test",
  },
];

/** What Goldman's onboarding contact says when asked to fix a problem. */
export const FIXES: Record<Problem, { title: string; steps: string[]; ask: string; reply: string; label: string }> = {
  lei: {
    title: "The company ID doesn't match BNY's records",
    steps: ["Compare the LEI on the application with BNY's reference data.", "Ask Goldman's onboarding contact to correct it.", "Check the company again."],
    label: "Ask Goldman to correct the LEI",
    ask: "Please check the LEI on your application. It doesn't match our records for Goldman Sachs & Co. LLC.",
    reply: "Apologies, two characters were swapped when the form was filled in. We've resubmitted with the corrected LEI.",
  },
  domain: {
    title: "The agent's web address isn't proven",
    steps: ["Confirm the verification code is missing from the address.", "Ask Goldman to publish it, or use an address that has it.", "Check the address again."],
    label: "Ask Goldman to publish the proof",
    ask: "Please publish the verification code we sent on the web address your agent runs from.",
    reply: "Our agent will run from our main address, gs.example, where your verification code is already published. We've updated the application.",
  },
};

export const ONBOARDING_CONTACT = "Sam Patel, Goldman Sachs onboarding";

// ---------- What each step asks of the person ----------

/** A document Goldman sent, uploaded by the onboarding lead (mimicked: no real upload). */
export type UploadSpec = { name: string; file: string; size: string; pages: number; sentBy: string; preview: string[] };
/** A value typed from the application, filled with a click. */
export type InputSpec = { id: string; label: string; source: string; mono?: boolean };

export type StageWork = {
  upload?: UploadSpec;
  inputs?: InputSpec[];
  /** Checks the system runs, in order. */
  system: string[];
  /** The system check that fails when this step finds a problem. */
  failing?: string;
  /** Things only a person can check, in the document or with someone. */
  manual: string[];
  showCard?: boolean;
  /** Shows the credentials BNY registers (nothing to enter). */
  showCredentials?: boolean;
};

export const STAGE_WORK: Record<OnboardingStage, StageWork> = {
  application: {
    inputs: [
      { id: "legalName", label: "Legal name", source: "application" },
      { id: "lei", label: "Company ID (LEI)", source: "application", mono: true },
      { id: "dtcParticipant", label: "DTC account", source: "application", mono: true },
      { id: "domain", label: "Agent web address", source: "application", mono: true },
      { id: "agentName", label: "Agent", source: "application" },
    ],
    system: ["Every required field is filled in", "Requested permissions are known network skills"],
    manual: ["The applicant is the firm Rachel Okafor asked about", "The stated purpose is resolving failed trades with BNY"],
  },
  agreement: {
    upload: {
      name: "Agent data-sharing agreement (signed)",
      file: "GS-BNY_A2A-DSA-2026-014_signed.pdf",
      size: "412 KB",
      pages: 9,
      sentBy: "Sam Patel, Goldman Sachs onboarding",
      preview: [
        "AGENT DATA-SHARING AGREEMENT A2A-DSA-GS-2026-014 · Terms v3.1",
        "Between The Bank of New York Mellon (\"BNY\") and Goldman Sachs & Co. LLC (\"Goldman\").",
        "§2 Purpose. Data exchanged between agents may be used only to resolve the named settlement case.",
        "§3 Retention. Each party deletes shared data within 30 days of the case closing.",
        "§4 Models. Neither party uses shared data to train or fine-tune any model.",
        "§7 Accountability. BNY: Priya Sharma, Settlement Operations Lead. Goldman: Fails Desk Lead, US Equity Fails.",
        "Signed for BNY: R. Okafor, 12 Nov 2026 · Signed for Goldman: S. Patel, 14 Nov 2026",
      ],
    },
    system: ["Agreement A2A-DSA-GS-2026-014 is in BNY's register", "Signed by both firms", "Terms version is current (v3.1)"],
    manual: ["Use is limited to the named case (§2)", "Shared data is deleted within 30 days (§3)", "No model training on shared data (§4)", "Accountable people are named on both sides (§7)"],
  },
  company: {
    upload: {
      name: "LEI certificate (GLEIF extract)",
      file: "GLEIF_LEI_Goldman-Sachs-and-Co-LLC.pdf",
      size: "88 KB",
      pages: 1,
      sentBy: "Sam Patel, Goldman Sachs onboarding",
      preview: ["GLEIF · Legal Entity Identifier record", "Legal name: Goldman Sachs & Co. LLC", "Registered address: 200 West Street, New York, NY 10282, US", "Entity status: ACTIVE · Registration status: ISSUED"],
    },
    inputs: [{ id: "lei", label: "Company ID (LEI) on the application", source: "application", mono: true }],
    system: ["The LEI is well formed (20 characters, valid check digits)", "The LEI matches BNY's reference data", "Due diligence (KYC) is complete"],
    failing: "The LEI matches BNY's reference data",
    manual: ["The legal name on the certificate matches the application", "The registered address is Goldman's, in New York"],
  },
  account: {
    inputs: [{ id: "dtcParticipant", label: "DTC account number", source: "application", mono: true }],
    system: ["The account is in DTC's participant directory", "The account is active"],
    manual: [],
  },
  ssi: {
    upload: {
      name: "Standing settlement instructions, US equities",
      file: "GS_SSI_US-Equities_effective-2024-06-01.pdf",
      size: "156 KB",
      pages: 2,
      sentBy: "Sam Patel, Goldman Sachs onboarding",
      preview: ["STANDING SETTLEMENT INSTRUCTIONS · US EQUITIES", "Depository: DTC · Participant: 0005 · Agent BIC: SYNGSUS33XXX", "Effective: 1 June 2024 · Replaces all earlier US equity instructions", "Authorised signatories: 1) L. Park, VP Operations  2) G. Adeyemi, VP Operations"],
    },
    system: ["One active SSI on file for Goldman's US equities", "It matches DTC account 0005", "It was verified by a second person", "Older SSIs are ended and won't be used"],
    manual: ["The letter is signed by two authorised signatories", "The effective date on the letter matches the SSI on file"],
  },
  swift: {
    inputs: [{ id: "agentBic", label: "Goldman's agent BIC (from the SSI)", source: "SSI", mono: true }],
    system: ["An authorised SWIFT relationship (RMA) exists for this BIC", "A test MT599 was acknowledged"],
    manual: [],
  },
  domain: {
    inputs: [{ id: "proofUrl", label: "Where the verification code is published", source: "application", mono: true }],
    system: ["The address belongs to the applicant", "BNY's verification code is published at the address"],
    failing: "BNY's verification code is published at the address",
    manual: [],
  },
  identity: {
    showCard: true,
    upload: {
      name: "Agent certificate request",
      file: "gs-outreach-agent.csr",
      size: "2 KB",
      pages: 1,
      sentBy: "Goldman Sachs agent platform team",
      preview: ["-----BEGIN CERTIFICATE REQUEST-----", "Subject: CN=gs-outreach, O=Goldman Sachs & Co. LLC, DNS=gs.example", "Public key: Ed25519 · fingerprint shown after upload", "-----END CERTIFICATE REQUEST-----"],
    },
    system: ["The request is for agent gs-outreach at Goldman's proven address", "Certificate issued by BNY's network CA", "The Agent Card's signature verifies with the registered key", "The certificate is not revoked"],
    manual: ["The skills on the card match what Goldman applied for", "The provider and endpoint on the card are Goldman's"],
  },
  permissions: { system: ["Every granted permission was requested", "Limits saved to the registry"], manual: [] },
  credentials: {
    showCredentials: true,
    system: [
      "Client ID registered and tied to the step 8 certificate",
      "Auth server accepts this client only over mTLS with that certificate",
      "Test pass issued for the Eliza gateway",
      "Test pass expires as set in the limits",
      "Test pass is bound to the certificate and carries no permissions",
    ],
    manual: ["Goldman's agent platform team confirmed their agent fetches and renews passes itself", "Disabling the registry entry stops new passes; existing ones expire within the pass lifetime"],
  },
  test: {
    inputs: [
      { id: "bnyContact", label: "BNY contact if the agent gets stuck", source: "directory" },
      { id: "gsContact", label: "Goldman contact if the agent gets stuck", source: "application" },
    ],
    system: ["Fresh access pass from BNY's auth server (lifetime as set, granted permissions only)", "Registered agent", "Agent Card signature", "Token holder", "Message signature", "Fresh nonce", "Message schema", "Scope"],
    manual: ["Both contacts confirmed they are on call for the agent"],
  },
};

/** Limits beyond the permissions themselves. */
export const LIMITS = {
  rate: { label: "Messages per hour", options: ["30", "60", "120"], default: "60", note: "Above this the gateway queues the agent's messages." },
  openCases: { label: "Open cases at once", options: ["5", "10", "25"], default: "10", note: "Stops one firm crowding out others." },
  hours: { label: "When it may contact BNY", options: ["07:00–18:00 ET, business days", "24 hours, business days", "Always"], default: "07:00–18:00 ET, business days", note: "Outside these hours messages wait for the next window." },
  pass: {
    label: "Access pass lifetime",
    options: ["5 min", "10 min", "15 min"],
    default: "10 min",
    note: "The agent fetches a fresh pass from BNY's auth server before each call; it expires after this long.",
  },
  turns: { label: "Messages per case before people take over", options: ["6", "10", "15"], default: "10", note: "Also caps model cost per case." },
} as const;
export type LimitId = keyof typeof LIMITS;

/** What BNY people must approve before the agent's request is acted on. */
export const APPROVALS = [
  { id: "client-message", label: "Any message to BNY's client", locked: true },
  { id: "late-exception", label: "Late-instruction exceptions", locked: true },
  { id: "partial", label: "Partial-settlement proposals", locked: false },
  { id: "redelivery-notice", label: "Acting on a redelivery notice", locked: false },
] as const;

/** Fields BNY's replies may carry to this agent (the outbound allowlist). */
export const REPLY_FIELDS = [
  { id: "dtc_reference", label: "DTC reference", locked: true },
  { id: "isin", label: "ISIN", locked: true },
  { id: "settle_date", label: "Settle date", locked: true },
  { id: "instruction_status", label: "Instruction status", locked: false },
  { id: "quantity_instructed", label: "Instructed quantity", locked: false },
  { id: "expected_fix_time", label: "Expected fix time", locked: false },
  { id: "resolution", label: "What changed (resolution note)", locked: false },
  { id: "settle_by", label: "Settle-by time", locked: false },
] as const;
