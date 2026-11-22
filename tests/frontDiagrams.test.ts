import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AGENT_CARDS, HUMANS } from "../lib/a2a/registry";
import { INSIDE, INSIDE_HEIGHT, layoutInside, OUT_HOPS, OUT_NODES, OUT_ZONES, ONBOARDING, ONBOARDING_CHIPS } from "../lib/frontDiagrams";

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
  it("rows sit inside their group's band, and the layout fits the canvas", () => {
    const l = layoutInside();
    for (const g of l.groups) for (const r of g.rows) expect(inside(r.data_, g.band) && inside(r.tool_, g.band), r.tool).toBe(true);
    expect(l.audit.y + l.audit.h).toBeLessThan(INSIDE_HEIGHT);
  });
  it("every tool the prototype has built reads data that exists and the named agent may read", () => {
    for (const g of INSIDE) {
      const card = g.agentId ? AGENT_CARDS.find((c) => c["x-prototype"].id === g.agentId) : undefined;
      if (g.agentId) expect(card, g.agentId).toBeDefined();
      for (const r of g.rows.filter((x) => x.state === "built" && x.source)) {
        const [dir, name] = r.source!.split("/");
        expect(existsSync(`data/${dir}/${name.includes(".") ? name : `${name}.csv`}`) || existsSync(`data/bny/docs/${name}`), r.source).toBe(true);
        if (!r.source!.startsWith("docs/")) expect(card!["x-prototype"].canRead.join("|"), r.tool).toContain(r.source!);
      }
    }
  });
  it("tools marked addable that name a table point at data that already exists", () => {
    for (const r of INSIDE.flatMap((g) => g.rows).filter((x) => x.state === "addable" && x.source)) expect(existsSync(`data/${r.source}.csv`), r.source).toBe(true);
  });
  it("the people named as approvers are in the registry, and their approvals match what the registry says they do", () => {
    const names = HUMANS.map((h) => h.name);
    expect(names).toContain("Daniel Kim");
    expect(names).toContain("Priya Sharma");
    expect(HUMANS.find((h) => h.name === "Daniel Kim")!.canDo).toMatch(/approve and send messages to the client/i);
    expect(HUMANS.find((h) => h.name === "Priya Sharma")!.canDo).toMatch(/approve late-instruction exceptions/i);
    const release = AGENT_CARDS.find((c) => c["x-prototype"].id === "bny-settlement-system")!;
    expect(release.skills[0].description).toMatch(/approved instruction/i);
  });
  it("anything that sends to the client, releases an instruction or makes an exception waits for a person", () => {
    const person = INSIDE.flatMap((g) => g.rows).filter((r) => r.human.by === "person").map((r) => r.tool);
    expect(person).toEqual(["Draft the client email", "Release the instruction", "Request a late exception"]);
  });
});
