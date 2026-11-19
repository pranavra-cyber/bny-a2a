// Goldman's application to join BNY's closed network, checked one step at a time
// against BNY's own reference data, the public DTC directory and the registry.
// Deterministic, no model calls. A walkthrough: it never changes the live registry.
// The agreement, SWIFT, certificate and link-test steps are simulated.
import "server-only";
import crypto from "node:crypto";
import { issueToken, verifyToken } from "./a2a/auth";
import { cardById, membershipFor, SKILLS } from "./a2a/registry";
import { scopeFor } from "./data/scope";
import { ONBOARDING_STAGES, type OnboardingStage, PERMISSIONS, type Problem } from "./onboardingGuide";

export type Application = {
  legalName: string;
  lei: string;
  dtcParticipant: string;
  domain: string;
  domainProofPublished: boolean;
  kycStatus: string;
  agentId: string;
  agentName: string;
  requestedSkills: string[];
};

export type CheckResult = {
  stage: OnboardingStage;
  ok: boolean;
  /** Plain language: what is checked, why it matters, what was found. */
  what: string;
  why: string;
  result: string;
  /** Set when the check failed for a reason the applicant can fix. */
  problem?: Problem;
  technical: { source: string; detail: Record<string, string> };
};

/** The extra permission the application asks for; it would let the agent read instruction details. */
export const RISKY_SKILL = "settlement.instruction-details";

// The flawed application: two characters of the LEI swapped, and a new agent web address without proof.
const typo = (lei: string) => lei.slice(0, 10) + lei[11] + lei[10] + lei.slice(12);
const FLAWED_DOMAIN = "gs-agents.example";

/** The application as submitted: two problems, each fixed once Goldman resubmits. */
export function applicationFor(fixes: Problem[] = []): Application {
  const m = membershipFor("gs-outreach");
  if (!m) throw new Error("Goldman is not in the registry");
  const { member, agent } = m;
  const app: Application = {
    legalName: member.legalName,
    lei: member.lei,
    dtcParticipant: member.dtcParticipant ?? "",
    domain: member.domain,
    domainProofPublished: member.domainAttestation === "ATTESTED",
    kycStatus: member.kycStatus,
    agentId: agent.agentId,
    agentName: cardById(agent.agentId)?.name ?? agent.agentId,
    requestedSkills: [SKILLS.dkInquiry, SKILLS.status, SKILLS.redeliveryNotice, RISKY_SKILL],
  };
  if (!fixes.includes("lei")) app.lei = typo(app.lei);
  if (!fixes.includes("domain")) {
    app.domain = FLAWED_DOMAIN;
    app.domainProofPublished = false;
  }
  return app;
}

const plainSkill = (id: string) => PERMISSIONS.find((p) => p.id === id)?.label ?? id;

/** Goldman's agent BIC, from BNY's active SSI. */
export const agentBicFor = () => scopeFor("bny").read("bny/ssi_counterparties").find((x) => x.counterparty_name === "Goldman Sachs & Co. LLC" && x.status === "ACTIVE")?.agent_bic ?? "";

const AUTH_SERVER = "https://auth.bny.example";
const GATEWAY_AUDIENCE = "eliza-gateway.bny.example";
/** BNY generates the client ID once, at registration. */
const clientIdFor = (app: Application) => `${app.agentId}-${crypto.createHash("sha256").update(`client:${app.agentId}`).digest("hex").slice(0, 4)}`;

export function runCheck(app: Application, stage: OnboardingStage, approvedSkills: string[] = [], passMinutes = 10): CheckResult {
  const bny = scopeFor("bny");
  const copy = ONBOARDING_STAGES.find((s) => s.id === stage)!;
  const base = { stage, what: copy.what, why: copy.why };
  const fp = (x: string) => crypto.createHash("sha256").update(x).digest("hex").replace(/(..)(?!$)/g, "$1:").slice(0, 47).toUpperCase();
  switch (stage) {
    case "agreement":
      return {
        ...base,
        ok: true,
        result: "Signed. Goldman accepted BNY's agent data-sharing terms: data is used for the named case only, kept 30 days, never used to train models. Accountable: Priya Sharma (BNY Settlement Ops) and Michael Torres's desk lead (Goldman fails).",
        technical: { source: "agent agreement register (simulated)", detail: { agreement: "A2A-DSA-GS-2026-014", purpose: "case only", retain_days: "30", no_training: "true" } },
      };
    case "ssi": {
      const ssis = bny.read("bny/ssi_counterparties").filter((x) => x.counterparty_lei === app.lei && x.market === "US" && x.asset_class === "EQUITY");
      const active = ssis.filter((x) => x.status === "ACTIVE");
      const old = ssis.filter((x) => x.status !== "ACTIVE");
      const one = active.length === 1 && active[0].dtc_participant === app.dtcParticipant && !!active[0].verification_date;
      return {
        ...base,
        ok: one,
        result: one
          ? `One active, verified SSI: ${active[0].ssi_id}, DTC account ${active[0].dtc_participant}, verified ${active[0].verification_date}. ${old.length ? `${old.map((o) => `${o.ssi_id} (account ${o.dtc_participant}, ${o.status.toLowerCase()})`).join(", ")} is out of date and won't be used.` : ""}`
          : `Not confirmed: ${active.length} active SSI(s) for US equities, none matching DTC account ${app.dtcParticipant}.`,
        technical: { source: "bny/ssi_counterparties", detail: { active: active.map((a) => a.ssi_id).join(", ") || "none", superseded: old.map((o) => o.ssi_id).join(", ") || "none", agent_bic: active[0]?.agent_bic ?? "" } },
      };
    }
    case "swift": {
      const bic = bny.read("bny/ssi_counterparties").find((x) => x.counterparty_lei === app.lei && x.status === "ACTIVE")?.agent_bic;
      return {
        ...base,
        ok: Boolean(bic),
        result: bic
          ? `Confirmed. BNY and ${bic} have an authorised SWIFT relationship, and a test MT599 was acknowledged. If the agent link is down, the case falls back to SWIFT and email.`
          : "No agent BIC on file, so the SWIFT link can't be confirmed.",
        technical: { source: "SWIFT relationship management (simulated)", detail: { counterparty_bic: bic ?? "none", bny_bic: "SYNIRVUS33XXX", rma: bic ? "AUTHORISED" : "none", test_message: bic ? "MT599 ACK" : "" } },
      };
    }
    case "identity": {
      const certFp = fp(`cert:${app.agentId}`);
      const keyFp = fp(`key:${app.lei}`);
      return {
        ...base,
        ok: true,
        result: `Certificate issued, Goldman's signing key registered, and the Agent Card for "${app.agentName}" verifies against it. The gateway now rejects any card or message not signed with this key.`,
        technical: { source: "registry PKI (simulated: Ed25519)", detail: { certificate_subject: `CN=${app.agentId}, O=${app.legalName}`, certificate_fingerprint: certFp, signing_key: `ed25519 ${keyFp.slice(0, 23)}`, card_signature: "valid", revocation: "not revoked" } },
      };
    }
    case "credentials": {
      // Registered once: a client ID bound to the certificate. The pass itself is fetched per call.
      const clientId = clientIdFor(app);
      const certFp = fp(`cert:${app.agentId}`);
      const token = issueToken({ sub: app.agentId, clientId, firm: "goldman", scopes: [] }, passMinutes * 60);
      const v = verifyToken(token);
      const pass = v.ok
        ? { iss: AUTH_SERVER, sub: clientId, aud: GATEWAY_AUDIENCE, iat: v.claims.iat, exp: v.claims.exp, jti: crypto.randomUUID(), cnf: { "x5t#S256": Buffer.from(certFp.replace(/:/g, ""), "hex").toString("base64url").slice(0, 22) } }
        : null;
      return {
        ...base,
        ok: v.ok,
        result: v.ok
          ? `Client ID ${clientId} is registered with BNY's auth server and tied to the agent's certificate. A test pass was issued for the Eliza gateway, valid ${passMinutes} minutes, carrying no permissions (certificate binding is simulated): the gateway reads those from the registry on every request.`
          : `The test pass failed its own check (${v.reason}).`,
        technical: {
          source: "BNY auth server (simulated: OAuth 2.0 client credentials; mTLS and certificate binding are not run in this prototype)",
          detail: {
            client_id: clientId,
            certificate_subject: `CN=${app.agentId}, O=${app.legalName}`,
            certificate_fingerprint: certFp,
            token_endpoint: `${AUTH_SERVER}/oauth2/token · mTLS in production, not run in this prototype`,
            grant_type: "client_credentials (machine to machine)",
            audience: GATEWAY_AUDIENCE,
            pass_lifetime: `${passMinutes} minutes`,
            test_pass: pass ? JSON.stringify(pass, null, 2) : "",
          },
        },
      };
    }
    case "test": {
      // The agent does what it will do before every call: fetch a fresh, minutes-long token.
      const granted = approvedSkills.filter((s) => app.requestedSkills.includes(s));
      const token = issueToken({ sub: app.agentId, clientId: clientIdFor(app), firm: "goldman", scopes: granted }, passMinutes * 60);
      const v = verifyToken(token);
      return {
        ...base,
        ok: v.ok,
        result: v.ok
          ? `The agent fetched a fresh access pass from BNY's auth server (valid ${passMinutes} minutes, ${granted.length} permission${granted.length === 1 ? "" : "s"}, certificate binding simulated), and its test message passed every gateway check (registered, card signature, token holder, message signature, fresh nonce, schema, scope). "${app.agentName}" is live in the network directory. If it gets stuck: Priya Sharma (BNY) and the Goldman fails desk lead.`
          : `The test token failed its own check (${v.reason}).`,
        technical: {
          source: "auth server and gateway test harness (simulated)",
          detail: v.ok
            ? { client_id: clientIdFor(app), pass_lifetime: `${passMinutes} minutes, fetched per call`, scopes: v.claims.scopes.join(", "), test_message: "settlement.status ping", checks: "8 of 8 passed", listed: app.agentId, escalation_contacts: "BNY Settlement Ops lead; GS fails desk lead" }
            : { reason: v.reason },
        },
      };
    }
    case "application":
      return {
        ...base,
        ok: true,
        result: `${app.legalName} wants to connect its agent "${app.agentName}" so it can contact BNY about failed trades. It asks for ${app.requestedSkills.length} permissions: ${app.requestedSkills.map(plainSkill).join("; ")}.`,
        technical: { source: "registry application", detail: { lei: app.lei, dtc_participant: app.dtcParticipant, domain: app.domain, agent_id: app.agentId, requested_skills: app.requestedSkills.join(", ") } },
      };
    case "company": {
      const ssi = bny.read("bny/ssi_counterparties").find((s) => s.counterparty_lei === app.lei && s.status === "ACTIVE");
      const ok = Boolean(ssi) && app.kycStatus === "VERIFIED";
      return {
        ...base,
        ok,
        problem: ssi ? undefined : "lei",
        result: ssi
          ? `Match. BNY already settles trades with ${ssi.counterparty_name}, and our records hold the same company ID. Due-diligence (KYC) is complete.`
          : `No match. The company ID on the application (${app.lei}) is not in BNY's client records, so we can't be sure who is applying.`,
        technical: { source: ssi ? `bny/ssi_counterparties#${ssi.ssi_id}` : "bny/ssi_counterparties", detail: { lei_on_application: app.lei, kyc_status: app.kycStatus, matched_record: ssi?.ssi_id ?? "none" } },
      };
    }
    case "account": {
      const p = bny.read("dtc/participants").find((x) => x.participant_number === app.dtcParticipant);
      return {
        ...base,
        ok: p?.status === "ACTIVE",
        result: p
          ? `${p.participant_name} holds DTC account ${p.participant_number}, and it is ${p.status === "ACTIVE" ? "active" : p.status.toLowerCase()}.`
          : `DTC's directory has no account ${app.dtcParticipant}.`,
        technical: { source: `dtc/participants#${app.dtcParticipant}`, detail: { participant_number: app.dtcParticipant, status: p?.status ?? "not found" } },
      };
    }
    case "domain":
      return {
        ...base,
        ok: app.domainProofPublished,
        problem: app.domainProofPublished ? undefined : "domain",
        result: app.domainProofPublished
          ? `Proven. The code BNY issued is published on ${app.domain}, so the agent really is run by ${app.legalName}.`
          : `Not proven. The agent would run from ${app.domain}, but the code BNY issued hasn't been published there, so anyone could claim that address.`,
        technical: { source: "registry attestation (mock DNS TXT challenge)", detail: { domain: app.domain, txt_record: app.domainProofPublished ? "bny-network-verify=present" : "missing" } },
      };
    case "permissions": {
      const granted = approvedSkills.filter((s) => app.requestedSkills.includes(s));
      const risky = granted.includes(RISKY_SKILL);
      return {
        ...base,
        ok: granted.length > 0,
        result: !granted.length
          ? "No permissions selected. The agent could not send BNY anything."
          : `Granted: ${granted.map(plainSkill).join("; ")}. Anything else, and every message to the client, needs a BNY person's approval.${risky ? " Warning: you granted access to instruction details, which include client information Goldman doesn't need to resolve a fail." : ` Declined: ${app.requestedSkills.filter((s) => !granted.includes(s)).map(plainSkill).join("; ") || "nothing"}.`}`,
        technical: { source: "registry membership", detail: { approved_skills: granted.join(", ") } },
      };
    }
  }
}
