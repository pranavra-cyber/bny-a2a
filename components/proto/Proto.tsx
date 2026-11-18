"use client";
// Prototype state that is not part of the product: who you are playing, which case
// run is open, the run mode, and transient confirmations. Remembered in this
// browser so switching people or sections picks up where you left off.
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { DemoConfig } from "@/lib/demoConfig";
import type { RunMode, RunSummary } from "@/lib/engine/types";
import { type Persona, type PersonaId, personaById, PERSONAS } from "@/lib/personas";

const store = {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string | null) {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {}
  },
};

type Snack = { id: number; text: string };

type Ctx = {
  cfg: DemoConfig;
  persona: Persona;
  setPersona: (id: PersonaId, go?: boolean) => void;
  runId: string | null;
  setRunId: (id: string | null) => void;
  summary: RunSummary | null;
  mode: RunMode;
  setMode: (m: RunMode) => void;
  snack: (text: string) => void;
  /** Bumped when the persona changes, so the dock can introduce the new person. */
  introKey: number;
};

const ProtoCtx = createContext<Ctx | null>(null);

export const useProto = () => {
  const c = useContext(ProtoCtx);
  if (!c) throw new Error("useProto outside ProtoProvider");
  return c;
};

/** With nothing remembered, a deep link picks the person who owns that section. */
const fromPath = (path: string): PersonaId | null => (path.startsWith("/eliza/audit") ? "nguyen" : path.startsWith("/eliza/case") ? "torres" : null);

export function ProtoProvider({ cfg, children }: { cfg: DemoConfig; children: React.ReactNode }) {
  const router = useRouter();
  const [personaId, setPersonaId] = useState<PersonaId>("chen");
  const [runId, setRun] = useState<string | null>(null);
  const [mode, setModeState] = useState<RunMode>(cfg.defaultMode === "live" && cfg.liveProblems.length ? "replay" : cfg.defaultMode);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [snacks, setSnacks] = useState<Snack[]>([]);
  const [introKey, setIntroKey] = useState(0);

  // Restore after mount (localStorage is not available during server render).
  useEffect(() => {
    const p = personaById(new URLSearchParams(window.location.search).get("as")) ?? personaById(store.get("a2a.persona")) ?? personaById(fromPath(window.location.pathname));
    // The live case is remembered here; a ?run= link (a safety test) never replaces it.
    const r = store.get("a2a.run");
    const m = store.get("a2a.mode") as RunMode | null;
    const t = setTimeout(() => {
      if (p) {
        setPersonaId(p.id);
        store.set("a2a.persona", p.id);
      }
      if (r) setRun(r);
      if (m && (m !== "live" || !cfg.liveProblems.length)) setModeState(m);
      // Introduce each person once, not on every page load.
      if (p && store.get("a2a.introduced") !== p.id) {
        store.set("a2a.introduced", p.id);
        setIntroKey((k) => k + 1);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [cfg.liveProblems.length]);

  const setPersona = useCallback(
    (id: PersonaId, go = true) => {
      setPersonaId(id);
      store.set("a2a.persona", id);
      store.set("a2a.introduced", id);
      setIntroKey((k) => k + 1);
      if (go) router.push(personaById(id)!.home);
    },
    [router],
  );
  const setRunId = useCallback((id: string | null) => {
    setRun(id);
    store.set("a2a.run", id);
    if (!id) setSummary(null);
  }, []);
  const setMode = useCallback((m: RunMode) => {
    setModeState(m);
    store.set("a2a.mode", m);
  }, []);
  const snack = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setSnacks((s) => [...s, { id, text }]);
    setTimeout(() => setSnacks((s) => s.filter((x) => x.id !== id)), 4500);
  }, []);

  // A light poll of the open run's summary, for the dock's "whose turn" hints.
  useEffect(() => {
    if (!runId) return;
    let alive = true;
    const tick = () =>
      fetch(`/api/runs/${runId}?view=network&summary=1`)
        .then((r) => {
          if (r.status === 404) {
            // The server restarted and the run is gone: forget it.
            if (alive) setRunId(null);
            return null;
          }
          return r.json();
        })
        .then((d) => alive && d && setSummary(d.summary))
        .catch(() => {});
    tick();
    const t = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [runId, setRunId]);

  const value = useMemo<Ctx>(
    () => ({ cfg, persona: personaById(personaId) ?? PERSONAS[0], setPersona, runId, setRunId, summary, mode, setMode, snack, introKey }),
    [cfg, personaId, setPersona, runId, setRunId, summary, mode, setMode, snack, introKey],
  );

  return (
    <ProtoCtx.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4">
        {snacks.map((s) => (
          <div key={s.id} role="status" className="snack pointer-events-auto flex items-center gap-3 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-lg">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ok text-[11px]">✓</span>
            {s.text}
          </div>
        ))}
      </div>
    </ProtoCtx.Provider>
  );
}
