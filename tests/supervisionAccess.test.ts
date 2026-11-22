import { describe, expect, it } from "vitest";
import { PERSONAS, supervisionAccess } from "../lib/personas";

describe("who may open Supervision", () => {
  it("Priya is live; Sarah is read-only only after the case closes", () => {
    expect(supervisionAccess("sharma", "running")).toBe("live");
    expect(supervisionAccess("nguyen", "running")).toBe("waiting-for-close");
    expect(supervisionAccess("nguyen", undefined)).toBe("waiting-for-close");
    for (const s of ["settled", "escalated"] as const) expect(supervisionAccess("nguyen", s)).toBe("read-only");
  });

  it("nobody else gets it: not Michael Torres, the client side, the attackers, Daniel or David", () => {
    for (const p of PERSONAS.filter((p) => p.id !== "sharma" && p.id !== "nguyen"))
      for (const s of ["running", "settled", undefined] as const) expect(supervisionAccess(p.id, s), `${p.id} ${s}`).toBeNull();
  });
});
