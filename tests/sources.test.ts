import { describe, expect, it } from "vitest";
import { sourceOf } from "@/lib/data/sources";
import { startRun } from "@/lib/engine/start";

describe("data sources", () => {
  it("every record the agents use names its source file and version", async () => {
    const run = startRun("golden", "mock", { fast: true, autoApprove: true });
    await new Promise<void>((resolve) => run.subscribe(() => ["settled", "escalated", "failed"].includes(run.status) && resolve()));
    const records = run.events.flatMap((e) => [...(e.records ?? []), ...(e.approval?.evidence ?? [])]);
    expect(records.length).toBeGreaterThan(5);
    const missing = [...new Set(records.filter((r) => !sourceOf(r.table, r.id)).map((r) => `${r.table}#${r.id}`))];
    expect(missing).toEqual([]);
  });
});
