import { Suspense } from "react";
import { ElizaHome } from "@/components/eliza/ElizaHome";

export default function Page() {
  return (
    <Suspense>
      <ElizaHome />
    </Suspense>
  );
}
