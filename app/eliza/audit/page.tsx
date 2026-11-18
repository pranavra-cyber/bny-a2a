import { Suspense } from "react";
import { AuditPage } from "@/components/eliza/AuditPage";

export default function Page() {
  return (
    <Suspense>
      <AuditPage />
    </Suspense>
  );
}
