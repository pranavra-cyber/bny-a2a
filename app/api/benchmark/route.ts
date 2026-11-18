import { NextRequest } from "next/server";
import { getConfig } from "@/lib/config";
import { latestBenchmark, runBenchmark } from "@/lib/engine/benchmark";
import { StartError } from "@/lib/engine/start";

export async function GET() {
  return Response.json({ result: latestBenchmark() });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { mode?: string };
  const mode = body.mode === "live" || body.mode === "mock" || body.mode === "replay" ? body.mode : getConfig().mode;
  try {
    return Response.json({ result: await runBenchmark(mode) });
  } catch (e) {
    if (e instanceof StartError) return Response.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
