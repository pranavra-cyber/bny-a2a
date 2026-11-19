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

  it("throws in production when NETWORK_SIGNING_SECRET is unset", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NETWORK_SIGNING_SECRET", "");
    const { issueToken } = await freshAuth();
    expect(() => issueToken(claims)).toThrow(/NETWORK_SIGNING_SECRET/);
  });

  it("uses the configured secret in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NETWORK_SIGNING_SECRET", "s3cret");
    const { issueToken, verifyToken } = await freshAuth();
    expect(verifyToken(issueToken(claims)).ok).toBe(true);
  });
});
