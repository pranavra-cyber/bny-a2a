// Copy and steps for onboarding Goldman's agent, in plain language. One flow, one
// layer of security at a time; if a check finds a problem, the step shows how to
// resolve it. Types and text only: safe to import from client components.

export type Problem = "lei" | "domain";
export type OnboardingStage = "application" | "agreement" | "company" | "account" | "ssi" | "swift" | "domain" | "identity" | "permissions" | "pass" | "test";

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
    why: "From now on the gateway rejects any card or message not signed with this key, even if it uses Goldman's name (see safety test FP6).",
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
    id: "pass",
    layer: "What it may do",
    label: "Issue the access pass",
    owner: "AI Hub",
    what: "A short-lived pass listing exactly the permissions granted, bound to the agent's certificate.",
    why: "The agent shows this pass with every message. A pass used by any other holder is refused.",
    action: "Issue the pass",
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
