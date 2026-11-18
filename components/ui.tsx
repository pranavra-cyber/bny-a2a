"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { GatewayCheck } from "@/lib/a2a/types";
import type { ActorType, ResolvedRecord } from "@/lib/engine/types";

/** Who did it: an agent, a rule (deterministic code) or a person. Text label, quiet colour. */
export function TypeBadge({ type }: { type: ActorType }) {
  const cls = type === "AGENT" ? "text-teal" : type === "HUMAN" ? "text-warn" : "text-muted";
  const label = type === "AGENT" ? "Agent" : type === "HUMAN" ? "Person" : "Rule";
  return <span className={`text-[11px] font-semibold ${cls}`}>{label}</span>;
}

export type Tone = "neutral" | "ok" | "warn" | "bad" | "teal" | "gs";

/** A small status label: soft fill, no border, one line. */
export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  const cls = {
    neutral: "bg-canvas text-muted",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    bad: "bg-bad-soft text-bad",
    teal: "bg-teal-soft text-navy",
    gs: "bg-gs-soft text-gs",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap ${cls}`}>{children}</span>;
}

/** A dot plus label, for statuses inside tables. */
export function Dot({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  const c = { neutral: "bg-line", ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", teal: "bg-teal", gs: "bg-gs" }[tone];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`h-1.5 w-1.5 rounded-full ${c}`} />
      {children}
    </span>
  );
}

export function Panel({ title, right, children, className = "" }: { title?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-white ${className}`}>
      {title !== undefined && (
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
          <h2 className="text-sm font-semibold text-navy">{title}</h2>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const short = (t: string) => t.replace(/^(bny|goldman|allianzgi)\//, "");

export function RecordChips({ records }: { records?: ResolvedRecord[] }) {
  const [open, setOpen] = useState<ResolvedRecord | null>(null);
  if (!records?.length) return null;
  const unique = [...new Map(records.map((r) => [`${r.table}#${r.id}`, r])).values()];
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {unique.map((r) => (
        <button
          key={`${r.table}#${r.id}`}
          onClick={() => setOpen(r)}
          className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-navy hover:bg-teal-soft"
          title="Show source row"
        >
          {short(r.table)}#{r.id}
        </button>
      ))}
      {open && <RecordModal record={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

export function RecordModal({ record, onClose }: { record: ResolvedRecord; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${record.table} ${record.id}`} className="max-h-[80vh] w-full max-w-xl overflow-auto rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-line px-4 py-2">
          <div className="font-mono text-sm text-navy">
            {record.table} · {record.id}
          </div>
          <button onClick={onClose} autoFocus className="text-sm text-muted hover:text-navy">
            Close <span className="text-[11px]">(Esc)</span>
          </button>
        </header>
        <table className="w-full text-sm">
          <tbody>
            {Object.entries(record.row).map(([k, v]) => (
              <tr key={k} className="border-b border-line/60 align-top">
                <td className="w-48 px-4 py-1 font-mono text-xs text-muted">{k}</td>
                <td className="px-4 py-1 whitespace-pre-wrap">{v || <span className="text-muted">(blank)</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SharedBlock({ shared, label = "Shared by counterparty" }: { shared: { from: string; fields: Record<string, unknown>; text?: string }; label?: string }) {
  const fields = Object.entries(shared.fields);
  return (
    <div className="mt-2 rounded-md bg-teal-soft/60 p-3" data-shared="true">
      <div className="mb-1.5 flex flex-wrap items-baseline gap-2">
        <span className="text-xs font-semibold text-navy">
          {label}: {shared.from}
        </span>
        <span className="text-[11px] text-muted">{fields.length} field{fields.length === 1 ? "" : "s"} via the gateway</span>
      </div>
      {shared.text && <p className="mb-1 text-sm whitespace-pre-wrap">{shared.text}</p>}
      {fields.length > 0 && (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-0.5 text-xs">
          {fields.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-mono text-muted">{k}</dt>
              <dd className="font-mono break-all">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export function Checks({ checks }: { checks?: GatewayCheck[] }) {
  if (!checks?.length) return null;
  return (
    <ul className="mt-2 space-y-0.5 text-xs">
      {checks.map((c) => (
        <li key={c.id} className="flex gap-2">
          <span className={c.ok ? "text-ok" : c.id === "injection" || c.id === "disclosure" || c.id === "fields" ? "text-warn" : "text-bad"}>{c.ok ? "✓" : c.id === "injection" || c.id === "disclosure" || c.id === "fields" ? "⚑" : "✗"}</span>
          <span className="font-medium">{c.label}</span>
          <span className="text-muted">{c.detail}</span>
        </li>
      ))}
    </ul>
  );
}

export function Expandable({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button onClick={() => setOpen(!open)} className="text-xs font-medium text-teal hover:underline">
        {open ? "▾" : "▸"} {label}
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}

export function Json({ value }: { value: unknown }) {
  return <pre className="max-h-80 overflow-auto rounded bg-navy p-2 font-mono text-[11px] leading-snug text-teal-soft">{JSON.stringify(value, null, 2)}</pre>;
}

/** Two-step confirm for actions that can't be undone: the first click arms, the second acts. */
export function useConfirm(ms = 4000) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), ms);
    return () => clearTimeout(t);
  }, [armed, ms]);
  const trigger = (act: () => void) => {
    if (!armed) return setArmed(true);
    setArmed(false);
    act();
  };
  return { armed, trigger };
}

/** An error with a way out: what went wrong, and where to go next. */
export function ErrorNote({ error, className = "" }: { error: string; className?: string }) {
  const gone = /not found/i.test(error);
  return (
    <div role="alert" className={`rounded-md border border-bad/40 bg-bad-soft px-3 py-2 text-sm text-bad ${className}`}>
      {error}
      {gone && (
        <>
          {" "}
          <Link href="/eliza/case?new=1" className="font-semibold underline">
            Start a new case
          </Link>{" "}
          or{" "}
          <Link href="/eliza/audit" className="font-semibold underline">
            run a safety test
          </Link>
          .
        </>
      )}
    </div>
  );
}

