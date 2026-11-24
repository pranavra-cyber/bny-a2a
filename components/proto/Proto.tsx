"use client";
// Prototype state that is not part of the product: who you are playing, which case
// run is open, the run mode, and transient confirmations. Remembered in this
// browser so switching people or sections picks up where you left off. Also hosts
// the operating-system-style notifications (Teams, Outlook) that slide in from the
// bottom right: they come from outside the product, so they aren't part of its UI.
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { DemoConfig } from "@/lib/demoConfig";
import type { RunMode, RunSummary } from "@/lib/engine/types";
import { type Persona, type PersonaId, personaById, PERSONAS } from "@/lib/personas";

// A full page load (refresh, new tab, typed URL) starts the prototype from the beginning:
// no person, case, onboarding or seen notifications carried over. This runs once when
// the module first loads in the browser, before any page reads the saved state; moving
// between pages inside the app doesn't reload it, so nothing resets mid-session.
if (typeof window !== "undefined") {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("a2a."))
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
}

export const store = {
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
  list(k: string): string[] {
    try {
      const v = JSON.parse(localStorage.getItem(k) ?? "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  },
};

type Snack = { id: number; text: string; tone: "ok" | "proto" };

/** A notification from another app on the person's computer. */
export type Toast = {
  /** Shown once per key, ever (until the case restarts). */
  key: string;
  app: "teams" | "outlook";
  from: string;
  title: string;
  body?: string;
  href?: string;
  /** Show again on each visit (still never twice on screen at once). */
  repeat?: boolean;
};

type Ctx = {
  cfg: DemoConfig;
  persona: Persona;
  setPersona: (id: PersonaId, go?: boolean) => void;
  runId: string | null;
  setRunId: (id: string | null) => void;
  summary: RunSummary | null;
  mode: RunMode;
  setMode: (m: RunMode) => void;
  /** "proto" is the prototype's own voice (dark), not the product's. */
  snack: (text: string, tone?: "ok" | "proto") => void;
  toast: (t: Toast, delayMs?: number) => void;
  /** Whether the prototype dock (bottom right) is expanded. Kept here, not in the dock, so a
   * page change (which remounts the dock) never reopens it. */
  dockOpen: boolean;
  /** Opens or closes the dock; with autoCloseMs it tucks itself away after that long. */
  setDockOpen: (open: boolean, autoCloseMs?: number) => void;
  /** True once the remembered person and case are restored (after mount). */
  hydrated: boolean;
};

const ProtoCtx = createContext<Ctx | null>(null);

export const useProto = () => {
  const c = useContext(ProtoCtx);
  if (!c) throw new Error("useProto outside ProtoProvider");
  return c;
};

/** With nothing remembered, a deep link picks the person who owns that section. */
const fromPath = (path: string): PersonaId | null =>
  path.startsWith("/eliza/audit") ? "nguyen" : path.startsWith("/eliza/case") ? "torres" : path.startsWith("/attack") ? "hacker" : null;

const TOASTED = "a2a.toasted";
/** How long the dock stays open after you become someone, unless you hover it. */
const DOCK_INTRO_MS = 6000;
/** Consecutive 404s (polled every 2s) before an open case is treated as gone. */
const RUN_GONE_AFTER = 5;

export function ProtoProvider({ cfg, children }: { cfg: DemoConfig; children: React.ReactNode }) {
  const router = useRouter();
  const [personaId, setPersonaId] = useState<PersonaId>("chen");
  const [runId, setRun] = useState<string | null>(null);
  const [mode, setModeState] = useState<RunMode>(cfg.liveProblems.length ? "replay" : cfg.defaultMode === "mock" ? "replay" : cfg.defaultMode);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [snacks, setSnacks] = useState<Snack[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dockOpen, setDockOpenState] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const queued = useRef<Toast[]>([]);
  const dockTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const personaRef = useRef<PersonaId>("chen");

  const setDockOpen = useCallback((open: boolean, autoCloseMs?: number) => {
    clearTimeout(dockTimer.current);
    setDockOpenState(open);
    if (open && autoCloseMs) dockTimer.current = setTimeout(() => setDockOpenState(false), autoCloseMs);
  }, []);
  /** The dock opens only when you become someone: on landing, and on each switch to another person. */
  const introduce = useCallback(() => setDockOpen(true, DOCK_INTRO_MS), [setDockOpen]);

  // Restore after mount (localStorage is not available during server render).
  useEffect(() => {
    const p = personaById(new URLSearchParams(window.location.search).get("as")) ?? personaById(store.get("a2a.persona")) ?? personaById(fromPath(window.location.pathname));
    // The live case is remembered here; a ?run= link never replaces it.
    const r = store.get("a2a.run");
    const m = store.get("a2a.mode") as RunMode | null;
    const t = setTimeout(() => {
      if (p) {
        setPersonaId(p.id);
        personaRef.current = p.id;
        store.set("a2a.persona", p.id);
        // The overview isn't a workspace: introduce people where they land.
        if (window.location.pathname !== "/" && window.location.pathname !== "/prototype") introduce();
      }
      if (r) setRun(r);
      if (m && (m === "replay" || (m === "live" && !cfg.liveProblems.length))) setModeState(m);
      setHydrated(true);
    }, 0);
    return () => clearTimeout(t);
  }, [cfg.liveProblems.length, introduce]);

  const setPersona = useCallback(
    (id: PersonaId, go = true) => {
      const switched = id !== personaRef.current;
      personaRef.current = id;
      setPersonaId(id);
      store.set("a2a.persona", id);
      if (switched) introduce();
      if (go) router.push(personaById(id)!.home);
    },
    [router, introduce],
  );
  const setRunId = useCallback((id: string | null) => {
    setRun(id);
    store.set("a2a.run", id);
    if (!id) {
      setSummary(null);
      // A new case: its notifications and the mode question come again.
      store.set(TOASTED, JSON.stringify(store.list(TOASTED).filter((k) => !k.startsWith("case:"))));
      store.set("a2a.modeChosen", null);
    }
  }, []);
  /** The case was lost on the server (not the user's choice): forget it but keep the chosen mode. */
  const forgetRun = useCallback(() => {
    setRun(null);
    store.set("a2a.run", null);
    setSummary(null);
  }, []);
  const setMode = useCallback((m: RunMode) => {
    setModeState(m);
    store.set("a2a.mode", m);
  }, []);
  const snack = useCallback((text: string, tone: "ok" | "proto" = "ok") => {
    const id = Date.now() + Math.random();
    setSnacks((s) => [...s.filter((x) => x.text !== text), { id, text, tone }]);
    setTimeout(() => setSnacks((s) => s.filter((x) => x.id !== id)), 4500);
  }, []);

  const show = useCallback((t: Toast) => {
    setToasts((s) => (s.some((x) => x.key === t.key) ? s : [...s.slice(-2), t]));
    setTimeout(() => setToasts((s) => s.filter((x) => x.key !== t.key)), 9000);
  }, []);
  const dockOpenRef = useRef(false);
  const toast = useCallback(
    (t: Toast, delayMs = 600) => {
      if (!t.repeat) {
        const done = store.list(TOASTED);
        if (done.includes(t.key)) return;
        store.set(TOASTED, JSON.stringify([...done, t.key].slice(-300)));
      }
      setTimeout(() => {
        // Wait while the prototype dock is open, so the two never overlap.
        if (dockOpenRef.current) queued.current.push(t);
        else show(t);
      }, delayMs);
    },
    [show],
  );
  useEffect(() => {
    dockOpenRef.current = dockOpen;
    if (dockOpen) return;
    const q = queued.current.splice(0);
    q.forEach((t, i) => setTimeout(() => show(t), 400 + i * 500));
  }, [dockOpen, show]);

  // A light poll of the open run's summary, for the dock's "whose turn" hints and the sidebar.
  useEffect(() => {
    if (!runId) return;
    let alive = true;
    let missing = 0;
    const tick = () =>
      fetch(`/api/runs/${runId}?view=network&summary=1`)
        .then((r) => {
          if (r.status === 404) {
            // A single 404 can be a request served by another server instance, or one sent
            // before the new run is visible. Only after a run of them is the case really gone.
            if (alive && ++missing >= RUN_GONE_AFTER) forgetRun();
            return null;
          }
          missing = 0;
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
  }, [runId, forgetRun]);

  const value = useMemo<Ctx>(
    () => ({ cfg, persona: personaById(personaId) ?? PERSONAS[0], setPersona, runId, setRunId, summary, mode, setMode, snack, toast, dockOpen, setDockOpen, hydrated }),
    [cfg, personaId, setPersona, runId, setRunId, summary, mode, setMode, snack, toast, dockOpen, setDockOpen, hydrated],
  );

  return (
    <ProtoCtx.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4">
        {snacks.map((s) =>
          s.tone === "proto" ? (
            <div key={s.id} role="status" className="snack pointer-events-auto flex max-w-md items-start gap-3 rounded-xl border border-white/10 bg-[#0b1622] px-4 py-3 text-sm text-white shadow-2xl">
              <span className="mt-0.5 shrink-0 font-mono text-[10px] font-semibold tracking-[0.14em] text-teal uppercase">Prototype</span>
              <span>{s.text}</span>
            </div>
          ) : (
            <div key={s.id} role="status" className="snack pointer-events-auto flex items-center gap-3 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-lg">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ok text-[11px]">✓</span>
              {s.text}
            </div>
          ),
        )}
      </div>
      <div aria-live="polite" aria-label="Notifications" className="pointer-events-none fixed right-4 bottom-20 z-50 flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <ToastCard
            key={t.key}
            t={t}
            onClose={() => setToasts((s) => s.filter((x) => x.key !== t.key))}
            onOpen={() => {
              setToasts((s) => s.filter((x) => x.key !== t.key));
              if (t.href) router.push(t.href);
            }}
          />
        ))}
      </div>
    </ProtoCtx.Provider>
  );
}

function AppIcon({ app }: { app: Toast["app"] }) {
  return app === "teams" ? (
    <span className="flex h-4 w-4 items-center justify-center rounded-[3px] bg-[#5b5fc7] text-[9px] font-bold text-white">T</span>
  ) : (
    <span className="flex h-4 w-4 items-center justify-center rounded-[3px] bg-[#0f6cbd] text-[9px] font-bold text-white">O</span>
  );
}

/** Looks like the operating system's notification, not like the product. */
function ToastCard({ t, onClose, onOpen }: { t: Toast; onClose: () => void; onOpen: () => void }) {
  return (
    <div role="status" className="toast-in pointer-events-auto overflow-hidden rounded-xl border border-black/10 bg-[#f8f8f8]/95 font-sans shadow-2xl backdrop-blur">
      <div className="flex items-center gap-2 px-3 pt-2.5 text-[11px] text-[#555]">
        <AppIcon app={t.app} />
        <span className="font-medium">{t.app === "teams" ? "Microsoft Teams" : "Outlook"}</span>
        <span>· now</span>
        <button onClick={onClose} aria-label="Dismiss notification" className="ml-auto rounded px-1 text-[13px] leading-none text-[#777] hover:bg-black/5 hover:text-black">
          ×
        </button>
      </div>
      <button onClick={onOpen} className="block w-full px-3 pt-1 pb-3 text-left">
        <span className="block text-[13px] font-semibold text-[#111]">{t.from}</span>
        <span className="block text-[13px] text-[#111]">{t.title}</span>
        {t.body && <span className="mt-0.5 line-clamp-2 text-[12px] text-[#444]">{t.body}</span>}
      </button>
    </div>
  );
}
