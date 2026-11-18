import { describe, expect, it } from "vitest";
import { OUTBOUND_ALLOWLIST, outbound } from "../lib/a2a/gateway";
import { goldmanConsoleData, bnyConsoleData } from "../lib/consoles";
import { project } from "../lib/engine/project";
import type { Run } from "../lib/engine/run";
import { INJECTION_TEXT } from "../lib/engine/scenario";
import type { ProjectedRun, RunEvent } from "../lib/engine/types";
import { runToEnd } from "./helpers";

const BNY_ONLY = [/BNYI-\d{8}-\d{7}/, /RQ-\d{8}-\d{4}/, /EXC-\d{8}-\d{4}/, /SSI-[A-Z]{2,4}-US-/, /4471-AGI-GLEQ/, /AGI-GLEQ/, /AllianzGI Global Equity Fund/, /ALC-26-/, /repair_queue/, /ssi_counterparties/];
const GS_ONLY = [/GS-FAIL-\d{8}-\d{4}/, /DEL-\d{8}-\d{6}/, /GS-EQ-\d{8}-\d{6}/, /CTM-\d{8}/, /AL-\d{8}-\d{6}-\d/, /T4417/, /trade_blotter/, /allocations_confirms/];

/** Text of a projected payload with shared (gateway-delivered) blocks removed, plus the values that were shared. */
function split(p: ProjectedRun) {
  const shared = new Set<string>();
  const strip = (e: RunEvent) => {
    const copy: Partial<RunEvent> = { ...e };
    if (e.shared) {
      Object.values(e.shared.fields).forEach((v) => shared.add(String(v)));
      if (e.shared.text) shared.add(e.shared.text);
      delete copy.shared;
    }
    if (copy.approval?.shared) copy.approval = { ...copy.approval, shared: undefined };
    return copy;
  };
  return { text: JSON.stringify(p.events.map(strip)), shared };
}

function assertClean(p: ProjectedRun, patterns: RegExp[]) {
  const { text, shared } = split(p);
  for (const re of patterns) {
    const hits = text.match(new RegExp(re.source, "g")) ?? [];
    for (const h of hits) expect([...shared].some((s) => s.includes(h)), `${h} rendered outside a shared block`).toBe(true);
  }
}

const runs: Record<string, Run> = {};
const get = async (s: "golden" | "fp2" | "fp3" | "fp4" | "fp5" | "fp8") => (runs[s] ??= await runToEnd(s));

describe("firm boundary", () => {
  it("no BNY → Goldman message carries fields outside the allowlist or internal ids", async () => {
    for (const s of ["golden", "fp2", "fp3", "fp4", "fp5", "fp8"] as const) {
      const run = await get(s);
      const toGs = run.events.filter((e) => e.lane === "goldman" && e.shared?.from === "BNY");
      expect(toGs.length).toBeGreaterThan(0);
      for (const e of toGs) {
        for (const k of Object.keys(e.shared!.fields)) expect(OUTBOUND_ALLOWLIST).toContain(k);
        for (const re of BNY_ONLY) expect(re.test(JSON.stringify(e.shared))).toBe(false);
        expect(/AllianzGI|Emily|allocation|holdings report/i.test(e.shared!.text ?? "")).toBe(false);
      }
    }
  });

  it("the outbound filter withholds internal ids and client terms from free text", () => {
    const out = outbound("Instruction BNYI-20261118-5527301 for AllianzGI account 4471-AGI-GLEQ (RQ-20261118-0407)", { isin: "X", client_ref: "AGI-ORD" }, ["AllianzGI"]);
    expect(out.text).not.toMatch(/BNYI-|4471-AGI|RQ-|AllianzGI/);
    expect(out.data).toEqual({ isin: "X" });
    expect(out.withheld).toContain("field client_ref");
  });

  it("every BNY → Goldman message carries usage terms and passes the data-label check", async () => {
    const run = await get("golden");
    const outboundChecks = run.events.filter((e) => e.kind === "gateway" && e.title.startsWith("Outbound filter"));
    expect(outboundChecks.length).toBeGreaterThan(0);
    for (const e of outboundChecks) {
      expect(e.checks?.find((c) => c.id === "terms")?.ok).toBe(true);
      expect(e.checks?.find((c) => c.id === "labels")?.ok).toBe(true);
      expect(JSON.stringify(e.envelope)).toContain("noTraining");
    }
  });

  it("a client-labelled field is blocked in code even if it is put on the message", () => {
    const out = outbound("ok", { isin: "X", client_account_id: "4471-AGI-GLEQ" }, [], ["isin", "client_account_id"]);
    expect(out.data).toEqual({ isin: "X" });
    expect(out.checks.find((c) => c.id === "labels")?.ok).toBe(false);
  });

  it("/goldman never renders a BNY-only record and /bny never a Goldman-only one", async () => {
    for (const s of ["golden", "fp2", "fp3", "fp5", "fp8"] as const) {
      const run = await get(s);
      assertClean(project(run.summary(), run.events, "goldman"), BNY_ONLY);
      assertClean(project(run.summary(), run.events, "bny"), GS_ONLY);
      const gsView = project(run.summary(), run.events, "goldman");
      expect(gsView.events.every((e) => e.envelope === undefined && e.checks === undefined)).toBe(true);
      expect(gsView.events.every((e) => (e.records ?? []).every((r) => r.firm === "goldman"))).toBe(true);
    }
  });

  it("console data builders read only their own firm", () => {
    const gs = JSON.stringify(goldmanConsoleData());
    for (const re of BNY_ONLY) expect(re.test(gs)).toBe(false);
    const bny = JSON.stringify(bnyConsoleData());
    for (const re of GS_ONLY) expect(re.test(bny)).toBe(false);
  });
});

describe("failure paths", () => {
  it("FP1: spoofed agent is rejected at the gateway; nothing reaches the Settlement Ops Agent", async () => {
    const run = await runToEnd("fp1");
    expect(run.status).toBe("rejected");
    const gw = run.events.find((e) => e.kind === "gateway")!;
    expect(gw.title).toContain("unregistered agent");
    expect(gw.taskState).toBe("rejected");
    expect(run.budget.calls).toHaveLength(0);
    expect(run.events.some((e) => e.actor.id === "bny-settlement-agent" && e.actor.type === "AGENT")).toBe(false);
    expect(run.audit.some((a) => a.decision.includes("rejected: unregistered agent"))).toBe(true);
  });

  it("FP2: injection is flagged, passed as quoted data, and the reply holds only allowlisted fields", async () => {
    const run = await get("fp2");
    const gw = run.events.find((e) => e.kind === "gateway" && e.flags?.includes("injection-flagged"));
    expect(gw?.checks?.find((c) => c.id === "injection")?.ok).toBe(false);
    expect(run.events.some((e) => e.flags?.includes("injection-blocked") && e.detail?.includes(INJECTION_TEXT))).toBe(true);
    expect(run.status).toBe("settled");
  });

  it("FP3: an ungrounded claim triggers a reference request, then escalation to Priya Sharma", async () => {
    const run = await get("fp3");
    expect(run.status).toBe("escalated");
    expect(run.statusReason).toBe("unverified-claim");
    expect(run.events.some((e) => e.shared?.fields.requested_action === "provide_record_reference")).toBe(true);
    expect(run.events.some((e) => e.title.startsWith("Sent to Emily Carter"))).toBe(false);
  });

  it("FP4: the client stays silent; the limits escalate both sides with a summary", async () => {
    const run = await get("fp4");
    expect(run.status).toBe("escalated");
    expect(["turn-limit", "time-limit"]).toContain(run.statusReason);
    const esc = run.events.filter((e) => e.kind === "escalation" && e.lane !== "network");
    expect(esc.map((e) => e.lane).sort()).toEqual(["bny", "goldman"]);
    expect(esc.every((e) => e.escalation!.summary.length > 0)).toBe(true);
  });

  it("FP6: a forged Agent Card is rejected even though the agent's name is registered", async () => {
    const run = await runToEnd("fp6");
    expect(run.status).toBe("rejected");
    const gw = run.events.find((e) => e.kind === "gateway")!;
    expect(gw.checks?.find((c) => c.id === "identity")?.ok).toBe(true);
    expect(gw.checks?.find((c) => c.id === "card")?.ok).toBe(false);
    expect(run.budget.calls).toHaveLength(0);
  });

  it("FP7: a replayed and a tampered message are both rejected; only the original opens a case", async () => {
    const run = await runToEnd("fp7");
    const gws = run.events.filter((e) => e.kind === "gateway");
    expect(gws.map((e) => e.title)).toEqual(["Gateway accepted settlement.dk-inquiry", "Gateway rejected: nonce reused", "Gateway rejected: signature mismatch"]);
    expect(run.status).toBe("rejected");
  });

  it("FP8: each question is within policy, but the combination is flagged and answers stop", async () => {
    const run = await get("fp8");
    expect(run.status).toBe("escalated");
    expect(run.statusReason).toBe("data-aggregation");
    const toGs = run.events.filter((e) => e.lane === "goldman" && e.shared?.from === "BNY");
    expect(toGs.some((e) => /holding/i.test(e.shared!.text ?? ""))).toBe(false);
  });
});
