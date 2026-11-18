// Guided case: a person's message (or chosen suggestion) to their assistant. view is the seat.
import { NextRequest } from "next/server";
import { ChatError, submitChat } from "@/lib/engine/chat";
import { getRun } from "@/lib/engine/store";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/runs/[id]/chat">) {
  const { id } = await ctx.params;
  const run = getRun(id);
  if (!run) return Response.json({ error: "run not found" }, { status: 404 });
  const { view, text, action } = (await req.json().catch(() => ({}))) as { view?: string; text?: string; action?: string };
  if (view !== "goldman" && view !== "bny" && view !== "bny-cs") return Response.json({ error: "view must be goldman, bny or bny-cs" }, { status: 400 });
  try {
    await submitChat(run, view, { text: typeof text === "string" ? text : undefined, action: typeof action === "string" ? action : undefined });
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof ChatError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
