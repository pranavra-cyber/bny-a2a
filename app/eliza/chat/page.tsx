import { Suspense } from "react";
import { SideChatView } from "@/components/eliza/SideChatView";

export default function Page() {
  return (
    <Suspense>
      <SideChatView />
    </Suspense>
  );
}
