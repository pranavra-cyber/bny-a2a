// Guided case chat: checkpoints the flow waits on, and the user's messages to
// their firm's copilot. Each seat's chat is addressed to that firm only.
import "server-only";
import { type Activity, copilotTurn, fallbackTurn } from "../agents/copilot";
import { ACTORS } from "../agents/shared";
import { answerQuestion } from "./ask";
import { isQuestion, knowledgeFor } from "./faq";
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
  if (run.copilotWorking) throw new ChatError("The assistant is still answering the last message.", 409);
  const cp = run.pendingCheckpoint;
  const mine = cp && cp.def.seat === seat ? cp : undefined;
  const text = input.text?.trim().slice(0, 500);
  if (input.action && !mine) {
    if (cp) throw new ChatError(`The next step belongs to ${SEATS[cp.def.seat].person} (${SEATS[cp.def.seat].title}).`, 409);
    throw new ChatError(run.status === "awaiting-approval" ? "Decide on the approval card first." : "The agents are still working. Wait for the assistant's next question.", 409);
  }
  const chosen = input.action ? mine!.def.actions.find((a) => a.id === input.action) : undefined;
  if (input.action && !chosen) throw new ChatError(`"${input.action}" is not an option at this step.`, 400);
  if (!text && !chosen) throw new ChatError("Type a message or pick a suggestion.", 400);

  run.busySeat = seat;
  run.copilotWorking = true;
  try {
    say(run, seat, "user", text || chosen!.label);
    let action = chosen?.id ?? null;
    let replied = false;
    if (!chosen && mine) {
      const def = mine.def;
      // The opening request starts the case even when phrased as a question.
      if (def.id === "request") action = fallbackTurn(text!, def).action;
      if (!action && !isQuestion(text!)) {
        let turn: { action: string | null; reply?: string } | undefined;
        if (run.mode === "live")
          try {
            turn = await copilotTurn(run, def, text!, activityFor(run, seat), knowledgeFor({ nowIso: run.clock.iso, seat, status: run.status }));
          } catch (e) {
            console.warn(`[copilot] ${(e as Error).message}`);
          }
        const live = !!turn;
        turn ??= fallbackTurn(text!, def);
        action = turn.action;
        // Live: anything that isn't a choice is answered from the data below.
        if (turn.reply && (action || !live)) {
          say(run, seat, "assistant", turn.reply);
          replied = true;
        }
      }
    }
    if (!action && text && !replied) {
      // A question, at any point: answered from this firm's own data.
      const a = await answerQuestion(run, seat, text, mine?.def.actions[0].label.toLowerCase());
      run.emit({
        kind: "chat",
        lane: firmOfSeat(seat),
        audience: [firmOfSeat(seat)],
        desk: seat,
        actor: copilotOf(seat),
        title: a.reply,
        chat: { role: "assistant", sources: a.sources, answeredBy: a.answeredBy, costUsd: a.costUsd },
      });
    }
    if (action && mine) {
      const label = mine.def.actions.find((a) => a.id === action)!.label;
      run.log({ actor: userOf(seat).name, actorType: "HUMAN", firm: firmOfSeat(seat), action: `chat: ${mine.def.id}`, dataAccessed: [], fieldsShared: [], decision: `${label} ("${(text || label).slice(0, 120)}")`, approver: userOf(seat).name });
      run.resolveCheckpoint(action);
    }
  } finally {
    run.copilotWorking = false;
  }
}
