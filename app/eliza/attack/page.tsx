import { Suspense } from "react";
import { AttackWorkspace } from "@/components/eliza/AttackWorkspace";

export default function Page() {
  return (
    <Suspense>
      <AttackWorkspace />
    </Suspense>
  );
}
