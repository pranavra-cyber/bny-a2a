// Onboarding desk: runs one check on Goldman's application. Stateless; the desk
// keeps the step-by-step state, and nothing here changes the live registry.
import { NextRequest } from "next/server";
import { agentBicFor, applicationFor, runCheck } from "@/lib/onboarding";
import { ONBOARDING_STAGES, type OnboardingStage, type Problem } from "@/lib/onboardingGuide";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { stage?: string; fixes?: unknown; approvedSkills?: unknown; passHours?: unknown };
  const stage = ONBOARDING_STAGES.find((s) => s.id === body.stage)?.id as OnboardingStage | undefined;
  if (!stage) return Response.json({ error: "unknown stage" }, { status: 400 });
  const fixes = (Array.isArray(body.fixes) ? body.fixes : []).filter((f): f is Problem => f === "lei" || f === "domain");
  const skills = (Array.isArray(body.approvedSkills) ? body.approvedSkills : []).filter((s): s is string => typeof s === "string");
  const hours = typeof body.passHours === "number" && [24, 168, 720].includes(body.passHours) ? body.passHours : 24;
  return Response.json(runCheck(applicationFor(fixes), stage, skills, hours));
}

/** The values on Goldman's application, as the onboarding lead would type them in. */
export async function GET(req: NextRequest) {
  const fixes = (req.nextUrl.searchParams.get("fixes") ?? "").split(",").filter((f): f is Problem => f === "lei" || f === "domain");
  const app = applicationFor(fixes);
  return Response.json({
    legalName: app.legalName,
    lei: app.lei,
    dtcParticipant: app.dtcParticipant,
    domain: app.domain,
    agentName: app.agentName,
    agentBic: agentBicFor(),
    proofUrl: `https://${app.domain}/.well-known/bny-network-verify.txt`,
    bnyContact: "Priya Sharma, Settlement Operations Lead, BNY",
    gsContact: "Fails Desk Lead, US Equity Fails, Goldman Sachs",
  });
}
