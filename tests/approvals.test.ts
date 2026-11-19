import { describe, expect, it } from "vitest";
import { auditCsv, AUDIT_COLUMNS } from "../lib/engine/audit";
import { startRun } from "../lib/engine/start";
import { MockClient, type ModelClient, type ModelRequest } from "../lib/llm/client";
import { validateFindings } from "../lib/tools/grounding";
import { scopeFor } from "../lib/data/scope";
import { runToEnd } from "./helpers";

const settle = () => new Promise((r) => setTimeout(r, 30));

describe("people approve every step that matters", () => {
  it("nothing goes to the client before Client Service approves, and no redelivery before GS ops approves", async () => {
    const run = startRun("golden", "mock", { fast: true });
    for (let i = 0; i < 100 && !run.pendingApprovals.includes("bny-client-message"); i++) await settle();
    expect(run.pendingApprovals).toEqual(["bny-client-message"]);
    expect(run.events.some((e) => e.title.startsWith("Email sent to Emily Carter"))).toBe(false);
    run.decide("bny-client-message", "approved", "Daniel Kim");
    for (let i = 0; i < 100 && !run.pendingApprovals.includes("gs-redelivery"); i++) await settle();
    expect(run.events.some((e) => e.title.startsWith("Email sent to Emily Carter"))).toBe(true);
    expect(run.events.some((e) => e.title.startsWith("Client's corrected instruction received"))).toBe(true);
    expect(run.events.some((e) => e.title.startsWith("Redelivered"))).toBe(false);
    run.decide("gs-redelivery", "approved", "Michael Torres");
    for (let i = 0; i < 100 && run.status !== "settled"; i++) await settle();
    expect(run.status).toBe("settled");
    expect(run.clock.iso).toBe("2026-11-19T16:17:00.000Z"); // 11:17 ET
  });

  it("BNY never changes the client's instruction itself: the client's MT541 replaces it", async () => {
    const run = await runToEnd("golden");
    const applied = run.audit.find((a) => a.action === "apply client instruction")!;
    expect(applied.decision).toContain("BNYI-20261119-5531207");
    expect(run.overlay.get("bny/settlement_instructions#BNYI-20261118-5527301")?.status).toBe("CANCELLED");
  });

  it("a rejected client message escalates and the client is never contacted", async () => {
    const run = await runToEnd("golden", { "bny-client-message": "rejected" });
    expect(run.status).toBe("escalated");
    expect(run.statusReason).toBe("rejected-by-human");
    expect(run.events.some((e) => e.title.startsWith("Email sent to Emily Carter"))).toBe(false);
  });

  it("a late re-instruction (FP5) needs Priya's exception before Goldman is asked to redeliver", async () => {
    const run = await runToEnd("fp5");
    expect(run.status).toBe("settled");
    const ex = run.events.find((e) => e.kind === "approval" && e.decision?.kind === "bny-late-exception");
    expect(ex?.decision?.by).toBe("Priya Sharma");
    const redeliverAsk = run.events.findIndex((e) => e.title === "To Goldman: instruction updated, please redeliver");
    expect(redeliverAsk).toBeGreaterThan(run.events.indexOf(ex!));
  });

  it("a refused late exception leaves the trade to fail overnight", async () => {
    const run = await runToEnd("fp5", { "bny-late-exception": "rejected" });
    expect(run.status).toBe("escalated");
    expect(run.events.some((e) => e.title.startsWith("Redelivered"))).toBe(false);
  });
});

class Tampered implements ModelClient {
  readonly kind = "mock" as const;
  private inner = new MockClient();
  constructor(private edit: (schema: string, out: Record<string, unknown>) => void) {}
  async create(req: ModelRequest) {
    const res = await this.inner.create(req);
    const out = JSON.parse(res.text);
    this.edit(req.schemaName, out);
    return { ...res, text: JSON.stringify(out) };
  }
}

describe("grounding", () => {
  const bny = scopeFor("bny");
  it("accepts a citation that matches a real row", () => {
    const r = validateFindings(bny, [{ claim: "x", sourceRecords: [{ table: "ssi_counterparties", id: "SSI-GS-US-EQ-0005", fields: [{ name: "dtc_participant", value: "0005" }, { name: "status", value: "ACTIVE" }] }] }]);
    expect(r.ok).toBe(true);
    expect(r.resolved[0].row.counterparty_name).toBe("Goldman Sachs & Co. LLC");
  });
  it("rejects wrong values, missing rows, other firms' tables and uncited claims", () => {
    const bad = validateFindings(bny, [
      { claim: "a", sourceRecords: [{ table: "ssi_counterparties", id: "SSI-GS-US-EQ-0005", fields: [{ name: "dtc_participant", value: "7108" }] }] },
      { claim: "b", sourceRecords: [{ table: "settlement_instructions", id: "BNYI-00000000-0000000", fields: [] }] },
      { claim: "c", sourceRecords: [{ table: "goldman/fails", id: "GS-FAIL-20261119-0091", fields: [] }] },
      { claim: "d", sourceRecords: [] },
    ]);
    expect(bad.ok).toBe(false);
    expect(bad.problems).toHaveLength(4);
  });
  it("a misquoted finding escalates the run", async () => {
    const client = new Tampered((schema, out) => {
      if (schema === "bny_case_triage") (out.findings as { sourceRecords: { fields: { value: string }[] }[] }[])[1].sourceRecords[0].fields[0].value = "10000";
    });
    const run = await runToEnd("golden", {}, client);
    expect(run.status).toBe("escalated");
    expect(run.statusReason).toBe("grounding");
  });
  it("a triage that blames anyone but the client is stopped before the hand-over", async () => {
    const client = new Tampered((schema, out) => {
      if (schema === "bny_case_triage") out.mustAct = "bny";
    });
    const run = await runToEnd("golden", {}, client);
    expect(run.status).toBe("escalated");
    expect(run.events.some((e) => e.kind === "approval-request")).toBe(false);
  });
});

describe("audit", () => {
  it("lists accesses and decisions and exports CSV", async () => {
    const run = await runToEnd("golden");
    expect(run.audit.some((a) => a.dataAccessed.includes("bny/settlement_instructions#BNYI-20261118-5527301"))).toBe(true);
    expect(run.audit.some((a) => a.action === "review bny-client-message" && a.approver === "Daniel Kim")).toBe(true);
    expect(run.audit.some((a) => a.decision.includes("usage terms attached"))).toBe(true);
    expect(run.audit.some((a) => a.fieldsShared.includes("quantity_instructed"))).toBe(true);
    const csv = auditCsv(run.audit).split("\n");
    expect(csv[0]).toBe(AUDIT_COLUMNS.join(","));
    expect(csv.length).toBe(run.audit.length + 2);
  });
});

describe("grounding robustness", () => {
  it("a citation to a table that does not exist is a problem, not a crash", () => {
    const r = validateFindings(scopeFor("bny"), [{ claim: "x", sourceRecords: [{ table: "counterpartyConfirmation", id: "1", fields: [] }] }]);
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain("not a table");
  });
});
