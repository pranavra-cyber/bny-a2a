"use client";
// Subscribes a view to one run over SSE (falls back to polling). All three views
// use the same runId, so an approval in one console shows up in the others.
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { ProjectedRun, RunEvent, RunSummary, View } from "@/lib/engine/types";

export function useRunId({ autoLatest = true }: { autoLatest?: boolean } = {}): string | null {
  const params = useSearchParams();
  const router = useRouter();
  const fromUrl = params.get("run");
  const [latest, setLatest] = useState<string | null>(null);
  useEffect(() => {
    if (fromUrl || !autoLatest) return;
    let alive = true;
    fetch("/api/runs")
      .then((r) => r.json())
      .then((d: { runs: { id: string }[] }) => {
        if (!alive || !d.runs[0]) return;
        setLatest(d.runs[0].id);
        const q = new URLSearchParams(params.toString());
        q.set("run", d.runs[0].id);
        router.replace(`?${q.toString()}`);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [fromUrl, autoLatest, params, router]);
  return fromUrl ?? latest;
}

export function useRun(runId: string | null, view: View) {
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    let closed = false;
    let poll: ReturnType<typeof setInterval> | undefined;
    const apply = (p: ProjectedRun) => {
      setSummary(p.summary);
      setEvents(p.events);
    };
    const startPolling = () => {
      const tick = () =>
        fetch(`/api/runs/${runId}?view=${view}`)
          .then(async (r) => {
            if (r.status === 404) throw new Error("This run was not found. The server may have restarted, which clears runs that weren't saved.");
            apply(await r.json());
            setError(null);
          })
          .catch((e) => setError(e.message));
      tick();
      poll = setInterval(tick, 1500);
    };
    const es = new EventSource(`/api/runs/${runId}/stream?view=${view}`);
    es.addEventListener("snapshot", (e) => apply(JSON.parse((e as MessageEvent).data)));
    es.addEventListener("summary", (e) => setSummary(JSON.parse((e as MessageEvent).data)));
    es.addEventListener("event", (e) => {
      const ev = JSON.parse((e as MessageEvent).data) as RunEvent;
      setEvents((prev) => (prev.some((p) => p.seq === ev.seq) ? prev : [...prev, ev]));
    });
    es.onerror = () => {
      es.close();
      if (!closed && !poll) startPolling();
    };
    return () => {
      closed = true;
      es.close();
      if (poll) clearInterval(poll);
    };
  }, [runId, view]);

  return { summary, events, error };
}

export async function decide(runId: string, view: string, kind: string, outcome: string, by: string) {
  const r = await fetch(`/api/runs/${runId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, outcome, by, view }),
  });
  if (!r.ok) throw new Error((await r.json()).error ?? "approval failed");
}
