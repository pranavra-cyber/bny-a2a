import { NextRequest } from "next/server";
import { SCENARIOS, StartError, startRun } from "@/lib/engine/start";
import { allRuns } from "@/lib/engine/store";
import type { RunMode, Scenario } from "@/lib/engine/types";

export async function GET() {
  const runs = allRuns()
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .map((r) => ({ id: r.id, scenario: r.scenario, mode: r.mode, status: r.status, guided: r.guided, startedAt: r.startedAt.toISOString() }));
  return Response.json({ runs });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { scenario?: Scenario; mode?: RunMode; request?: string; autoApprove?: boolean };
  const scenario = body.scenario ?? "golden";
  if (!SCENARIOS.includes(scenario)) return Response.json({ error: `Unknown scenario ${scenario}` }, { status: 400 });
  const mode = body.mode === "live" || body.mode === "replay" || body.mode === "mock" ? body.mode : undefined;
  try {
    const request = typeof body.request === "string" ? body.request.slice(0, 500) : undefined;
    const run = startRun(scenario, mode, { request, autoApprove: body.autoApprove === true });
    return Response.json({ runId: run.id, mode: run.mode });
  } catch (e) {
    if (e instanceof StartError) return Response.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
