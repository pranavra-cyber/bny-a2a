// Onboarding progress, kept in this browser so leaving and coming back picks up
// where you were. Read by the onboarding steps and the documents page.
import type { CheckResult } from "@/lib/onboarding";
import { APPROVALS, LIMITS, type LimitId, type OnboardingStage, PERMISSIONS, type Problem, REPLY_FIELDS } from "@/lib/onboardingGuide";

export type Upload = { file: string; size: string; at: string; name: string; sentBy: string; superseded?: boolean };

export type OnboardingState = {
  results: Partial<Record<string, CheckResult>>;
  fixes: Problem[];
  asked: Problem[];
  skills: string[];
  limits: Record<LimitId, string>;
  approvals: string[];
  replyFields: string[];
  current: number;
  done: boolean;
  /** Documents uploaded per step (latest last). */
  uploads: Partial<Record<OnboardingStage, Upload[]>>;
  /** Values entered from the application. */
  inputs: Record<string, string>;
  /** Manual checks ticked per step. */
  manual: Partial<Record<OnboardingStage, string[]>>;
  /** When each step was completed. */
  completedAt: Partial<Record<OnboardingStage, string>>;
};

export const ONBOARDING_KEY = "a2a.onboarding";

export const initialOnboarding = (): OnboardingState => ({
  results: {},
  fixes: [],
  asked: [],
  skills: PERMISSIONS.filter((p) => p.recommended).map((p) => p.id),
  limits: Object.fromEntries(Object.entries(LIMITS).map(([k, v]) => [k, v.default])) as Record<LimitId, string>,
  approvals: APPROVALS.filter((a) => a.locked).map((a) => a.id),
  replyFields: REPLY_FIELDS.map((f) => f.id),
  current: 0,
  done: false,
  uploads: {},
  inputs: {},
  manual: {},
  completedAt: {},
});

export function loadOnboarding(): OnboardingState {
  try {
    return { ...initialOnboarding(), ...JSON.parse(localStorage.getItem(ONBOARDING_KEY) ?? "{}") };
  } catch {
    return initialOnboarding();
  }
}

export function saveOnboarding(st: OnboardingState) {
  try {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(st));
  } catch {}
}

export const nowStamp = () => new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
