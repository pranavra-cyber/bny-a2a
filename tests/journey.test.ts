import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CASE_BEATS, CASE_DEADLINE, CASE_RECORDING, caseSeconds, CONTROLS, FLOW, LIFECYCLE, NODES, SECTIONS, timeInState } from "../lib/journey";

const read = (f: string) => readFileSync(f, "utf8");
type Ev = { title?: string; at: string };
const recording = JSON.parse(read(`runs/${CASE_RECORDING}.json`)) as { events: Ev[] };

// 14:02Z is 09:02 ET in November (UTC-5).
const et = (iso: string) => {
  const d = new Date(iso);
  const h = (d.getUTCHours() + 24 - 5) % 24;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
};

describe("case beats", () => {
  it("every beat is a real event in the recorded golden run, at the stated time", () => {
    for (const b of CASE_BEATS) {
      const ev = recording.events.filter((e) => e.title?.startsWith(b.source));
      expect(ev.length, b.source).toBeGreaterThan(0);
      expect(ev.map((e) => et(e.at)), b.source).toContain(b.at);
    }
  });

  it("the task state only moves forward through the lifecycle, and ends completed before the deadline", () => {
    const order = ["submitted", "working", "input-required", "completed"];
    const idx = CASE_BEATS.filter((b) => b.state).map((b) => order.indexOf(b.state!));
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    expect(CASE_BEATS.at(-1)!.state).toBe("completed");
    expect(caseSeconds(CASE_BEATS.at(-1)!.at, CASE_DEADLINE)).toBe(13 * 60);
  });

  it("time in each state adds up to the case's elapsed time", () => {
    const total = Object.values(timeInState()).reduce((a, b) => a + b, 0);
    expect(total).toBe(caseSeconds(CASE_BEATS[1].at, CASE_BEATS.at(-1)!.at));
  });
});

describe("map", () => {
  it("flow steps run 1..n and connect nodes that exist, ending where each path starts and ends", () => {
    expect(FLOW.map((f) => f.n)).toEqual(FLOW.map((_, i) => i + 1));
    const ids = new Set(NODES.map((n) => n.id));
    for (const f of FLOW) {
      expect(ids.has(f.from) && ids.has(f.to), f.title).toBe(true);
      const [a, b] = [NODES.find((n) => n.id === f.from)!, NODES.find((n) => n.id === f.to)!];
      const inside = (n: typeof a, [x, y]: [number, number]) => x >= n.x - 1 && x <= n.x + n.w + 1 && y >= n.y - 1 && y <= n.y + n.h + 1;
      expect(inside(a, f.path[0]), `${f.title} starts on ${a.id}`).toBe(true);
      expect(inside(b, f.path.at(-1)!), `${f.title} ends on ${b.id}`).toBe(true);
    }
  });
});

describe("controls", () => {
  it("every control tagged enforced or partly points at code that exists", () => {
    for (const c of CONTROLS.filter((x) => x.build === "enforced" || x.build === "partly").filter((x) => x.code)) expect(read(c.code!.file), c.id).toContain(c.code!.has);
  });
  it("controls the prototype does not run are never called enforced", () => {
    for (const id of ["mtls", "signature", "rate", "streaming"]) expect(CONTROLS.find((c) => c.id === id)!.build, id).not.toBe("enforced");
    for (const id of ["keys", "agreement", "sandbox"]) expect(LIFECYCLE.find((s) => s.id === id)!.build, id).not.toBe("enforced");
  });
  it("ids are unique and every section has a heading", () => {
    for (const list of [CONTROLS, LIFECYCLE, NODES]) expect(new Set(list.map((x) => x.id)).size).toBe(list.length);
    expect(SECTIONS).toHaveLength(5);
  });
});
