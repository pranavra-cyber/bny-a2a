import { NextRequest } from "next/server";
import { project } from "@/lib/engine/project";
import { getRun } from "@/lib/engine/store";
import { parseView } from "@/lib/engine/views";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/runs/[id]">) {
  const { id } = await ctx.params;
  const run = getRun(id);
  if (!run) return Response.json({ error: "run not found" }, { status: 404 });
  const p = project(run.summary(), run.events, parseView(req.nextUrl.searchParams.get("view")));
  // ?summary=1: just the summary (the persona dock polls this).
  return Response.json(req.nextUrl.searchParams.get("summary") ? { summary: p.summary } : p);
}
