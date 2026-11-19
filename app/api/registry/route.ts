// One Agent Card with its network membership, for the card overlay. Cards are
// public within the network; tokens are never returned.
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { cardById, membershipFor } from "@/lib/a2a/registry";

const fp = (x: string) => crypto.createHash("sha256").update(x).digest("hex").replace(/(..)(?!$)/g, "$1:").slice(0, 47).toUpperCase();

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const card = cardById(id);
  if (!card) return Response.json({ error: "unknown agent" }, { status: 404 });
  const m = membershipFor(id);
  return Response.json({
    card,
    membership: m && {
      legalName: m.member.legalName,
      lei: m.member.lei,
      domain: m.member.domain,
      domainAttestation: m.member.domainAttestation,
      kycStatus: m.member.kycStatus,
      dtcParticipant: m.member.dtcParticipant,
      onboardedOn: m.member.onboardedOn,
      approvedSkills: m.agent.approvedSkills,
      certificate: { fingerprint: fp(`cert:${id}`), issuer: "BNY A2A Network CA (simulated)", validTo: "2027-11-19" },
    },
  });
}
