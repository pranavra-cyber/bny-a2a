// Runs the drills that can be run against BNY's real gateway and registry. Deterministic, no model
// calls. A suspension is applied and lifted inside one synchronous call, so no other request can
// observe it.
import "server-only";
import { issueToken } from "./a2a/auth";
import { inbound, MAX_TURNS, type Simulate } from "./a2a/gateway";
import { reinstateFirm, suspendFirm, tokenFor } from "./a2a/registry";
import type { Message } from "./a2a/types";
import { DRILLS, type DrillId, type DrillRun } from "./drillCatalog";

const SKILL = "settlement.status";
const CLAIMS = { sub: "gs-outreach", clientId: "gs-outreach-01", firm: "goldman", scopes: ["settlement.dk-inquiry", "settlement.status", "settlement.redelivery-notice"] };

const send = (token: string | null, o: { turns?: number; simulate?: Simulate } = {}) => {
  const message: Message = {
    messageId: "drill",
    taskId: "drill",
    contextId: "drill",
    role: "user",
    parts: [{ kind: "text", text: "Status check on DTC-DO-20261119-000318." }, { kind: "data", data: { dtc_reference: "DTC-DO-20261119-000318" } }],
    metadata: { from: "gs-outreach", to: "bny-gateway", skill: SKILL, sentAt: new Date().toISOString(), sourceRecords: [] },
  };
  const r = inbound({ token, fromAgentId: "gs-outreach", fromDomain: "gs.example", skill: SKILL, message, turnsSoFar: o.turns ?? 0, simulate: o.simulate });
  return { accepted: r.accepted, reason: r.reason, checks: r.checks };
};

export function runDrill(id: DrillId): DrillRun {
  switch (id) {
    case "expired":
      return { id, ...send(issueToken(CLAIMS, -60)) };
    case "rotated":
      return { id, ...send(issueToken(CLAIMS, 3600, "the-previous-registry-key")) };
    case "suspended": {
      suspendFirm("goldman");
      try {
        return { id, ...send(tokenFor("gs-outreach")) };
      } finally {
        reinstateFirm("goldman");
      }
    }
    case "turns":
      return { id, ...send(tokenFor("gs-outreach"), { turns: MAX_TURNS }) };
    case "retry":
      return { id, ...send(tokenFor("gs-outreach"), { simulate: { replayedNonce: true } }) };
    case "timeout":
      return { id, checks: [] };
  }
}

export const runDrills = (): DrillRun[] => DRILLS.map((d) => runDrill(d.id));
