// Onboarding desk: runs one check on Goldman's application. Stateless; the desk
// keeps the step-by-step state, and nothing here changes the live registry.
import { NextRequest } from "next/server";
import { applicationFor, runCheck } from "@/lib/onboarding";
import { ONBOARDING_STAGES, type OnboardingStage, type Problem } from "@/lib/onboardingGuide";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { stage?: string; fixes?: unknown; approvedSkills?: unknown };
  const stage = ONBOARDING_STAGES.find((s) => s.id === body.stage)?.id as OnboardingStage | undefined;
  if (!stage) return Response.json({ error: "unknown stage" }, { status: 400 });
  const fixes = (Array.isArray(body.fixes) ? body.fixes : []).filter((f): f is Problem => f === "lei" || f === "domain");
  const skills = (Array.isArray(body.approvedSkills) ? body.approvedSkills : []).filter((s): s is string => typeof s === "string");
  return Response.json(runCheck(applicationFor(fixes), stage, skills));
}
