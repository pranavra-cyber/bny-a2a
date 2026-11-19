import { describe, expect, it } from "vitest";
import { ATTACKS } from "@/lib/attackCatalog";
import { runAttack } from "@/lib/attacks";

describe("attack console", () => {
  for (const a of ATTACKS)
    it(`${a.id}: is stopped and leaks nothing about the client`, () => {
      const r = runAttack(a.id);
      expect(r.blocked).toBe(true);
      const returned = JSON.stringify(r.steps.filter((s) => s.kind === "returned"));
      for (const secret of ["4471-AGI-GLEQ", "AllianzGI", "Global Equity", "BNYI-", "Allianz Global", "AGI-ORD"]) expect(returned).not.toContain(secret);
    });
});

describe("stolen pass", () => {
  it("is stopped by the domain check on a genuine, unexpired token, not by expiry", () => {
    const r = runAttack("stolen-pass");
    const identity = r.steps.flatMap((s) => (s.kind === "gateway" ? s.checks ?? [] : [])).find((c) => c.id === "identity")!;
    expect(identity.ok).toBe(false);
    expect(identity.detail).toMatch(/does not match attested/);
    expect(r.outcome).not.toMatch(/minutes/);
  });
});
