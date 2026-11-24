import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { INBOUND_ALLOWLIST, OUTBOUND_ALLOWLIST } from "../lib/a2a/gateway";
import { type ChatMessage, SUPERVISED, SUPERVISION, type SupervisedScenario } from "../lib/engine/supervision";
import { extractSnapshot, replayRecording } from "../lib/engine/supervisionSnapshot";

const saved = JSON.parse(readFileSync("lib/engine/supervision-snapshot.json", "utf8"));
const bnyData = () => {
  const files = ["bny", "dtc"].flatMap((d) => {
    const dir = path.join("data", d);
    const own = readdirSync(dir).filter((f) => f.endsWith(".csv")).map((f) => ({ name: f.replace(/\.csv$/, ""), text: readFileSync(path.join(dir, f), "utf8"), csv: true }));
    const docs = d === "bny" ? readdirSync(path.join(dir, "docs")).map((f) => ({ name: f.replace(/\.md$/, ""), text: readFileSync(path.join(dir, "docs", f), "utf8"), csv: false })) : [];
    return [...own, ...docs];
  });
  const csv = files.filter((f) => f.csv);
  return { names: new Set(csv.map((f) => f.name)), headers: new Set(csv.flatMap((f) => f.text.split("\n", 1)[0].split(","))), text: files.map((f) => f.text).join("\n") };
};

describe("supervision snapshot", () => {
  for (const s of SUPERVISED)
    it(`${s}: supervision-snapshot.json matches the recording replay plays (run npm run supervision:snapshot if not)`, () => {
      expect(saved[s]).toEqual(extractSnapshot(replayRecording(s)!));
    });
});

describe("supervision scripts", () => {
  it("the golden conversation is the agreed twelve bubbles, in order", () => {
    const g = SUPERVISION.golden;
    expect(g.map((m) => [m.speaker, m.source, m.step])).toEqual([
      ["goldman", "run", "inbound"],
      ["gateway", "run", "inbound"],
      ["orchestrator", "narration", "thinking"],
      ["orchestrator", "narration", "selecting tools"],
      ["tool", "narration", "retrieve"],
      ["tool", "narration", "retrieve"],
      ["tool", "narration", "retrieve"],
      ["tool", "narration", "retrieve"],
      ["orchestrator", "narration", "merge"],
      ["orchestrator", "narration", "handoff"],
      ["gateway", "run", "outbound"],
      ["orchestrator", "run", "reply"],
    ]);
    expect(g.filter((m) => m.tool).map((m) => m.tool)).toEqual(["get_trade", "check_status", "ssi lookup", "knowledge"]);
    // Goldman's own wording comes from the recorded model run, so only its shape is fixed.
    expect(g[0].text).toMatch(/^Sends settlement\.dk-inquiry: .*(DK|mismatch)/);
    expect(g[2].text).toMatch(/^New DK inquiry from Goldman on DTC-DO-20261119-000318\. They delivered 10,000;/);
    expect(g[9].text).toBe("This needs a client re-instruction. Handing to the Client Team Agent to draft the request for Daniel to approve.");
  });

  it("the tool-selection bubble shortlists the tools and then calls each selected one, in order, with a retrieve message", () => {
    for (const s of SUPERVISED) {
      const script = SUPERVISION[s];
      const i = script.findIndex((m) => m.candidates);
      const selected = script[i].candidates!.filter((c) => c.selected);
      expect(script[i].footer, s).toMatch(/lookups needed/);
      const calls = script.slice(i + 1, i + 1 + selected.length);
      expect(calls.every((m) => m.speaker === "tool" && m.step === "retrieve" && m.tool), s).toBe(true);
      expect(script[i + 1 + selected.length].step, s).toBe("merge");
    }
  });

  it("run bubbles carry the real gateway data: every inbound result lists its checks, and only approved fields leave", () => {
    for (const s of SUPERVISED)
      for (const m of SUPERVISION[s].filter((x) => x.source === "run")) {
        if (m.speaker === "gateway") expect(m.checks!.length, `${s} ${m.step}`).toBeGreaterThan(0);
        if (m.step === "inbound" && m.speaker === "gateway") expect(m.checks!.every((c) => c.ok)).toBe(true);
        for (const f of m.shared ?? []) expect(OUTBOUND_ALLOWLIST, `${s}: ${f}`).toContain(f);
        for (const f of m.speaker === "goldman" ? (m.fields ?? []) : []) expect(INBOUND_ALLOWLIST, `${s}: ${f}`).toContain(f);
      }
  });

  it("every concrete value a narration bubble cites is in BNY's data", () => {
    const d = bnyData();
    const check = (m: ChatMessage) => {
      for (const id of m.text.match(/[A-Z0-9]+(?:-[A-Z0-9…]+)+/g) ?? []) expect(d.text, `${id}: ${m.text}`).toContain(id.includes("…") ? id.split("…")[1] : id);
      for (const p of m.text.match(/\b0\d{3}\b/g) ?? []) expect(d.text, p).toMatch(new RegExp(`(^|,)${p}(,|$)`, "m"));
      for (const x of m.text.match(/\b\d{1,3}(?:,\d{3})+\b/g) ?? []) expect(d.text, x).toMatch(new RegExp(`,${x.replace(/,/g, "")},`));
      for (const t of m.text.match(/\b\d{2}:\d{2}\b/g) ?? []) expect(d.text, t).toContain(t);
      for (const w of m.text.match(/\b[A-Z]{2,}(?:_[A-Z0-9]+)+\b/g) ?? []) expect(d.text, w).toContain(w);
      for (const t of m.text.match(/\b[a-z]+(?:_[a-z]+)+\b/g) ?? []) expect(d.names.has(t) || d.headers.has(t), `${t} is not a table or column`).toBe(true);
      for (const c of m.candidates ?? []) if (/^[a-z]+(_[a-z]+)+$/.test(c.name)) expect(d.names.has(c.name), c.name).toBe(true);
    };
    for (const s of SUPERVISED) SUPERVISION[s].filter((m) => m.source === "narration").forEach(check);
    expect(SUPERVISION.golden.find((m) => m.tool === "get_trade")!.text).toContain("status SENT_TO_DTC");
  });

  it("each script ends where the recorded run ends", () => {
    const rec = (s: SupervisedScenario) => replayRecording(s)!;
    const last = (s: SupervisedScenario) => SUPERVISION[s].at(-1)!;
    expect(rec("golden").summary.status).toBe("settled");
    expect(last("golden")).toMatchObject({ step: "reply", source: "run" });

    expect(rec("fp3").events.find((e) => e.kind === "escalation" && e.lane === "bny")?.escalation?.reason).toBe("unverified-claim");
    expect(last("fp3").text).toBe("Goldman cites a confirmation but gives no record id; I can't verify an unsupported claim, escalating to Priya.");

    expect(rec("fp4").events.find((e) => e.kind === "escalation" && e.lane === "bny")?.escalation?.reason).toBe("time-limit");
    expect(last("fp4").text).toBe("Time limit reached with no client reply, escalating both sides with a summary.");

    expect(rec("fp5").events.some((e) => e.kind === "approval-request" && e.approval?.kind === "bny-late-exception")).toBe(true);
    expect(last("fp5").text).toBe("The client re-instructed after cutoff, this needs Priya's late-exception before I ask Goldman to redeliver.");
  });
});
