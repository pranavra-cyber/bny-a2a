import { Suspense } from "react";
import { OnboardingFlow } from "@/components/eliza/OnboardingFlow";

export default function Page() {
  return (
    <Suspense>
      <OnboardingFlow />
    </Suspense>
  );
}
