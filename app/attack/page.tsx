import { Suspense } from "react";
import { AttackConsole } from "@/components/attack/AttackConsole";

export default function Page() {
  return (
    <Suspense>
      <AttackConsole />
    </Suspense>
  );
}
