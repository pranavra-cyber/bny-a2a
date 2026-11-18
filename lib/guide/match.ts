// Keyword matching for guided chats when no model answers (mock, replay, budget
// spent, and the onboarding desk). Pure: safe to import from client components.
import type { CheckpointAction } from "../engine/guide";

export type Turn = { action: string | null; reply: string };

const YES = /\b(yes|yep|yeah|ok|okay|sure|go|proceed|continue|do it|please|next|sounds good|let'?s)\b/;
const NO = /\b(no|don'?t|do not|stop|cancel|abort)\b/;

const primaryOf = (actions: CheckpointAction[]) => actions.find((a) => a.kind === "primary") ?? actions[0];

export function matchAction(text: string, { actions }: { actions: CheckpointAction[] }): string | null {
  const t = text.toLowerCase();
  const cancel = actions.find((a) => a.kind === "cancel");
  if (cancel && (NO.test(t) || cancel.keywords?.some((k) => t.includes(k)))) return cancel.id;
  for (const a of actions) if (a.kind !== "cancel" && a.keywords?.some((k) => t.includes(k))) return a.id;
  return YES.test(t) && !NO.test(t) ? primaryOf(actions).id : null;
}

export function fallbackTurn(text: string, step: { actions: CheckpointAction[] }): Turn {
  const action = matchAction(text, step);
  const label = step.actions.find((a) => a.id === action)?.label;
  return label
    ? { action, reply: `On it: ${label.toLowerCase()}.` }
    : { action: null, reply: `I can't do that from here. The next step is "${primaryOf(step.actions).label}". Pick a suggestion, or say "go ahead".` };
}
