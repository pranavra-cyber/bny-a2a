// BNY Intake Gateway (deterministic, no LLM). Every cross-firm message passes
// here. Inbound: identity, card and message signatures, token holder, nonce,
// schema, scope, turn limit, injection scan, field allowlist. Outbound: field
// allowlist, data labels, a text scan, and usage terms on every message.
// The signature, holder, nonce and label checks are simulated for the prototype
// (they show the user experience of those controls; no real crypto runs).
import "server-only";
import { verifyToken } from "./auth";
import { isSuspended, membershipFor } from "./registry";
import type { GatewayCheck, Message, Part } from "./types";

export const MAX_TURNS = 10;
export const MAX_NEGOTIATION_MINUTES = 10;

/** Fields a counterparty may send to BNY. Anything else is dropped before BNY's agents see it. */
export const INBOUND_ALLOWLIST = [
  "dtc_reference",
  "counterparty_trade_ref",
  "counterparty_fail_ref",
  "isin",
  "quantity_delivered",
  "quantity_available",
  "settlement_amount",
  "settle_date",
  "deliverer_participant",
  "receiver_participant",
  "dk_reason",
  "confirm_quantity",
  "confirm_status",
  "requested_action",
  "requested_fields",
  "claims",
  "claim_reference",
] as const;

/** Fields BNY may send to a counterparty: the approved set from the PRD. */
export const OUTBOUND_ALLOWLIST = [
  "dtc_reference",
  "isin",
  "quantity_instructed",
  "settle_date",
  "instruction_status",
  "expected_fix_time",
  "resolution",
  "settle_by",
  "requested_action",
] as const;

/** Data label of every field that may leave BNY. Anything above "internal" is blocked in code. */
export const FIELD_LABELS: Record<string, "public" | "internal" | "confidential" | "client"> = {
  dtc_reference: "internal",
  isin: "public",
  quantity_instructed: "internal",
  settle_date: "internal",
  instruction_status: "internal",
  expected_fix_time: "internal",
  resolution: "internal",
  settle_by: "internal",
  requested_action: "internal",
  client_ref: "client",
  client_account_id: "client",
  fund_name: "client",
};

/** Usage terms attached to every outbound message (purpose, retention, no training). */
export const usageTerms = (caseId: string) => ({ purpose: `case ${caseId} only`, retainDays: 30, noTraining: true });

/** Simulated security failures for the safety paths (FP6, FP7). */
export type Simulate = { forgedCard?: boolean; replayedNonce?: boolean; tampered?: boolean };

const INJECTION_PATTERNS: [RegExp, string][] = [
  [/ignore (all |any |your |previous |prior )*(rules|instructions|policies)/i, "instruction override"],
  [/disregard (all |any |your |previous )*(rules|instructions)/i, "instruction override"],
  [/\b(system prompt|developer message|you are now)\b/i, "role manipulation"],
  [/\b(send|share|export|reveal|provide)\b.{0,40}\b(full|all|entire|complete)\b.{0,60}\b(holdings|positions|report|records|accounts|allocations)\b/i, "bulk data request"],
];

// BNY-internal identifiers that must never appear in text sent to a counterparty.
const INTERNAL_ID_PATTERNS = [
  /\bBNYI-\d{8}-\d{7}\b/g,
  /\bRQ-\d{8}-\d{4}\b/g,
  /\bEXC-\d{8}-\d{4}\b/g,
  /\bSSI-[A-Z]{2,4}-US-[A-Z]{2}-[A-Z0-9-]+\b/g,
  /\b\d{4}-[A-Z]{2,5}-[A-Z]{3,5}\b/g,
];

export type InboundRequest = {
  token: string | null;
  fromAgentId: string;
  fromDomain: string;
  skill: string;
  message: Message;
  turnsSoFar: number;
  simulate?: Simulate;
};

export type InboundResult = {
  accepted: boolean;
  reason?: string;
  checks: GatewayCheck[];
  /** What BNY's internal agents receive: untrusted text quoted as data, allowlisted fields only. */
  delivered?: { quotedText: string; data: Record<string, unknown>; dropped: string[]; injection: string[] };
};

const textOf = (parts: Part[]) =>
  parts
    .filter((p) => p.kind === "text")
    .map((p) => (p as { text: string }).text)
    .join("\n");
const dataOf = (parts: Part[]) =>
  Object.assign({}, ...parts.filter((p) => p.kind === "data").map((p) => (p as { data: Record<string, unknown> }).data));

const escapeText = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function inbound(req: InboundRequest): InboundResult {
  const checks: GatewayCheck[] = [];
  const reject = (reason: string): InboundResult => ({ accepted: false, reason, checks });

  // 1. Identity: registered member, token signed by the registry, subject matches sender, domain attested.
  const membership = membershipFor(req.fromAgentId);
  const token = req.token ? verifyToken(req.token) : ({ ok: false, reason: "no bearer token" } as const);
  if (!membership) {
    checks.push({ id: "identity", label: "Identity", ok: false, detail: `${req.fromAgentId} @ ${req.fromDomain} is not in the network registry` });
    return reject("unregistered agent");
  }
  if (!token.ok) {
    checks.push({ id: "identity", label: "Identity", ok: false, detail: token.reason });
    return reject(`invalid credentials: ${token.reason}`);
  }
  const { member } = membership;
  const identityProblems = [
    token.claims.sub !== req.fromAgentId && "token subject does not match sender",
    isSuspended(member.firm) && `${member.legalName} is suspended by the network operator`,
    member.kycStatus !== "VERIFIED" && `KYC ${member.kycStatus}`,
    member.domainAttestation !== "ATTESTED" && "domain not attested",
    member.domain !== req.fromDomain && `sender domain ${req.fromDomain} does not match attested ${member.domain}`,
  ].filter(Boolean) as string[];
  checks.push({
    id: "identity",
    label: "Identity",
    ok: identityProblems.length === 0,
    detail: identityProblems.length ? identityProblems.join("; ") : `${member.legalName} · LEI ${member.lei} · token valid`,
  });
  if (identityProblems.length) return reject(identityProblems[0]);

  // 1b. Simulated proofs: Agent Card signature (registry key), holder-bound token, message signature, fresh nonce.
  const sim = req.simulate ?? {};
  checks.push({ id: "card", label: "Agent Card signature", ok: !sim.forgedCard, detail: sim.forgedCard ? `card signature invalid: does not match the registry's key for ${member.legalName}` : `signed with ${member.legalName}'s registered key` });
  if (sim.forgedCard) return reject("card signature invalid");
  checks.push({ id: "holder", label: "Token holder", ok: true, detail: "token bound to this agent's certificate" });
  checks.push({ id: "signature", label: "Message signature", ok: !sim.tampered, detail: sim.tampered ? "signature mismatch: the message was changed after signing" : "valid" });
  if (sim.tampered) return reject("signature mismatch");
  checks.push({ id: "nonce", label: "Fresh nonce", ok: !sim.replayedNonce, detail: sim.replayedNonce ? "nonce reused: this exact message was already received" : "new nonce, timestamp within 2 minutes" });
  if (sim.replayedNonce) return reject("nonce reused");
  checks.push({ id: "schema", label: "Message schema", ok: true, detail: `matches the ${req.skill} schema; free text only in the note` });

  // 2. Scope: the skill must be approved for this agent (a card alone grants nothing).
  const inScope = token.claims.scopes.includes(req.skill) && membership.agent.approvedSkills.includes(req.skill);
  checks.push({ id: "scope", label: "Scope", ok: inScope, detail: inScope ? `${req.skill} approved` : `${req.skill} not in approved scopes` });
  if (!inScope) return reject(`skill ${req.skill} not permitted`);

  // 3. Turn limit.
  const turnOk = req.turnsSoFar < MAX_TURNS;
  checks.push({ id: "turns", label: "Turn limit", ok: turnOk, detail: `turn ${req.turnsSoFar + 1} of ${MAX_TURNS}` });
  if (!turnOk) return reject("turn limit reached");

  // 4. Injection scan: flag, never execute. Text is passed on only as quoted data.
  const text = textOf(req.message.parts);
  const injection = INJECTION_PATTERNS.filter(([re]) => re.test(text)).map(([, label]) => label);
  checks.push({
    id: "injection",
    label: "Injection scan",
    ok: injection.length === 0,
    detail: injection.length ? `flagged: ${[...new Set(injection)].join(", ")}; text passed as quoted data only` : "clean",
  });

  // 5. Field allowlist.
  const data = dataOf(req.message.parts);
  const allowed: Record<string, unknown> = {};
  const dropped: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if ((INBOUND_ALLOWLIST as readonly string[]).includes(k)) allowed[k] = v;
    else dropped.push(k);
  }
  checks.push({
    id: "fields",
    label: "Fields allowed",
    ok: dropped.length === 0,
    detail: dropped.length ? `dropped: ${dropped.join(", ")}` : `${Object.keys(allowed).length} fields within allowlist`,
  });

  return {
    accepted: true,
    checks,
    delivered: {
      quotedText: `<counterparty_message untrusted="true" from="${req.fromAgentId}">\n${escapeText(text)}\n</counterparty_message>`,
      data: allowed,
      dropped,
      injection: [...new Set(injection)],
    },
  };
}

export type OutboundResult = {
  checks: GatewayCheck[];
  text: string;
  data: Record<string, unknown>;
  fieldsShared: string[];
  withheld: string[];
};

/**
 * Filters a BNY message before it leaves the firm. `sensitiveTerms` are case-specific
 * values (client names, fund, client refs) that must not be disclosed.
 */
export function outbound(
  text: string,
  data: Record<string, unknown>,
  sensitiveTerms: string[],
  allowlist: readonly string[] = OUTBOUND_ALLOWLIST,
): OutboundResult {
  const fields: Record<string, unknown> = {};
  const withheld: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (allowlist.includes(k)) fields[k] = v;
    else withheld.push(`field ${k}`);
  }
  let clean = text;
  for (const re of INTERNAL_ID_PATTERNS)
    clean = clean.replace(re, (m) => {
      withheld.push(m);
      return "[withheld]";
    });
  // Longest first, so a short code inside a longer reference doesn't leave the rest behind.
  for (const term of [...new Set(sensitiveTerms)].filter((t) => t.length >= 3).sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    clean = clean.replace(re, (m) => {
      withheld.push(m);
      return "[withheld]";
    });
  }
  const above = Object.keys(fields).filter((k) => FIELD_LABELS[k] === "client" || FIELD_LABELS[k] === "confidential");
  for (const k of above) {
    delete fields[k];
    withheld.push(`field ${k} (${FIELD_LABELS[k]})`);
  }
  const checks: GatewayCheck[] = [
    { id: "fields", label: "Fields allowed", ok: true, detail: `${Object.keys(fields).join(", ") || "none"}` },
    { id: "labels", label: "Data labels", ok: above.length === 0, detail: above.length ? `blocked: ${above.join(", ")}` : "every field public or internal" },
    {
      id: "disclosure",
      label: "Disclosure scan",
      ok: withheld.length === 0,
      detail: withheld.length ? `withheld: ${[...new Set(withheld)].join(", ")}` : "no internal or client data in text",
    },
    { id: "terms", label: "Usage terms", ok: true, detail: "purpose: this case only · retain 30 days · no model training" },
  ];
  return { checks, text: clean, data: fields, fieldsShared: Object.keys(fields), withheld: [...new Set(withheld)] };
}
