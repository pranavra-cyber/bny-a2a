// Mock OAuth client-credentials: the registry issues each onboarded agent an
// HMAC-signed bearer token. The gateway verifies signature, issuer, expiry and scope.
import "server-only";
import crypto from "node:crypto";

export const ISSUER = "bny-a2a-network-registry";
// On globalThis like the registry and run store: each route bundle loads this module
// separately, and a per-bundle secret would reject tokens issued by another bundle.
const g = globalThis as unknown as { __networkSecret?: string };

/**
 * The registry's signing secret. Local dev and tests may fall back to a random per-process
 * secret. In production that would silently break verification across instances (a token
 * issued by one is rejected by another), so an unset NETWORK_SIGNING_SECRET throws instead.
 * Resolved on first use, not at import, so `next build` doesn't need the secret.
 */
function getSecret(): string {
  if (g.__networkSecret) return g.__networkSecret;
  const fromEnv = process.env.NETWORK_SIGNING_SECRET;
  if (!fromEnv && process.env.NODE_ENV === "production")
    throw new Error("NETWORK_SIGNING_SECRET is not set. Set it in the deployment environment; production never invents a signing secret.");
  return (g.__networkSecret = fromEnv || crypto.randomBytes(32).toString("hex"));
}

export type TokenClaims = {
  sub: string; // agent id
  clientId: string;
  firm: string;
  iss: string;
  scopes: string[];
  iat: number;
  exp: number;
};

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (body: string, secret: string) => crypto.createHmac("sha256", secret).update(body).digest("base64url");

export function issueToken(claims: Omit<TokenClaims, "iss" | "iat" | "exp">, ttlSeconds = 3600, secret = getSecret()): string {
  const now = Math.floor(Date.now() / 1000);
  const body = b64(JSON.stringify({ ...claims, iss: ISSUER, iat: now, exp: now + ttlSeconds }));
  return `${body}.${sign(body, secret)}`;
}

/** How far in the future an iat may be before the token is rejected (clock drift between instances). */
export const CLOCK_SKEW_SECONDS = 60;

const isStr = (v: unknown) => typeof v === "string";
const isNum = (v: unknown) => typeof v === "number" && Number.isFinite(v);

export type VerifyResult = { ok: true; claims: TokenClaims } | { ok: false; reason: string; claims?: Partial<TokenClaims> };

export function verifyToken(token: string): VerifyResult {
  const [body, sig] = token.split(".");
  if (!body || !sig) return { ok: false, reason: "malformed token" };
  let claims: TokenClaims;
  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return { ok: false, reason: "malformed token" };
  }
  const expected = sign(body, getSecret());
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
    return { ok: false, reason: "signature not issued by network registry", claims };
  // The signature only proves the registry signed this body; check it has the shape we rely on.
  const c = claims as unknown as Record<string, unknown>;
  const shapeOk =
    c !== null && typeof c === "object" && isStr(c.sub) && isStr(c.clientId) && isStr(c.firm) && isStr(c.iss) && Array.isArray(c.scopes) && c.scopes.every(isStr) && isNum(c.iat) && isNum(c.exp);
  if (!shapeOk) return { ok: false, reason: "malformed claims", claims };
  if (claims.iat > Math.floor(Date.now() / 1000) + CLOCK_SKEW_SECONDS) return { ok: false, reason: "token issued in the future", claims };
  if (claims.iss !== ISSUER) return { ok: false, reason: `unknown issuer ${claims.iss}`, claims };
  if (claims.exp < Math.floor(Date.now() / 1000)) return { ok: false, reason: "token expired", claims };
  return { ok: true, claims };
}
