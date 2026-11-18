// Human decisions. Each approval can only be made from its own firm's console.
import { NextRequest } from "next/server";
import { getRun } from "@/lib/engine/store";
import type { ApprovalKind } from "@/lib/engine/types";

const FIRM: Record<ApprovalKind, string> = { "bny-client-message": "bny", "gs-redelivery": "goldman", "bny-late-exception": "bny" };

export async function POST(req: NextRequest, ctx: RouteContext<"/api/runs/[id]/approve">) {
  const { id } = await ctx.params;
  const run = getRun(id);
  if (!run) return Response.json({ error: "run not found" }, { status: 404 });
  const { kind, outcome, by, view } = (await req.json()) as { kind: ApprovalKind; outcome: string; by: string; view: string };
  if (FIRM[kind] !== view) return Response.json({ error: `${kind} can only be decided from the ${FIRM[kind]} view` }, { status: 403 });
  if (!by?.trim() || !outcome) return Response.json({ error: "approver name and outcome are required" }, { status: 400 });
  if (!run.decide(kind, outcome, by.trim())) return Response.json({ error: "no pending approval of that kind" }, { status: 409 });
  return Response.json({ ok: true });
}
