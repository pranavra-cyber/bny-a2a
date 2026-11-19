// Onboarding progress, kept in this browser so leaving and coming back picks up
// where you were. Read by the onboarding steps and the documents page.
import type { CheckResult } from "@/lib/onboarding";
import { APPROVALS, LIMITS, type LimitId, type OnboardingStage, PERMISSIONS, type Problem, REPLY_FIELDS } from "@/lib/onboardingGuide";

export type Upload = { file: string; size: string; at: string; name: string; sentBy: string; superseded?: boolean };

export type OnboardingState = {
  /** False until the onboarding lead names it and starts it. */
  started: boolean;
  /** The name the onboarding lead gave it. */
  title: string;
  startedAt?: string;
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
export const ONBOARDING_EVENT = "a2a:onboarding";
/** Set when onboarding finishes; cleared once the new connection is opened. */
export const NEW_CONNECTION_KEY = "a2a.gsNew";

export const initialOnboarding = (): OnboardingState => ({
  started: false,
  title: "",
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
    // The sidebar listens, so the new connection appears the moment onboarding ends.
    window.dispatchEvent(new Event(ONBOARDING_EVENT));
  } catch {}
}

export const nowStamp = () => new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
