import { Suspense } from "react";
import { A2AView } from "@/components/a2a/A2AView";

export default function Page() {
  return (
    <Suspense>
      <A2AView />
    </Suspense>
  );
}
