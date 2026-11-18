import { describe, expect, it } from "vitest";
import { scopeFor, ScopeViolationError } from "../lib/data/scope";
import { findOpenDkFails, loadGsCase } from "../lib/tools/goldman";
import { investigateDelivery } from "../lib/tools/bny";
import { Run } from "../lib/engine/run";
import { Budget } from "../lib/llm/budget";
import { ACTORS } from "../lib/agents/shared";

describe("DataScope isolation", () => {
  it("a Goldman agent cannot read any BNY file", () => {
    const gs = scopeFor("goldman");
    for (const t of ["bny/settlement_instructions", "bny/repair_queue", "bny/ssi_counterparties", "bny/client_accounts"] as const)
      expect(() => gs.read(t)).toThrow(ScopeViolationError);
    expect(() => gs.read("allianzgi/allocations")).toThrow(ScopeViolationError);
    expect(gs.canRead("bny/positions")).toBe(false);
  });

  it("a BNY agent cannot read Goldman or AllianzGI files", () => {
    const bny = scopeFor("bny");
    expect(() => bny.read("goldman/fails")).toThrow(ScopeViolationError);
    expect(() => bny.read("allianzgi/orders")).toThrow(ScopeViolationError);
  });

  it("each scope sees only its own participant's DTC rows", () => {
    const gsRows = scopeFor("goldman").read("dtc/settlement_activity");
    expect(gsRows.length).toBeGreaterThan(0);
    expect(gsRows.every((e) => e.deliverer_participant === "0005" || e.receiver_participant === "0005")).toBe(true);
    const bnyRows = scopeFor("bny").read("dtc/settlement_activity");
    expect(bnyRows.every((e) => e.deliverer_participant === "0901" || e.receiver_participant === "0901")).toBe(true);
    expect(() => scopeFor("allianzgi").read("dtc/settlement_activity")).toThrow(ScopeViolationError);
  });

  it("docs are per firm", () => {
    expect(scopeFor("goldman").docs().every((d) => !d.name.includes("repair_queue_runbook"))).toBe(true);
    expect(scopeFor("bny").doc("repair_queue_runbook")).toBeDefined();
  });
});

describe("golden case is found by querying, not hard-coding", () => {
  const run = new Run("golden", "mock", "test", new Budget(0.2, "t"));
  it("Goldman finds its open DK fail and records", () => {
    const ctx = { run, scope: scopeFor("goldman"), actor: ACTORS.gsMonitorRule };
    const [top] = findOpenDkFails(ctx);
    expect(top.fail.gs_fail_id).toBe("GS-FAIL-20261119-0091");
    const c = loadGsCase(ctx, top.fail, top.delivery);
    expect(c.delivery.dtc_reference).toBe("DTC-DO-20261119-000318");
    expect(c.allocation.quantity).toBe(10000);
    expect(c.allocation.version).toBe(2);
  });

  it("BNY resolves the delivery to the client's live 8,000 instruction with no amendment on file, not the near-miss", () => {
    const ctx = { run, scope: scopeFor("bny"), actor: ACTORS.bnyCaseRule };
    const c = investigateDelivery(ctx, { dtcReference: "DTC-DO-20261119-000318", isin: "US67066G1040", settleDate: "2026-11-19" })!;
    expect(c.instruction.instruction_id).toBe("BNYI-20261118-5527301");
    expect(c.instruction.quantity).toBe(8000);
    expect(c.instruction.source_channel).toBe("SWIFT_MT541");
    expect(c.amendment).toBeUndefined();
    expect(c.ssi?.ssi_id).toBe("SSI-GS-US-EQ-0005");
    expect(c.records.some((r) => r.id === "BNYI-20261118-5527388")).toBe(false);
  });
});
