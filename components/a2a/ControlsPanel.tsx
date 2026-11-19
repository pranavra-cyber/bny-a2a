// What the prototype actually enforces in code versus what it only simulates.
// Static copy, checked against lib/a2a (auth, gateway, registry), lib/data/scope and lib/engine.
import { Pill } from "../ui";

const ENFORCED: [string, string][] = [
  ["Registry", "Only registered, KYC-verified, domain-attested members are accepted; unknown agents are rejected."],
  ["Token crypto", "HMAC signature, issuer, expiry, claim shape and clock skew are verified on every message."],
  ["Authorization", "The skill must be in the token's scopes and in the agent's approved skills in the registry."],
  ["Inbound allowlist", "Fields outside the allowlist are dropped before BNY's agents see the message."],
  ["Outbound allowlist and labels", "Only approved fields leave BNY; client and confidential fields are blocked in code."],
  ["Redaction", "Internal identifiers and case-specific client terms are replaced with [withheld] in outgoing text."],
  ["DataScope isolation", "Each firm's agents read only that firm's datasets."],
  ["Grounding", "Replies cite the source records they are based on."],
  ["Approvals", "Late instructions, client messages and redelivery wait for a named person's decision."],
  ["Turn and budget limits", "The gateway stops a case at 10 turns, and each case has a model-cost cap."],
  ["Audit", "Every message, check result and decision is recorded."],
];

const SIMULATED: [string, string, string][] = [
  ["Agent Card signature", "A flag decides the outcome; no signature is computed.", "JWS signatures verified against the registry's published JWKS."],
  ["Token-holder binding", "The check always passes; nothing ties a token to a certificate.", "Keys held in an HSM, with the token bound to the holder's certificate."],
  ["Message signature", "A flag decides the outcome; messages are not signed.", "Each message signed by the sender's registered key and verified at the gateway."],
  ["Nonce and replay freshness", "A flag decides the outcome; no nonce is stored.", "A real nonce store with a short timestamp window."],
  ["mTLS", "Not run. The first enforced check in this in-process prototype is token plus registry.", "TLS, with mutual authentication, terminates at the edge before the gateway."],
];

export function ControlsPanel() {
  return (
    <div className="space-y-6 px-6 py-5 pb-24">
      <p className="max-w-3xl text-sm text-ink">
        The gateway runs real code for the controls on the left. The ones on the right show how a failure would look to the user, but no cryptography runs behind them. All data is synthetic.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-line bg-white p-4">
          <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase">
            Enforced in code <Pill tone="ok">real</Pill>
          </h3>
          <dl className="mt-3 space-y-2.5 text-sm">
            {ENFORCED.map(([k, v]) => (
              <div key={k}>
                <dt className="font-medium text-navy">{k}</dt>
                <dd className="text-xs text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="rounded-lg border border-line bg-white p-4">
          <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase">
            Simulated, no real crypto <Pill tone="warn">simulated</Pill>
          </h3>
          <dl className="mt-3 space-y-2.5 text-sm">
            {SIMULATED.map(([k, now, prod]) => (
              <div key={k}>
                <dt className="font-medium text-navy">{k}</dt>
                <dd className="text-xs text-muted">{now}</dd>
                <dd className="text-xs text-ink">Production adds: {prod}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      <section className="max-w-3xl rounded-lg border border-line bg-canvas p-4 text-sm">
        <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">The injection scanner is a tripwire</h3>
        <p className="mt-2 text-xs text-ink">
          It matches a few known phrasings and flags them for the audit trail. A rephrased attack gets past it, so it is not what protects BNY. The real defenses are that counterparty text is quoted as untrusted data and never executed as instructions, and that the outbound filter holds back anything outside the approved fields, whatever the agent writes.
        </p>
      </section>
    </div>
  );
}
