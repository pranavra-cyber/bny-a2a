// The story told beside each gateway result in the attack console. Lines marked "narration" are
// scripted; the registry line is the gateway's real identity check, copied from the result as it
// came back. Nothing here runs or changes a check. Text only: safe for client components.
import type { AttackPreset, AttackStep } from "./attackCatalog";

export type StoryLine = { kind: "narration"; text: string } | { kind: "real"; ok: boolean; label: string; text: string };

/** The inbound result steps carry an identity check; the outbound filter step doesn't and gets no story. */
export const hasStory = (s: AttackStep) => s.kind === "gateway" && !!s.checks?.some((c) => c.id === "identity");

/**
 * @param later the steps that come after this one in the same result. A rejection with no BNY
 * step after it means nothing inside BNY (no agent, no tool) ever saw the message.
 */
export function storyFor(step: AttackStep, envelope: AttackPreset["envelope"], later: AttackStep[]): StoryLine[] {
  const identity = step.checks?.find((c) => c.id === "identity");
  if (step.kind !== "gateway" || !identity) return [];
  const lines: StoryLine[] = [
    { kind: "narration", text: `Card presented. The sender arrives as ${envelope.from} with ${envelope.credential}.` },
    { kind: "narration", text: `The gateway reads the client ID and domain from the token and the request: ${envelope.from} at ${envelope.domain}.` },
    { kind: "real", ok: identity.ok, label: "Registry lookup", text: identity.detail },
  ];
  const denied = step.ok === false && !later.some((s) => s.kind === "bny");
  if (denied) {
    lines.push({ kind: "narration", text: "Denied here, before any agent or tool was called." });
    lines.push({ kind: "narration", text: "Logged for Compliance." });
  } else if (identity.ok) lines.push({ kind: "narration", text: "Identity passed, so the gateway goes on to the checks below." });
  return lines;
}

/** One chat bubble in the console: the attacker's messages on the right, BNY's gateway and agents on the left. */
export type AttackBubble =
  | { side: "right" | "left"; kind: AttackStep["kind"]; step: AttackStep }
  | { side: "left"; kind: "narration"; text: string }
  | { side: "left"; kind: "real"; ok: boolean; label: string; text: string };

/** Lays an attack result out as a conversation: the story lines come before and after the gateway's own check list, in order. */
export function chatFor(preset: AttackPreset, steps: AttackStep[]): AttackBubble[] {
  const out: AttackBubble[] = [];
  steps.forEach((step, i) => {
    const story = storyFor(step, preset.envelope, steps.slice(i + 1));
    const asBubble = (l: StoryLine): AttackBubble => (l.kind === "narration" ? { side: "left", kind: "narration", text: l.text } : { side: "left", kind: "real", ok: l.ok, label: l.label, text: l.text });
    const real = story.findIndex((l) => l.kind === "real");
    if (real >= 0) story.slice(0, real + 1).forEach((l) => out.push(asBubble(l)));
    out.push({ side: step.kind === "sent" ? "right" : "left", kind: step.kind, step });
    if (real >= 0) story.slice(real + 1).forEach((l) => out.push(asBubble(l)));
  });
  return out;
}
