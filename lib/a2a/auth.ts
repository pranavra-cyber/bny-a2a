// Mock OAuth client-credentials: the registry issues each onboarded agent an
// HMAC-signed bearer token. The gateway verifies signature, issuer, expiry and scope.
import "server-only";
import crypto from "node:crypto";

export const ISSUER = "bny-a2a-network-registry";
// On globalThis like the registry and run store: each route bundle loads this module
// separately, and a per-bundle secret would reject tokens issued by another bundle.
const g = globalThis as unknown as { __networkSecret?: string };
const SECRET = (g.__networkSecret ??= process.env.NETWORK_SIGNING_SECRET || crypto.randomBytes(32).toString("hex"));

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

export function issueToken(claims: Omit<TokenClaims, "iss" | "iat" | "exp">, ttlSeconds = 3600, secret = SECRET): string {
  const now = Math.floor(Date.now() / 1000);
  const body = b64(JSON.stringify({ ...claims, iss: ISSUER, iat: now, exp: now + ttlSeconds }));
  return `${body}.${sign(body, secret)}`;
}

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
  const expected = sign(body, SECRET);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
    return { ok: false, reason: "signature not issued by network registry", claims };
  if (claims.iss !== ISSUER) return { ok: false, reason: `unknown issuer ${claims.iss}`, claims };
  if (claims.exp < Math.floor(Date.now() / 1000)) return { ok: false, reason: "token expired", claims };
  return { ok: true, claims };
}
