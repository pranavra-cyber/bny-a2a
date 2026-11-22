import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OUTBOUND_ALLOWLIST } from "../lib/a2a/gateway";
import { registry } from "../lib/a2a/registry";
import { ACCOUNT, CLIENT_NAME, DTC_REF, FUND, ONBOARDED, SECURED, TRADE_REF } from "../lib/securedScript";

const read = (f: string) => readFileSync(f, "utf8");

describe("secured walkthrough", () => {
  it("every message says what the prototype does with it, and the order is the agreed pipeline", () => {
    expect(SECURED.every((m) => m.provenance)).toBe(true);
    expect(SECURED.map((m) => m.speaker).slice(0, 7)).toEqual(["goldman", "card", "goldman", "auth", "goldman", "tls", "goldman"]);
    expect(SECURED.at(-1)!.speaker).toBe("audit");
    expect(SECURED.filter((m) => m.phase)).toHaveLength(6);
    // Cryptography the prototype does not run is never tagged as enforced.
    for (const m of SECURED.filter((x) => /mTLS|JWT Signature|Rate Limit|OAuth token/.test(`${x.text} ${x.steps}`)))
      expect(m.provenance, m.id).not.toBe("enforced");
  });

  it("the values that also appear in the prototype's data are the data's own", () => {
    expect(read("data/goldman/trade_blotter.csv")).toContain(TRADE_REF);
    expect(read("data/dtc/settlement_activity.csv")).toContain(DTC_REF);
    const accounts = read("data/bny/client_accounts.csv");
    for (const v of [ACCOUNT, CLIENT_NAME, FUND]) expect(accounts, v).toContain(v);
    expect(registry().members.find((m) => m.firm === "goldman")!.onboardedOn).toBe(ONBOARDED);
  });

  it("the outbound filter splits cleanly: shared fields are the registry's allowed ones, nothing blocked is shared", () => {
    const yaml = SECURED.find((m) => m.speaker === "registry")!.code!.body;
    const list = (key: string) => [...(yaml.split(`${key}:`)[1].split(/\n\n|\n[a-z_]+:/)[0].matchAll(/- ([a-z_]+)/g))].map((x) => x[1]);
    const allowed = list("fields_allowed_outbound");
    const blocked = list("fields_blocked_outbound");
    const shared = Object.keys(JSON.parse(SECURED.find((m) => m.split)!.split!.shared));
    expect(shared.every((f) => allowed.includes(f))).toBe(true);
    expect(shared.some((f) => blocked.includes(f))).toBe(false);
    // The audit log records exactly what was shared and withheld.
    const audit = JSON.parse(SECURED.at(-1)!.code!.body);
    expect(audit.fields_shared).toEqual(shared);
    expect(audit.fields_withheld).toHaveLength(SECURED.find((m) => m.split)!.split!.withheld.length);
  });

  it("is an illustrative exchange: its field names are not claimed to be the prototype's real allowlist", () => {
    // The real allowlist is what the gateway enforces and what the Supervision chat shows.
    expect(OUTBOUND_ALLOWLIST).not.toContain("missing_field_name");
    expect(SECURED.find((m) => m.split)!.provenance).toBe("enforced");
  });
});
