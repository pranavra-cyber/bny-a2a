import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AGENT_CARDS, HUMANS } from "../lib/a2a/registry";
import { IN_CAPTIONS, IN_ZONES, INSIDE, INSIDE_HEIGHT, layoutInside, OUT_HOPS, OUT_NODES, OUT_ZONES, ONBOARDING, ONBOARDING_CHIPS } from "../lib/frontDiagrams";

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
  const boxes = [l.gs, l.edge, l.gate, l.outbound, l.orch, ...l.groups.flatMap((g) => [g.agent, ...g.items.map((i) => i.box)])];
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
  it("every agent the diagram names is in the registry, and reads only what the registry says it may", () => {
    for (const g of INSIDE.filter((x) => x.agentId)) {
      const card = AGENT_CARDS.find((c) => c["x-prototype"].id === g.agentId);
      expect(card, g.agentId).toBeDefined();
      for (const it of g.items.filter((x) => x.kind === "read"))
        for (const src of it.sources ?? []) if (!src.startsWith("docs/") && src !== "bny/ssi_counterparties") expect(card!["x-prototype"].canRead.join("|"), it.title).toContain(src);
    }
  });
  it("the data every row names exists in the prototype", () => {
    for (const it of INSIDE.flatMap((g) => g.items))
      for (const src of it.sources ?? []) {
        const [dir, name] = src.split("/");
        expect(existsSync(dir === "docs" ? `data/bny/docs/${name}` : `data/${dir}/${name}.csv`), src).toBe(true);
      }
  });
  it("the people named as approvers are in the registry, and match what it says they do", () => {
    const names = HUMANS.map((h) => h.name);
    expect(names).toContain("Daniel Kim");
    expect(names).toContain("Priya Sharma");
    expect(HUMANS.find((h) => h.name === "Daniel Kim")!.canDo).toMatch(/approve and send messages to the client/i);
    expect(HUMANS.find((h) => h.name === "Priya Sharma")!.canDo).toMatch(/approve late-instruction exceptions/i);
    expect(AGENT_CARDS.find((c) => c["x-prototype"].id === "bny-settlement-system")!.skills[0].description).toMatch(/approved instruction/i);
  });
  it("exactly the client email, the release and late exceptions wait for a person", () => {
    expect(INSIDE.flatMap((g) => g.items).filter((i) => i.kind === "person").map((i) => i.title)).toEqual(["Client email", "Release to DTC", "Late exceptions"]);
  });
});
