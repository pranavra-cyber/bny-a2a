import { Suspense } from "react";
import { CaseView } from "@/components/eliza/CaseView";

export default function Page() {
  return (
    <Suspense>
      <CaseView />
    </Suspense>
  );
}
