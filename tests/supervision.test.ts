import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { INBOUND_ALLOWLIST, OUTBOUND_ALLOWLIST } from "../lib/a2a/gateway";
import { PHASES, resolveStep, SUPERVISION, type SupervisedScenario, type SupervisionStep } from "../lib/engine/supervision";
import { runToEnd } from "./helpers";

const SCENARIOS = Object.keys(SUPERVISION) as SupervisedScenario[];

// A firm's own data: its directory plus the DTC feed it receives.
const DIRS: Record<string, string[]> = { bny: ["bny", "dtc"], goldman: ["goldman", "dtc"] };
const dataFor = (lane: string) => {
  const files = (DIRS[lane] ?? []).flatMap((d) => readdirSync(path.join("data", d)).filter((f) => f.endsWith(".csv")).map((f) => ({ name: f.replace(/\.csv$/, ""), text: readFileSync(path.join("data", d, f), "utf8") })));
  return { names: new Set(files.map((f) => f.name)), headers: new Set(files.flatMap((f) => f.text.split("\n", 1)[0].split(","))), text: files.map((f) => f.text).join("\n") };
};

describe("supervision scripts", () => {
  it("cover golden, fp3, fp4 and fp5", () => {
    expect(SCENARIOS.sort()).toEqual(["fp3", "fp4", "fp5", "golden"]);
  });

  it("phases run in order (a script may end with an escalation handoff after compose)", () => {
    for (const s of SCENARIOS) {
      const phases = SUPERVISION[s].map((x) => x.phase);
      const body = phases.at(-1) === "handoff" && phases.at(-2) === "compose" ? phases.slice(0, -1) : phases;
      const ranks = body.map((p) => PHASES.indexOf(p));
      expect(ranks, s).toEqual([...ranks].sort((a, b) => a - b));
      expect(phases[0], s).toBe("think");
    }
  });

  it("the golden script is the agreed seven steps", () => {
    expect(SUPERVISION.golden.map((x) => x.phase)).toEqual(["think", "retrieve", "retrieve", "retrieve", "merge", "handoff", "compose"]);
    expect(SUPERVISION.golden[0].text).toMatch(/^New DK inquiry from Goldman on DTC-DO-20261119-000318\./);
    expect(SUPERVISION.golden[6].text).toContain("{shared}");
  });

  it("every concrete value a step cites is present in that firm's data", () => {
    const check = (step: SupervisionStep) => {
      const d = dataFor(step.lane);
      expect(d.text.length, `no data for lane ${step.lane}`).toBeGreaterThan(0);
      for (const id of step.text.match(/[A-Z0-9]+(?:-[A-Z0-9…]+)+/g) ?? []) {
        const needle = id.includes("…") ? id.split("…")[1] : id;
        expect(d.text, `${id}: ${step.text}`).toContain(needle);
      }
      for (const p of step.text.match(/\b0\d{3}\b/g) ?? []) expect(d.text, p).toMatch(new RegExp(`(^|,)${p}(,|$)`, "m"));
      for (const n of step.text.match(/\b\d{1,3}(?:,\d{3})+\b/g) ?? []) expect(d.text, n).toMatch(new RegExp(`,${n.replace(/,/g, "")},`));
      for (const t of step.text.match(/\b[a-z]+(?:_[a-z]+)+\b/g) ?? [])
        expect(d.names.has(t) || d.headers.has(t) || (INBOUND_ALLOWLIST as readonly string[]).includes(t) || (OUTBOUND_ALLOWLIST as readonly string[]).includes(t), `${t} is not a table, column or gateway field`).toBe(true);
      // Statuses and reason codes named in the text.
      for (const w of step.text.match(/\b[A-Z]{2,}(?:_[A-Z]+)+\b/g) ?? []) expect(d.text, w).toContain(w);
    };
    for (const s of SCENARIOS) SUPERVISION[s].forEach(check);
  });
});

describe("supervision against the real run", () => {
  for (const s of SCENARIOS)
    it(`${s}: every anchor is found, compose fields come from the real gateway result, and the end matches the run`, async () => {
      const run = await runToEnd(s);
      const steps = SUPERVISION[s].map((x) => resolveStep(x, run.events));
      for (const r of steps) {
        expect(r.ready, `${s}: ${r.text}`).toBe(true);
        expect(r.text).not.toContain("{");
        if (r.anchor) expect(r.event, r.anchor).toBeDefined();
      }
      const compose = steps.find((x) => x.phase === "compose")!;
      expect(compose.shared!.length).toBeGreaterThan(0);
      for (const f of compose.shared!) {
        expect(OUTBOUND_ALLOWLIST).toContain(f);
        expect(compose.text).toContain(f);
      }
      // The shared fields are exactly what the outbound gateway event carried.
      const gateway = run.events.slice(run.events.indexOf(compose.event!) + 1).find((e) => e.kind === "gateway")!;
      const sent = ((gateway.envelope as { params: { message: { parts: { kind: string; data?: object }[] } } }).params.message.parts.find((p) => p.kind === "data")?.data ?? {}) as Record<string, unknown>;
      expect(compose.shared).toEqual(Object.keys(sent));
      if (s === "golden") expect(run.status).toBe("settled");
      if (s === "fp3") expect(run.events.find((e) => e.kind === "escalation" && e.lane === "bny")?.escalation?.reason).toBe("unverified-claim");
      if (s === "fp4") expect(run.events.find((e) => e.kind === "escalation" && e.lane === "bny")?.escalation?.reason).toBe("time-limit");
    });

  it("an unreached anchor is not ready, so a live view reveals the step only when the run gets there", () => {
    const r = resolveStep(SUPERVISION.golden[6], []);
    expect(r.ready).toBe(false);
    expect(r.shared).toBeUndefined();
  });
});
