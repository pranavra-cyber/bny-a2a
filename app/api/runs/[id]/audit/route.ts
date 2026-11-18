import { NextRequest } from "next/server";
import { auditCsv } from "@/lib/engine/audit";
import { getRun } from "@/lib/engine/store";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/runs/[id]/audit">) {
  const { id } = await ctx.params;
  const run = getRun(id);
  if (!run) return Response.json({ error: "run not found" }, { status: 404 });
  if (req.nextUrl.searchParams.get("format") === "csv")
    return new Response(auditCsv(run.audit), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="audit-${run.id}.csv"` },
    });
  return Response.json({ summary: run.summary(), audit: run.audit });
}
