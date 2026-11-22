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
