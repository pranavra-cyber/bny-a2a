import { describe, expect, it } from "vitest";
import { buildSupervisionLog } from "../components/a2a/supervisionLog";
import { PERSONAS, supervisionAccess } from "../lib/personas";
import { runToEnd } from "./helpers";

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

describe("supervision log", () => {
  for (const s of ["golden", "fp3", "fp4", "fp5"] as const)
    it(`${s}: narration is tagged, real items carry real data, and the log only ever grows`, async () => {
      const run = await runToEnd(s);
      const full = buildSupervisionLog(s, run.events)!;
      expect(full.available).toBe(full.items.length);
      expect(full.items.filter((i) => i.source === "narration").every((i) => i.text && i.phase)).toBe(true);
      expect(full.items.filter((i) => i.source === "run").every((i) => !i.phase)).toBe(true);

      // The compose step's gateway item is the real outbound result.
      const out = full.items.find((i) => i.key.endsWith("-out"))!;
      expect(out.lane).toBe("gateway");
      expect(out.checks!.length).toBeGreaterThan(0);
      expect(out.shared!.length).toBeGreaterThan(0);
      expect(full.items.find((i) => i.key === "in-gate")!.checks!.some((c) => c.id === "identity" && c.ok)).toBe(true);

      // Replaying the run event by event: what has been revealed never changes or shrinks.
      let prev: string[] = [];
      let prevAvail = 0;
      for (let n = 0; n <= run.events.length; n++) {
        const part = buildSupervisionLog(s, run.events.slice(0, n))!;
        const keys = part.items.slice(0, part.available).map((i) => `${i.key}:${i.text ?? ""}`);
        expect(part.available).toBeGreaterThanOrEqual(prevAvail);
        expect(keys.slice(0, prev.length)).toEqual(prev);
        prev = keys;
        prevAvail = part.available;
      }
    });

  it("has no script for scenarios that don't have one", () => {
    expect(buildSupervisionLog("fp2", [])).toBeNull();
  });
});
