import { describe, expect, it } from "vitest";
import { applicationFor, RISKY_SKILL, runCheck } from "../lib/onboarding";
import { ONBOARDING_STAGES, PERMISSIONS } from "../lib/onboardingGuide";

const RECOMMENDED = PERMISSIONS.filter((p) => p.recommended).map((p) => p.id);
const scopesOf = (detail: Record<string, string>) => detail.scopes.split(", ").filter(Boolean);

describe("onboarding desk", () => {
  it("passes every check once both problems are fixed, including SSI and SWIFT", () => {
    const app = applicationFor(["lei", "domain"]);
    for (const s of ONBOARDING_STAGES) expect(runCheck(app, s.id, RECOMMENDED).ok, s.id).toBe(true);
  });

  it("fails the company and web-address checks as submitted, and passes once each is fixed", () => {
    const flawed = applicationFor();
    const company = runCheck(flawed, "company");
    expect(company.ok).toBe(false);
    expect(company.problem).toBe("lei");
    expect(runCheck(flawed, "account").ok).toBe(true);
    const domain = runCheck(flawed, "domain");
    expect(domain.ok).toBe(false);
    expect(domain.problem).toBe("domain");

    expect(runCheck(applicationFor(["lei"]), "company").ok).toBe(true);
    expect(runCheck(applicationFor(["lei"]), "domain").ok).toBe(false);
    expect(runCheck(applicationFor(["lei", "domain"]), "domain").ok).toBe(true);
  });

  it("the go-live test fetches a fresh token carrying exactly the approved permissions", () => {
    const app = applicationFor(["lei", "domain"]);
    const pass = runCheck(app, "test", RECOMMENDED);
    expect(pass.ok).toBe(true);
    expect(scopesOf(pass.technical.detail).sort()).toEqual([...RECOMMENDED].sort());
    expect(scopesOf(pass.technical.detail)).not.toContain(RISKY_SKILL);

    const fewer = runCheck(app, "test", RECOMMENDED.slice(0, 1));
    expect(scopesOf(fewer.technical.detail)).toEqual(RECOMMENDED.slice(0, 1));
  });

  it("refuses an empty permission set and warns on the risky one", () => {
    const app = applicationFor(["lei", "domain"]);
    expect(runCheck(app, "permissions", []).ok).toBe(false);
    expect(runCheck(app, "permissions", [...RECOMMENDED, RISKY_SKILL]).result).toContain("Warning");
  });
});
