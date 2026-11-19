"use client";
// Everything in one agent's card, as the network registry holds it: who runs it,
// where it lives, what it can do, how it proves who it is, and what BNY lets it do.
import { useEffect, useState } from "react";
import type { AgentCard } from "@/lib/a2a/types";
import { PERMISSIONS } from "@/lib/onboardingGuide";
import { Expandable, Json, Pill } from "../ui";

type Membership = {
  legalName: string;
  lei: string;
  domain: string;
  domainAttestation: string;
  kycStatus: string;
  dtcParticipant: string | null;
  onboardedOn: string;
  approvedSkills: string[];
  certificate: { fingerprint: string; issuer: string; validTo: string };
} | null;

const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[9rem_1fr] gap-3 py-1.5 text-sm">
    <dt className="text-muted">{k}</dt>
    <dd className="min-w-0 break-words text-ink">{children}</dd>
  </div>
);

export function AgentCardOverlay({ agentId, onClose }: { agentId: string; onClose: () => void }) {
  const [data, setData] = useState<{ card: AgentCard; membership: Membership } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/registry?id=${agentId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [agentId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const c = data?.card;
  const m = data?.membership;
  const gs = c?.["x-prototype"].firm === "goldman";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Agent Card" className="dock-in max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white ${gs ? "bg-gs-dark font-serif" : "bg-gradient-to-br from-teal to-navy"}`}>{gs ? "GS" : "BNY"}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">Agent Card · network registry</p>
            <h2 className="text-lg font-semibold text-navy">{c?.name ?? "Loading…"}</h2>
            {c && <p className="text-sm text-ink">{c.description}</p>}
          </div>
          <button onClick={onClose} autoFocus className="text-sm text-muted hover:text-navy">
            Close <span className="text-[11px]">(Esc)</span>
          </button>
        </header>
        {err && <p className="px-5 py-4 text-sm text-bad">Couldn&apos;t load the card: {err}</p>}
        {c && (
          <div className="space-y-5 px-5 py-4">
            <section>
              <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Who runs it</h3>
              <dl className="mt-1 divide-y divide-line/70">
                <Row k="Provider">{c.provider.organization}</Row>
                <Row k="Owner">{c["x-prototype"].owner}</Row>
                <Row k="Endpoint">
                  <span className="font-mono text-xs">{c.url}</span>
                </Row>
                <Row k="Card version">{c.version}</Row>
                <Row k="Kind">{c["x-prototype"].kind}</Row>
                <Row k="Visible to">{c["x-prototype"].visibility === "network" ? "Other firms on the network" : "BNY only"}</Row>
              </dl>
            </section>
            <section>
              <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Skills on the card</h3>
              <ul className="mt-1 space-y-1.5">
                {c.skills.map((s) => (
                  <li key={s.id} className="rounded-md bg-canvas px-3 py-2 text-sm">
                    <span className="font-medium text-ink">{s.name}</span> <span className="font-mono text-[11px] text-muted">{s.id}</span>
                    <span className="block text-xs text-muted">{s.description}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs text-muted">A card describes what an agent can do. It grants nothing: BNY&apos;s gateway only lets through the permissions approved at onboarding.</p>
            </section>
            {m && (
              <section>
                <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Identity and permissions</h3>
                <dl className="mt-1 divide-y divide-line/70">
                  <Row k="Legal entity">{m.legalName}</Row>
                  <Row k="LEI">
                    <span className="font-mono text-xs">{m.lei}</span>
                  </Row>
                  <Row k="Web address">
                    {m.domain} <Pill tone={m.domainAttestation === "ATTESTED" ? "ok" : "warn"}>{m.domainAttestation.toLowerCase()}</Pill>
                  </Row>
                  <Row k="Due diligence">{m.kycStatus.toLowerCase()}</Row>
                  {m.dtcParticipant && <Row k="DTC account">{m.dtcParticipant}</Row>}
                  <Row k="On the network since">{m.onboardedOn}</Row>
                  <Row k="Certificate">
                    <span className="font-mono text-[11px]">{m.certificate.fingerprint}</span>
                    <span className="block text-xs text-muted">
                      {m.certificate.issuer} · valid to {m.certificate.validTo}
                    </span>
                  </Row>
                  <Row k="Card signature">
                    {c.signature.alg} · key {c.signature.keyId} <Pill tone="ok">verified</Pill>
                  </Row>
                  <Row k="BNY allows">
                    <ul className="space-y-0.5">
                      {m.approvedSkills.map((s) => (
                        <li key={s}>✓ {PERMISSIONS.find((p) => p.id === s)?.label ?? s}</li>
                      ))}
                    </ul>
                  </Row>
                </dl>
              </section>
            )}
            <section>
              <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Inside its firm</h3>
              <dl className="mt-1 divide-y divide-line/70">
                <Row k="Can read">{c["x-prototype"].canRead.join(", ") || "nothing"}</Row>
                <Row k="Can do">{c["x-prototype"].canDo.join(", ")}</Row>
              </dl>
            </section>
            <Expandable label="Raw Agent Card (JSON)">
              <Json value={c} />
            </Expandable>
          </div>
        )}
      </div>
    </div>
  );
}
