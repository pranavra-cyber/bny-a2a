import { describe, expect, it } from "vitest";
import { DRILLS } from "../lib/drillCatalog";
import { runDrill, runDrills } from "../lib/drills";
import { isSuspended } from "../lib/a2a/registry";

const failedCheck = (id: Parameters<typeof runDrill>[0]) => runDrill(id).checks.find((c) => !c.ok);

describe("drills", () => {
  it("covers every catalogued drill once, in order", () => {
    expect(runDrills().map((r) => r.id)).toEqual(DRILLS.map((d) => d.id));
  });

  it("real drills are refused by the gateway for the stated reason", () => {
    expect(runDrill("expired").reason).toContain("token expired");
    expect(runDrill("rotated").reason).toContain("signature not issued by network registry");
    expect(runDrill("suspended").reason).toContain("suspended by the network operator");
    expect(failedCheck("turns")!.id).toBe("turns");
  });

  it("a suspension is lifted again, so the live demo is unaffected", () => {
    runDrill("suspended");
    expect(isSuspended("goldman")).toBe(false);
  });

  it("the simulated drill stops at the nonce check, and the illustrative one runs nothing", () => {
    expect(failedCheck("retry")!.id).toBe("nonce");
    const t = runDrill("timeout");
    expect(t.accepted).toBeUndefined();
    expect(t.checks).toEqual([]);
  });

  it("only drills the prototype runs are tagged real", () => {
    for (const d of DRILLS) expect(d.reality === "real", d.id).toBe(runDrill(d.id).accepted === false && d.id !== "retry");
  });
});
