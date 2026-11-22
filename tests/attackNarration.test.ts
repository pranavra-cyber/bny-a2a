import { describe, expect, it } from "vitest";
import { ATTACKS } from "../lib/attackCatalog";
import { hasStory, storyFor } from "../lib/attackNarration";
import { runAttack } from "../lib/attacks";

const storyOf = (id: (typeof ATTACKS)[number]["id"]) => {
  const preset = ATTACKS.find((a) => a.id === id)!;
  const r = runAttack(id);
  return r.steps.flatMap((s, i) => (hasStory(s) ? [{ s, story: storyFor(s, preset.envelope, r.steps.slice(i + 1)) }] : []));
};

describe("attack console story", () => {
  for (const a of ATTACKS)
    it(`${a.id}: the registry line is the gateway's real identity result, the rest is tagged narration`, () => {
      const stories = storyOf(a.id);
      expect(stories.length).toBeGreaterThan(0);
      for (const { s, story } of stories) {
        const identity = s.checks!.find((c) => c.id === "identity")!;
        const real = story.filter((l) => l.kind === "real");
        expect(real).toEqual([{ kind: "real", ok: identity.ok, label: "Registry lookup", text: identity.detail }]);
        expect(story[0]).toMatchObject({ kind: "narration" });
        expect(story[0].kind === "narration" && story[0].text).toContain("Card presented");
        expect(story[1].kind === "narration" && story[1].text).toContain(a.envelope.domain);
      }
    });

  it("unregistered and stolen-token senders are denied before any tool, and it is logged", () => {
    for (const id of ["spoof", "stolen-pass", "forged-card", "escalate", "flood"] as const) {
      const text = storyOf(id).at(-1)!.story.map((l) => l.text).join(" ");
      expect(text, id).toContain("Denied here, before any agent or tool was called");
      expect(text, id).toContain("Logged for Compliance");
    }
    const spoof = storyOf("spoof")[0].story.find((l) => l.kind === "real")!;
    expect(spoof).toMatchObject({ ok: false });
    expect(spoof.text).toMatch(/not in the network registry/);
    expect(storyOf("stolen-pass")[0].story.find((l) => l.kind === "real")!.text).toMatch(/does not match attested/);
  });

  it("an attack that reaches a BNY person or agent is never narrated as denied before any tool", () => {
    for (const id of ["injection", "role-play", "smuggle", "fishing"] as const)
      for (const { story } of storyOf(id)) expect(story.map((l) => l.text).join(" "), id).not.toContain("Denied here");
  });

  it("the outbound filter step gets no story", () => {
    const r = runAttack("injection");
    expect(r.steps.some((s) => s.kind === "gateway" && !hasStory(s))).toBe(true);
  });
});

describe("attack console chat", () => {
  it("puts the attacker's messages on the right and BNY's on the left, with the story around the real check list", async () => {
    const { chatFor } = await import("../lib/attackNarration");
    for (const a of ATTACKS) {
      const r = runAttack(a.id);
      const chat = chatFor(a, r.steps);
      expect(chat.filter((b) => b.kind === "sent").every((b) => b.side === "right"), a.id).toBe(true);
      expect(chat.filter((b) => b.kind !== "sent").every((b) => b.side === "left"), a.id).toBe(true);
      // Every step of the real result appears, in order.
      expect(chat.flatMap((b) => ("step" in b ? [b.step] : []))).toEqual(r.steps);
      // The real registry bubble is the gateway's identity result, and comes before that gateway's check list.
      chat.forEach((b, i) => {
        if (b.kind !== "real") return;
        const gate = chat.slice(i).find((x) => x.kind === "gateway") as { step: { checks: { id: string; detail: string }[] } };
        expect(b.text).toBe(gate.step.checks.find((c) => c.id === "identity")!.detail);
      });
    }
  });
});
