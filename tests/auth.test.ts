import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const g = globalThis as unknown as { __networkSecret?: string };
const claims = { sub: "a", clientId: "c", firm: "goldman", scopes: ["settlement.status"] };

async function freshAuth() {
  vi.resetModules();
  return import("../lib/a2a/auth");
}

describe("signing secret", () => {
  beforeEach(() => {
    delete g.__networkSecret;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    delete g.__networkSecret;
  });

  it("falls back to a random secret outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NETWORK_SIGNING_SECRET", "");
    const { issueToken, verifyToken } = await freshAuth();
    expect(verifyToken(issueToken(claims)).ok).toBe(true);
  });

  it("uses the same fixed demo secret in production when none is set, so separate instances agree", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NETWORK_SIGNING_SECRET", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const first = await freshAuth();
    const token = first.issueToken(claims);
    delete g.__networkSecret; // another instance, started separately
    const second = await freshAuth();
    expect(second.verifyToken(token).ok).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("fixed demo secret"));
    warn.mockRestore();
  });

  it("a configured secret replaces the demo one, and tokens signed with the demo one stop working", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NETWORK_SIGNING_SECRET", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const demo = await freshAuth();
    const demoToken = demo.issueToken(claims);
    delete g.__networkSecret;
    vi.stubEnv("NETWORK_SIGNING_SECRET", "a-real-secret");
    const real = await freshAuth();
    expect(real.verifyToken(demoToken).ok).toBe(false);
    expect(real.verifyToken(real.issueToken(claims)).ok).toBe(true);
  });

  it("uses the configured secret in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NETWORK_SIGNING_SECRET", "s3cret");
    const { issueToken, verifyToken } = await freshAuth();
    expect(verifyToken(issueToken(claims)).ok).toBe(true);
  });
});

describe("verifyToken claim checks", () => {
  const now = () => Math.floor(Date.now() / 1000);
  const forge = async (over: Record<string, unknown>) => {
    g.__networkSecret = "claims-test-secret";
    const { ISSUER } = await import("../lib/a2a/auth");
    const crypto = await import("node:crypto");
    const body = Buffer.from(JSON.stringify({ ...claims, iss: ISSUER, iat: now(), exp: now() + 600, ...over })).toString("base64url");
    return `${body}.${crypto.createHmac("sha256", g.__networkSecret).update(body).digest("base64url")}`;
  };
  const verify = async (over: Record<string, unknown>) => {
    const token = await forge(over);
    return (await import("../lib/a2a/auth")).verifyToken(token);
  };

  afterEach(() => {
    delete g.__networkSecret;
  });

  it("accepts a well-formed signed token", async () => {
    expect((await verify({})).ok).toBe(true);
  });

  it("rejects scopes that is not an array of strings", async () => {
    for (const scopes of ["settlement.status", { a: 1 }, null, [1]]) expect(await verify({ scopes })).toMatchObject({ ok: false, reason: "malformed claims" });
  });

  it("rejects iat or exp that are not numbers", async () => {
    expect(await verify({ iat: "now" })).toMatchObject({ ok: false, reason: "malformed claims" });
    expect(await verify({ exp: null })).toMatchObject({ ok: false, reason: "malformed claims" });
  });

  it("allows small clock skew but rejects an iat further in the future", async () => {
    expect((await verify({ iat: now() + 30 })).ok).toBe(true);
    expect(await verify({ iat: now() + 3600 })).toMatchObject({ ok: false, reason: "token issued in the future" });
  });

  it("still rejects expired tokens", async () => {
    expect(await verify({ iat: now() - 7200, exp: now() - 3600 })).toMatchObject({ ok: false, reason: "token expired" });
  });
});
