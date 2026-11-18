// Guided case chat: checkpoints the flow waits on, and the user's messages to
// their firm's copilot. Each seat's chat is addressed to that firm only.
import "server-only";
import { type Activity, copilotTurn, fallbackTurn } from "../agents/copilot";
import { ACTORS } from "../agents/shared";
import { faqAnswer, knowledgeFor } from "./faq";
import { type Checkpoint, firmOfSeat, type Seat, SEATS } from "./guide";
import { project } from "./project";
import type { Run } from "./run";

export class ChatError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const copilotOf = (seat: Seat) => (firmOfSeat(seat) === "bny" ? ACTORS.bnyCopilot : ACTORS.gsCopilot);
const userOf = (seat: Seat) => (seat === "bny" ? ACTORS.bnyUser : seat === "bny-cs" ? ACTORS.bnyCsUser : ACTORS.gsUser);

export function say(run: Run, seat: Seat, role: "user" | "assistant", text: string) {
  const firm = firmOfSeat(seat);
  return run.emit({ kind: "chat", lane: firm, audience: [firm], desk: seat, actor: role === "user" ? userOf(seat) : copilotOf(seat), title: text, chat: { role } });
}

/** Emits the copilot's prompt and waits for the user's choice (unguided runs pass straight through). */
export function checkpoint(run: Run, def: Checkpoint): Promise<string> {
  const firm = firmOfSeat(def.seat);
  const e = run.emit({ kind: "checkpoint", lane: firm, audience: [firm], desk: def.seat, actor: copilotOf(def.seat), title: def.prompt, checkpoint: def });
  return run.awaitCheckpoint(def, e.seq);
}

/** What the seat's assistant may read: that firm's own projection of the run. */
function activityFor(run: Run, seat: Seat): Activity {
  return project(run.summary(), run.events, firmOfSeat(seat))
    .events.filter((e) => e.kind !== "model-call" && e.kind !== "checkpoint")
    .slice(-30)
    .map((e) => ({
      actor: e.actor.name,
      title: e.title.slice(0, 400),
      detail: e.detail?.slice(0, 500),
      shared: e.shared && { fields: e.shared.fields, text: e.shared.text?.slice(0, 500) },
    }));
}

export async function submitChat(run: Run, seat: Seat, input: { text?: string; action?: string }): Promise<void> {
  if (!run.guided) throw new ChatError("This run is not a guided case.", 400);
  const cp = run.pendingCheckpoint;
  if (!cp)
    throw new ChatError(run.status === "awaiting-approval" ? "Decide on the approval card first." : "The agents are still working. Wait for the copilot's next question.", 409);
  if (cp.def.seat !== seat) throw new ChatError(`The next step belongs to ${SEATS[cp.def.seat].person} (${SEATS[cp.def.seat].title}).`, 409);
  if (run.copilotWorking) throw new ChatError("The assistant is still answering your last message.", 409);
  const text = input.text?.trim().slice(0, 500);
  const chosen = input.action ? cp.def.actions.find((a) => a.id === input.action) : undefined;
  if (input.action && !chosen) throw new ChatError(`"${input.action}" is not an option at this step.`, 400);
  if (!text && !chosen) throw new ChatError("Type a message or pick a suggestion.", 400);

  run.copilotWorking = true;
  try {
    say(run, seat, "user", text || chosen!.label);
    let action = chosen?.id ?? null;
    if (!chosen) {
      const facts = { nowIso: run.clock.iso, seat, status: run.status };
      // Without a model: a grounded answer to a question, else keyword matching.
      const offline = () => {
        // The opening request starts the case even when phrased as a question.
        if (cp.def.id === "request") {
          const t = fallbackTurn(text!, cp.def);
          if (t.action) return t;
        }
        const answer = faqAnswer(text!, facts);
        return answer ? { action: null, reply: `${answer}\n\nWhen you're ready: ${cp.def.actions[0].label.toLowerCase()}.` } : fallbackTurn(text!, cp.def);
      };
      let turn;
      if (run.mode !== "live") turn = offline();
      else
        try {
          turn = await copilotTurn(run, cp.def, text!, activityFor(run, seat), knowledgeFor(facts));
        } catch (e) {
          // Budget spent, unusable output or an API error: answer offline; the flow escalates on its next call if the budget is gone.
          console.warn(`[copilot] ${(e as Error).message}`);
          turn = offline();
        }
      action = turn.action;
      if (turn.reply) say(run, seat, "assistant", turn.reply);
    }
    if (action) {
      const label = cp.def.actions.find((a) => a.id === action)!.label;
      run.log({ actor: userOf(seat).name, actorType: "HUMAN", firm: firmOfSeat(seat), action: `chat: ${cp.def.id}`, dataAccessed: [], fieldsShared: [], decision: `${label} ("${(text || label).slice(0, 120)}")`, approver: userOf(seat).name });
      run.resolveCheckpoint(action);
    }
  } finally {
    run.copilotWorking = false;
  }
}
