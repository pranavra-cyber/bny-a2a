import { Suspense } from "react";
import { AnalyticsPage } from "@/components/eliza/AnalyticsPage";

export default function Page() {
  return (
    <Suspense>
      <AnalyticsPage />
    </Suspense>
  );
}
