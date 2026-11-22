import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AGENT_CARDS, HUMANS } from "../lib/a2a/registry";
import { IN_CAPTIONS, IN_ZONES, INSIDE_HEIGHT, layoutInside, TOOLS, OUT_HOPS, OUT_NODES, OUT_ZONES, ONBOARDING, ONBOARDING_CHIPS } from "../lib/frontDiagrams";

const inside = (b: { x: number; y: number; w: number; h: number }, o: { x: number; y: number; w: number; h: number }) => b.x >= o.x && b.y >= o.y && b.x + b.w <= o.x + o.w && b.y + b.h <= o.y + o.h;
const touches = ([x, y]: [number, number], b: { x: number; y: number; w: number; h: number }) => x >= b.x - 1 && x <= b.x + b.w + 1 && y >= b.y - 1 && y <= b.y + b.h + 1;

describe("outside diagram", () => {
  it("every node sits inside a zone, and nodes do not overlap", () => {
    for (const n of OUT_NODES) expect(OUT_ZONES.some((z) => inside(n, z)), n.id).toBe(true);
    for (const a of OUT_NODES)
      for (const b of OUT_NODES.filter((x) => x !== a)) expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${a.id}/${b.id}`).toBe(true);
  });
  it("the numbered hops run 1..6 and each starts and ends on a node", () => {
    const numbered = OUT_HOPS.filter((h) => h.n);
    expect(numbered.map((h) => h.n)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const h of OUT_HOPS.slice(0, 7)) {
      expect(OUT_NODES.some((n) => touches(h.path[0], n)), `start ${h.n}`).toBe(true);
      expect(OUT_NODES.some((n) => touches(h.path.at(-1)!, n)), `end ${h.n}`).toBe(true);
    }
  });
  it("the onboarding chips are one per step", () => {
    expect(ONBOARDING_CHIPS).toHaveLength(ONBOARDING.length);
  });
});

describe("inside diagram", () => {
  const l = layoutInside();
  const boxes = [l.gs, l.edge, l.gate, l.outbound, l.orch, l.hub, ...l.tools.map((t) => t.box)];
  it("every box sits inside a zone, inside the canvas, and no two overlap", () => {
    for (const b of boxes) {
      expect(IN_ZONES.some((z) => inside(b, z)), JSON.stringify(b)).toBe(true);
      expect(b.y + b.h).toBeLessThan(INSIDE_HEIGHT);
    }
    for (const a of boxes) for (const b of boxes.filter((x) => x !== a)) expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(true);
  });
  it("has a caption for each of the eight numbered hops", () => {
    expect(IN_CAPTIONS).toHaveLength(8);
  });
  it("tool ids are unique", () => {
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(TOOLS.length);
  });
  it("every function the diagram points at exists in the prototype", () => {
    for (const t of TOOLS.filter((x) => x.fn)) {
      const src = readFileSync(t.fn!.file, "utf8");
      expect(src, t.id).toMatch(new RegExp(`function ${t.fn!.name}\\b`));
      if (t.fn!.logged) expect(src, `${t.id} logs ${t.fn!.logged}`).toContain(`"${t.fn!.logged}"`);
    }
  });
  it("tools shown working are backed by a function, and ones not built say so", () => {
    for (const t of TOOLS.filter((x) => x.status === "working")) expect(t.fn, t.id).toBeDefined();
    for (const t of TOOLS.filter((x) => x.status === "described" || x.status === "addable")) expect(t.prototype, t.id).toMatch(/not built|no call|no agent|not something|exists in the prototype/i);
  });
  it("every value in an example call or response is in the prototype's data", () => {
    for (const t of TOOLS) for (const [file, value] of t.facts ?? []) expect(readFileSync(file, "utf8"), `${t.id}: ${value}`).toContain(value);
  });
  it("tools shown working read tables the registry lets their agent read, and the approvers are the registry's people", () => {
    const table: Record<string, string> = { instruction: "bny/settlement_instructions", dtc: "dtc/settlement_activity", exception: "bny/fails_exceptions", ssi: "bny/ssi_counterparties", client: "bny/client_accounts" };
    const readable = AGENT_CARDS.filter((c) => ["bny-settlement-agent", "bny-client-team"].includes(c["x-prototype"].id))
      .flatMap((c) => c["x-prototype"].canRead)
      .join("|");
    for (const [id, t] of Object.entries(table)) expect(readable, id).toContain(t);
    const names = HUMANS.map((h) => h.name);
    expect(names).toContain("Daniel Kim");
    expect(names).toContain("Priya Sharma");
    expect(HUMANS.find((h) => h.name === "Daniel Kim")!.canDo).toMatch(/approve and send messages to the client/i);
    expect(HUMANS.find((h) => h.name === "Priya Sharma")!.canDo).toMatch(/approve late-instruction exceptions/i);
  });
  it("exactly the client email, the release and late exceptions wait for a person", () => {
    expect(TOOLS.filter((t) => t.human.by === "person").map((t) => t.title)).toEqual(["Client email", "Release to DTC", "Late exceptions"]);
  });
});
