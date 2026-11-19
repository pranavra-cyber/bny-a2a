"use client";
// The workspace frame: BNY's Eliza for BNY people, Goldman's own assistant for
// Michael. Left: digital employees and A2A connections with their case chats.
// Top: the page title, notifications and the signed-in person.
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BNY_CONNECTIONS, BNY_EMPLOYEES, type Connection, GS_CONNECTIONS, LIVE_CHAT_ID } from "@/lib/sideChats";
import { PersonaDock } from "../proto/PersonaDock";
import { useProto } from "../proto/Proto";

export type Notice = { id: string; title: string; detail?: string; from: string; channel: "teams" | "app" | "email"; at?: string; level?: "action" | "info" };

export function onboardingDone(): boolean {
  try {
    return JSON.parse(localStorage.getItem("a2a.onboarding") ?? "{}").done === true;
  } catch {
    return false;
  }
}

function ElizaMark({ gs }: { gs: boolean }) {
  return gs ? (
    <span className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gs-dark font-serif text-sm text-white">GS</span>
      <span className="leading-tight">
        <span className="block font-serif text-[15px] text-gs-dark">Fails Assistant</span>
        <span className="block text-[10px] text-muted">Goldman Sachs Operations</span>
      </span>
    </span>
  ) : (
    <span className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-teal to-navy text-sm font-semibold text-white">E</span>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight text-navy">Eliza</span>
        <span className="block text-[10px] text-muted">BNY digital employees</span>
      </span>
    </span>
  );
}

function ConnectionGroup({ c, gs, chats }: { c: Connection; gs: boolean; chats: Connection["chats"] }) {
  const [open, setOpen] = useState(c.id === "gs" || c.id === "bny");
  const path = usePathname();
  const chatParam = useSearchParams().get("chat");
  return (
    <li>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink hover:bg-canvas">
        <span className={`text-[10px] text-muted transition ${open ? "rotate-90" : ""}`}>▶</span>
        <span className="min-w-0 flex-1 truncate font-medium">{c.label}</span>
        <span className="h-1.5 w-1.5 rounded-full bg-ok" title="Connected" />
      </button>
      {open && (
        <ul className="mt-0.5 mb-1 ml-4 space-y-0.5 border-l border-line pl-2">
          {chats.length === 0 && <li className="px-2 py-1.5 text-[11px] text-muted">No open cases</li>}
          {chats.map((ch) => {
            const href = ch.id === LIVE_CHAT_ID ? "/eliza/case" : `/eliza/chat?chat=${ch.id}`;
            const active = ch.id === LIVE_CHAT_ID ? path === "/eliza/case" : chatParam === ch.id;
            return (
              <li key={ch.id}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-md px-2 py-1.5 ${active ? (gs ? "bg-gs-soft" : "bg-teal-soft") : "hover:bg-canvas"}`}
                >
                  <span className="flex items-center gap-1.5 text-[13px] text-ink">
                    {ch.status === "live" && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-warn" />}
                    <span className="truncate">{ch.title}</span>
                  </span>
                  <span className="block truncate text-[11px] text-muted">{ch.meta}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function Sidebar({ gs, pulseOnboard }: { gs: boolean; pulseOnboard: boolean }) {
  const path = usePathname();
  const { runId, summary } = useProto();
  const [onboarded, setOnboarded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOnboarded(onboardingDone()), 0);
    return () => clearTimeout(t);
  }, [path]);
  // BNY only has a Goldman connection once Goldman's agent is onboarded (or has already
  // contacted BNY), and the live case appears only once Goldman's request has arrived.
  const requestArrived = !!runId && !!summary && summary.turns > 0;
  const connections = gs ? GS_CONNECTIONS : BNY_CONNECTIONS.filter((c) => c.id !== "gs" || onboarded || requestArrived);
  const chatsOf = (c: Connection) => (!gs && c.id === "gs" ? c.chats.filter((ch) => ch.id !== LIVE_CHAT_ID || requestArrived) : c.chats);
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-line bg-white">
      <div className="px-4 pt-4 pb-3">
        <Link href="/eliza" aria-label="Workspace home">
          <ElizaMark gs={gs} />
        </Link>
      </div>
      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-2 pb-4" aria-label="Chats">
        {!gs && (
          <div>
            <h2 className="px-2 text-[11px] font-semibold tracking-wide text-muted uppercase">Digital employees</h2>
            <ul className="mt-1 space-y-0.5">
              {BNY_EMPLOYEES.map((d) => {
                const href = d.id === "orchestrator" ? "/eliza/case" : d.id === "onboarding" ? "/eliza/onboarding" : `/eliza/chat?chat=${d.id}`;
                return (
                  <li key={d.id}>
                    <Link href={href} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-canvas">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-soft text-[10px] font-semibold text-navy">{d.name[0]}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] text-ink">{d.name}</span>
                        <span className="block truncate text-[11px] text-muted">{d.line}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <div>
          <h2 className="px-2 text-[11px] font-semibold tracking-wide text-muted uppercase">{gs ? "Network connections" : "A2A connections"}</h2>
          <ul className="mt-1 space-y-0.5">
            {connections.map((c) => (
              <ConnectionGroup key={c.id} c={c} gs={gs} chats={chatsOf(c)} />
            ))}
          </ul>
        </div>
      </nav>
      {!gs && (
        <div className="border-t border-line p-3">
          <Link
            href="/eliza/onboarding"
            className={`flex w-full items-center justify-center gap-2 rounded-md bg-navy px-3 py-2.5 text-sm font-semibold text-white hover:bg-teal ${pulseOnboard ? "halo" : ""}`}
          >
            <span aria-hidden>＋</span> Onboard new agent
          </Link>
        </div>
      )}
    </aside>
  );
}

function Bell({ items, gs }: { items: Notice[]; gs: boolean }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  const unread = Math.max(0, items.length - seen);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          setOpen(!open);
          setSeen(items.length);
        }}
        aria-expanded={open}
        aria-label={`Notifications${unread ? `, ${unread} new` : ""}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-canvas"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[10px] font-semibold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute top-11 right-0 z-30 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-line bg-white shadow-xl">
          <div className="border-b border-line px-4 py-2.5 text-sm font-semibold text-navy">Notifications</div>
          {items.length ? (
            <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
              {[...items].reverse().map((n) => (
                <li key={n.id} className="px-4 py-3">
                  <div className="flex items-center gap-2 text-[11px] text-muted">
                    <ChannelIcon channel={n.channel} gs={gs} />
                    <span className="font-medium text-ink">{n.from}</span>
                    {n.at && <span className="ml-auto tabular">{n.at}</span>}
                  </div>
                  <p className="mt-1 text-sm font-medium text-navy">{n.title}</p>
                  {n.detail && <p className="mt-0.5 line-clamp-3 text-xs text-ink">{n.detail}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-sm text-muted">Nothing new.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ChannelIcon({ channel, gs }: { channel: Notice["channel"]; gs?: boolean }) {
  if (channel === "teams") return <span className="flex h-4 w-4 items-center justify-center rounded-[3px] bg-[#5b5fc7] text-[9px] font-bold text-white" title="Microsoft Teams">T</span>;
  if (channel === "email") return <span className="flex h-4 w-4 items-center justify-center rounded-[3px] bg-muted text-[9px] font-bold text-white" title="Email">@</span>;
  return <span className={`flex h-4 w-4 items-center justify-center rounded-[3px] text-[9px] font-bold text-white ${gs ? "bg-gs" : "bg-teal"}`} title="In-app">{gs ? "G" : "E"}</span>;
}

export function Shell({
  title,
  subtitle,
  right,
  notices = [],
  pulseOnboard = false,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  notices?: Notice[];
  pulseOnboard?: boolean;
  children: React.ReactNode;
}) {
  const { persona } = useProto();
  const gs = persona.firm === "Goldman Sachs";
  return (
    <div className="flex h-svh overflow-hidden bg-canvas">
      <Sidebar gs={gs} pulseOnboard={pulseOnboard} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className={`flex shrink-0 items-center gap-4 border-b border-line bg-white px-5 py-2.5 ${gs ? "border-t-4 border-t-gs-sky" : ""}`}>
          <div className="min-w-0 flex-1">
            <h1 className={`truncate text-base font-semibold ${gs ? "font-serif text-gs-dark" : "text-navy"}`}>{title}</h1>
            {subtitle && <div className="truncate text-xs text-muted">{subtitle}</div>}
          </div>
          {right}
          {!gs && (
            <Link href="/eliza/documents" aria-label="Documents and data sources" title="Documents and data sources" className="flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-canvas">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
            </Link>
          )}
          <Bell items={notices} gs={gs} />
          <div className="flex items-center gap-2 border-l border-line pl-3">
            <Image src={persona.photo} alt="" width={32} height={32} className="h-8 w-8 rounded-full" />
            <div className="hidden leading-tight sm:block">
              <div className="text-sm font-medium text-ink">{persona.name}</div>
              <div className="text-[11px] text-muted">{persona.team}</div>
            </div>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
      <PersonaDock />
    </div>
  );
}
