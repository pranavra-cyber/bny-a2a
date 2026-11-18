// Server-Sent Events: each view gets its own projection of the run as it happens.
import { NextRequest } from "next/server";
import { project, projectEvent, projectSummary } from "@/lib/engine/project";
import { getRun } from "@/lib/engine/store";
import { parseView } from "@/lib/engine/views";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/runs/[id]/stream">) {
  const { id } = await ctx.params;
  const run = getRun(id);
  if (!run) return Response.json({ error: "run not found" }, { status: 404 });
  const view = parseView(req.nextUrl.searchParams.get("view"));
  const enc = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (type: string, data: unknown) => {
        try {
          controller.enqueue(enc.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };
      send("snapshot", project(run.summary(), run.events, view));
      const unsub = run.subscribe((e) => {
        const p = e && projectEvent(e, view);
        if (p) send("event", p);
        send("summary", projectSummary(run.summary(), view));
      });
      const ping = setInterval(() => send("ping", {}), 15000);
      cleanup = () => {
        clearInterval(ping);
        unsub();
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
